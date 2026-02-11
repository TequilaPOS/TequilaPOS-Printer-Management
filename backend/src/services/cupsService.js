// ===========================================
// CUPS Service - Printer Management via Shell
// ===========================================

const { execCommand, pingHost, sanitizeForShell, isValidIP } = require('../utils/shellExec');
const logger = require('../utils/logger');

class CupsService {
    
    /**
     * Generate a CUPS-safe printer name from user input
     */
    generateCupsName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
    }

    /**
     * Build printer URI based on protocol
     */
    buildPrinterUri(ip, port, protocol) {
        const safeIp = sanitizeForShell(ip);
        const safePort = parseInt(port) || 9100;
        
        switch (protocol) {
            case 'ipp':
                return `ipp://${safeIp}:${safePort === 9100 ? 631 : safePort}/ipp/print`;
            case 'ipps':
                return `ipps://${safeIp}:${safePort === 9100 ? 631 : safePort}/ipp/print`;
            case 'socket':
                return `socket://${safeIp}:${safePort}`;
            case 'lpd':
                return `lpd://${safeIp}/queue`;
            case 'http':
                return `http://${safeIp}:${safePort}/`;
            default:
                // Try IPP first (modern printers), fallback to socket
                return `ipp://${safeIp}:631/ipp/print`;
        }
    }

    /**
     * Add a printer to CUPS with intelligent driver selection
     */
    async addPrinter({ cupsName, ip, port = 9100, protocol = 'ipp', location = '', description = '', manufacturer = '', model = '' }) {
        const safeName = sanitizeForShell(cupsName);
        const safeLocation = sanitizeForShell(location);
        const safeDescription = sanitizeForShell(description);
        const uri = this.buildPrinterUri(ip, port, protocol);
        
        logger.info(`Adding printer: ${safeName} at ${uri} (${manufacturer} ${model})`);
        
        try {
            // Find the best driver for this printer
            const driver = await this.findBestDriver(manufacturer, model, protocol);
            logger.info(`Selected driver for ${safeName}: ${driver}`);
            
            // Build lpadmin command
            let cmd = `lpadmin -p "${safeName}" -v "${uri}" -E -m "${driver}"`;
            
            if (safeLocation) {
                cmd += ` -L "${safeLocation}"`;
            }
            if (safeDescription) {
                cmd += ` -D "${safeDescription}"`;
            }
            
            const addResult = await execCommand(cmd);
            logger.info(`lpadmin result: ${JSON.stringify(addResult)}`);
            
            // Enable the printer
            await execCommand(`cupsenable "${safeName}"`);
            
            // Accept jobs
            await execCommand(`cupsaccept "${safeName}"`);
            
            logger.info(`Printer ${safeName} added successfully with driver: ${driver}`);
            
            return { 
                success: true, 
                cupsName: safeName,
                uri,
                driver,
                message: 'Printer added successfully'
            };
            
        } catch (error) {
            logger.error(`Failed to add printer ${safeName}:`, error);
            
            // Try to provide helpful error message
            let errorMsg = error.stderr || error.error || 'Unknown error';
            if (errorMsg.includes('client-error-not-found')) {
                errorMsg = 'Printer not found at specified address. Verify IP and that printer supports IPP.';
            } else if (errorMsg.includes('Unauthorized')) {
                errorMsg = 'CUPS authentication required. Check CUPS configuration.';
            } else if (errorMsg.includes('IPP Everywhere')) {
                errorMsg = 'IPP Everywhere driver not compatible. Try socket protocol.';
            }
            
            return { 
                success: false, 
                error: errorMsg
            };
        }
    }

    /**
     * Find the best driver for a printer based on manufacturer, model, and protocol
     */
    async findBestDriver(manufacturer, model, protocol) {
        const searchTerms = [];
        
        // Build search terms from manufacturer and model
        if (manufacturer) {
            searchTerms.push(manufacturer.toLowerCase());
        }
        if (model) {
            // Extract key parts of model name
            const modelParts = model.toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(p => p.length > 2);
            searchTerms.push(...modelParts);
        }
        
        logger.info(`Searching drivers with terms: ${searchTerms.join(', ')}`);
        
        // Get list of available drivers
        try {
            const { stdout } = await execCommand('lpinfo -m 2>/dev/null');
            const drivers = stdout.split('\n').filter(l => l.trim());
            
            // Score each driver based on how well it matches
            const scoredDrivers = [];
            
            for (const line of drivers) {
                const parts = line.split(/\s+/);
                const driverPath = parts[0];
                const driverDesc = parts.slice(1).join(' ').toLowerCase();
                const driverName = driverPath.toLowerCase();
                
                let score = 0;
                let matchedTerms = [];
                
                for (const term of searchTerms) {
                    if (driverDesc.includes(term) || driverName.includes(term)) {
                        score += 10;
                        matchedTerms.push(term);
                        
                        // Bonus for exact model match
                        if (model && driverDesc.includes(model.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                            score += 50;
                        }
                    }
                }
                
                // Prefer certain driver types
                if (driverPath.includes('postscript')) score += 5;
                if (driverPath.includes('pcl')) score += 3;
                if (driverPath.includes('pdf')) score += 2;
                
                // Penalize generic drivers slightly
                if (driverPath === 'raw' || driverPath === 'everywhere') {
                    score -= 5;
                }
                
                if (score > 0) {
                    scoredDrivers.push({ driver: driverPath, score, matches: matchedTerms });
                }
            }
            
            // Sort by score descending
            scoredDrivers.sort((a, b) => b.score - a.score);
            
            if (scoredDrivers.length > 0) {
                logger.info(`Best driver match: ${scoredDrivers[0].driver} (score: ${scoredDrivers[0].score}, matches: ${scoredDrivers[0].matches.join(', ')})`);
                return scoredDrivers[0].driver;
            }
            
        } catch (error) {
            logger.warn('Failed to search drivers:', error.message);
        }
        
        // Fallback driver selection based on protocol and manufacturer
        return this.getFallbackDriver(manufacturer, protocol);
    }

    /**
     * Get fallback driver when no specific match is found
     */
    getFallbackDriver(manufacturer, protocol) {
        const manufacturerLower = (manufacturer || '').toLowerCase();
        
        // THERMAL/POS PRINTERS - Always use raw queue for ESC/POS
        const thermalBrands = ['epson tm', 'star', 'munbyn', 'snbc', 'posbank', 'pos bank', 
                              'bematech', 'citizen', 'custom', 'rongta', 'xprinter', 'sewoo',
                              'thermal', 'pos', 'receipt'];
        
        for (const brand of thermalBrands) {
            if (manufacturerLower.includes(brand)) {
                logger.info(`Thermal printer detected (${brand}), using raw driver`);
                return 'raw';
            }
        }
        
        // Check for thermal printer model patterns
        if (manufacturerLower.match(/tm-[a-z0-9]+/i) ||  // Epson TM series
            manufacturerLower.match(/tsp[0-9]+/i) ||    // Star TSP series
            manufacturerLower.match(/btp-[a-z0-9]+/i) || // SNBC BTP series
            manufacturerLower.match(/ct-[a-z0-9]+/i)) {  // Citizen CT series
            logger.info(`Thermal printer model pattern detected, using raw driver`);
            return 'raw';
        }
        
        // For IPP connections, try IPP Everywhere first (driverless printing)
        if (protocol === 'ipp' || protocol === 'ipps') {
            return 'everywhere';
        }
        
        // NETWORK PRINTERS - Try manufacturer-specific drivers
        
        // HP printers - use generic PDF driver or HPLIP
        if (manufacturerLower.includes('hp') || manufacturerLower.includes('hewlett')) {
            return 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd';
        }
        
        // Brother printers
        if (manufacturerLower.includes('brother')) {
            return 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd';
        }
        
        // Kyocera printers - prefer driverless
        if (manufacturerLower.includes('kyocera')) {
            return 'everywhere';
        }
        
        // Canon printers
        if (manufacturerLower.includes('canon')) {
            return 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd';
        }
        
        // Epson network printers (not thermal)
        if (manufacturerLower.includes('epson')) {
            return 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd';
        }
        
        // Xerox, Ricoh, Lexmark - use generic PDF
        if (manufacturerLower.includes('xerox') || 
            manufacturerLower.includes('ricoh') || 
            manufacturerLower.includes('lexmark')) {
            return 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd';
        }
        
        // Default: try driverless for socket connections, otherwise raw
        if (protocol === 'socket') {
            return 'everywhere';
        }
        
        return 'raw';
    }

    /**
     * Add printer with socket protocol (for older printers without IPP)
     */
    async addPrinterSocket({ cupsName, ip, port = 9100, location = '', description = '' }) {
        const safeName = sanitizeForShell(cupsName);
        const safeIp = sanitizeForShell(ip);
        const safePort = parseInt(port) || 9100;
        const safeLocation = sanitizeForShell(location);
        const safeDescription = sanitizeForShell(description);
        
        const uri = `socket://${safeIp}:${safePort}`;
        
        logger.info(`Adding socket printer: ${safeName} at ${uri}`);
        
        try {
            // For socket printers, we still try -m everywhere first
            // CUPS will auto-detect printer capabilities
            let cmd = `lpadmin -p "${safeName}" -v "${uri}" -E -m everywhere`;
            
            if (safeLocation) {
                cmd += ` -L "${safeLocation}"`;
            }
            if (safeDescription) {
                cmd += ` -D "${safeDescription}"`;
            }
            
            await execCommand(cmd);
            await execCommand(`cupsenable "${safeName}"`);
            await execCommand(`cupsaccept "${safeName}"`);
            
            return { success: true, cupsName: safeName, uri };
            
        } catch (error) {
            logger.error(`Failed to add socket printer ${safeName}:`, error);
            return { success: false, error: error.stderr || error.error };
        }
    }

    /**
     * Remove a printer from CUPS
     */
    async deletePrinter(cupsName) {
        const safeName = sanitizeForShell(cupsName);
        
        logger.info(`Deleting printer: ${safeName}`);
        
        try {
            // First reject new jobs
            await execCommand(`cupsreject "${safeName}"`).catch(() => {});
            
            // Disable printer
            await execCommand(`cupsdisable "${safeName}"`).catch(() => {});
            
            // Remove printer
            await execCommand(`lpadmin -x "${safeName}"`);
            
            logger.info(`Printer ${safeName} deleted successfully`);
            return { success: true };
            
        } catch (error) {
            logger.error(`Failed to delete printer ${safeName}:`, error);
            return { success: false, error: error.stderr || error.error };
        }
    }

    /**
     * Get status of a specific printer
     */
    async getPrinterStatus(cupsName) {
        const safeName = sanitizeForShell(cupsName);
        
        try {
            const result = await execCommand(`lpstat -p "${safeName}"`);
            const output = result.stdout.toLowerCase();
            
            let status = 'unknown';
            if (output.includes('idle')) {
                status = 'online';
            } else if (output.includes('printing')) {
                status = 'printing';
            } else if (output.includes('disabled') || output.includes('paused')) {
                status = 'paused';
            } else if (output.includes('not accepting') || output.includes('offline')) {
                status = 'offline';
            } else if (output.includes('error')) {
                status = 'error';
            } else if (output.includes('enabled')) {
                status = 'online';
            }
            
            return { success: true, status, raw: result.stdout };
            
        } catch (error) {
            // Printer might not exist in CUPS
            if (error.stderr?.includes('Unknown destination')) {
                return { success: false, status: 'not_found', error: 'Printer not in CUPS' };
            }
            return { success: false, status: 'error', error: error.stderr || error.error };
        }
    }

    /**
     * Get status of all printers in CUPS
     */
    async listAllPrinters() {
        try {
            const result = await execCommand('lpstat -p -d');
            const lines = result.stdout.split('\n').filter(l => l.trim());
            
            const printers = [];
            let defaultPrinter = null;
            
            for (const line of lines) {
                // Parse default printer
                if (line.includes('system default destination:')) {
                    defaultPrinter = line.split(':')[1]?.trim();
                    continue;
                }
                
                // Parse printer status lines
                // Format: "printer PrinterName is idle."
                const match = line.match(/^printer\s+(\S+)\s+(.+)$/i);
                if (match) {
                    const name = match[1];
                    const statusText = match[2].toLowerCase();
                    
                    let status = 'unknown';
                    if (statusText.includes('idle')) status = 'online';
                    else if (statusText.includes('printing')) status = 'printing';
                    else if (statusText.includes('disabled')) status = 'paused';
                    else if (statusText.includes('enabled')) status = 'online';
                    
                    printers.push({
                        cupsName: name,
                        status,
                        isDefault: name === defaultPrinter,
                        statusText: match[2]
                    });
                }
            }
            
            return { success: true, printers, defaultPrinter };
            
        } catch (error) {
            logger.error('Failed to list printers:', error);
            return { success: false, printers: [], error: error.stderr || error.error };
        }
    }

    /**
     * Set default printer
     */
    async setDefaultPrinter(cupsName) {
        const safeName = sanitizeForShell(cupsName);
        
        try {
            await execCommand(`lpoptions -d "${safeName}"`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.stderr || error.error };
        }
    }

    /**
     * Test connectivity to printer IP
     */
    async testConnection(ip) {
        if (!isValidIP(ip)) {
            return { success: false, error: 'Invalid IP address' };
        }
        
        const pingResult = await pingHost(ip, 3, 2);
        
        if (pingResult.success) {
            return {
                success: true,
                message: 'Printer is reachable',
                details: pingResult
            };
        } else {
            return {
                success: false,
                error: 'Printer not reachable',
                details: pingResult
            };
        }
    }

    /**
     * Print a test page
     */
    async testPrint(cupsName) {
        const safeName = sanitizeForShell(cupsName);
        const timestamp = new Date().toISOString();
        
        try {
            // Print a simple test message
            const cmd = `echo "Test Print - ${timestamp}\\nPrinter Management System\\nThis is a test page." | lp -d "${safeName}"`;
            const result = await execCommand(cmd);
            
            // Parse job ID from output
            // Output format: "request id is PrinterName-123 (1 file(s))"
            const match = result.stdout.match(/request id is (\S+)/);
            const jobId = match ? match[1] : null;
            
            return { 
                success: true, 
                message: 'Test page sent',
                jobId,
                raw: result.stdout
            };
            
        } catch (error) {
            return { success: false, error: error.stderr || error.error };
        }
    }

    /**
     * Cancel a print job
     */
    async cancelJob(jobId) {
        const safeJobId = sanitizeForShell(jobId);
        
        try {
            await execCommand(`cancel "${safeJobId}"`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.stderr || error.error };
        }
    }

    /**
     * Get print jobs for a printer
     */
    async getJobs(cupsName = null) {
        try {
            let cmd = 'lpstat -o';
            if (cupsName) {
                cmd = `lpstat -o "${sanitizeForShell(cupsName)}"`;
            }
            
            const result = await execCommand(cmd);
            const lines = result.stdout.split('\n').filter(l => l.trim());
            
            const jobs = lines.map(line => {
                // Format: "PrinterName-123 user 1024 Mon Jan 01 12:00:00 2024"
                const parts = line.split(/\s+/);
                return {
                    jobId: parts[0],
                    user: parts[1],
                    size: parseInt(parts[2]) || 0,
                    submitted: parts.slice(3).join(' ')
                };
            });
            
            return { success: true, jobs };
            
        } catch (error) {
            // No jobs is not an error
            if (error.stdout === '' || error.stderr?.includes('no entries')) {
                return { success: true, jobs: [] };
            }
            return { success: false, jobs: [], error: error.stderr || error.error };
        }
    }

    /**
     * Auto-discover printers on network using Avahi
     */
    async discoverPrinters() {
        logger.info('Starting printer discovery via Avahi...');
        
        try {
            // Browse for IPP printers (most modern printers)
            const result = await execCommand('avahi-browse -rt _ipp._tcp --parsable', { timeout: 30000 });
            
            const printers = [];
            const lines = result.stdout.split('\n').filter(l => l.startsWith('='));
            
            for (const line of lines) {
                // Parsable format: =;interface;protocol;name;type;domain;hostname;address;port;txt
                const parts = line.split(';');
                if (parts.length >= 9) {
                    const name = parts[3];
                    const hostname = parts[6];
                    const ip = parts[7];
                    const port = parseInt(parts[8]) || 631;
                    
                    // Avoid duplicates by IP
                    if (!printers.find(p => p.ip === ip)) {
                        printers.push({
                            name,
                            hostname,
                            ip,
                            port,
                            protocol: 'ipp',
                            discovered: true
                        });
                    }
                }
            }
            
            logger.info(`Discovered ${printers.length} printers`);
            return { success: true, printers };
            
        } catch (error) {
            logger.error('Printer discovery failed:', error);
            
            // Avahi might not be running
            if (error.stderr?.includes('not found') || error.stderr?.includes('No such file')) {
                return { 
                    success: false, 
                    printers: [], 
                    error: 'Avahi service not available. Install avahi-tools for auto-discovery.'
                };
            }
            
            return { success: false, printers: [], error: error.stderr || error.error };
        }
    }

    /**
     * Get printer information from CUPS
     */
    async getPrinterInfo(cupsName) {
        const safeName = sanitizeForShell(cupsName);
        
        try {
            const result = await execCommand(`lpoptions -p "${safeName}" -l`);
            
            // Parse options
            const options = {};
            const lines = result.stdout.split('\n');
            
            for (const line of lines) {
                const match = line.match(/^(\S+)\/([^:]+):\s*(.+)$/);
                if (match) {
                    options[match[1]] = {
                        displayName: match[2],
                        values: match[3].split(/\s+/)
                    };
                }
            }
            
            return { success: true, options };
            
        } catch (error) {
            return { success: false, error: error.stderr || error.error };
        }
    }
}

module.exports = new CupsService();
