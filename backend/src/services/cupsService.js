// ===========================================
// CUPS Service - Printer Management via Shell
// ===========================================

const { execCommand, execCupsCommand, pingHost, sanitizeForShell, isValidIP } = require('../utils/shellExec');
const { DRIVER_DATABASE, THERMAL_DATABASE, GENERIC_DRIVERS } = require('./driverDatabase');
const logger = require('../utils/logger');

class CupsService {
    
    constructor() {
        // Cache available drivers
        this.availableDrivers = null;
        this.driversCacheTime = 0;
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }

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
            
            const addResult = await execCupsCommand(cmd);
            logger.info(`lpadmin result: ${JSON.stringify(addResult)}`);
            
            // Enable the printer
            await execCupsCommand(`cupsenable "${safeName}"`);
            
            // Accept jobs
            await execCupsCommand(`cupsaccept "${safeName}"`);
            
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
     * Uses driver database + intelligent matching
     */
    async findBestDriver(manufacturer, model, protocol) {
        const mfrLower = (manufacturer || '').toLowerCase();
        const modelLower = (model || '').toLowerCase();
        const fullText = `${mfrLower} ${modelLower}`;
        
        logger.info(`Finding driver for: manufacturer="${manufacturer}", model="${model}", protocol="${protocol}"`);

        // Step 1: Check if it's a thermal printer
        const thermalDriver = this.checkThermalPrinter(fullText);
        if (thermalDriver) {
            logger.info(`Thermal printer detected, using: ${thermalDriver}`);
            return thermalDriver;
        }

        // Step 2: Identify manufacturer from database
        const mfrData = this.identifyManufacturer(fullText);
        
        // Step 3: Get available drivers on this system
        const availableDrivers = await this.getAvailableDrivers();
        
        // Step 4: Try to find specific model driver
        if (mfrData && mfrData.models) {
            for (const [modelPattern, modelConfig] of Object.entries(mfrData.models)) {
                if (modelLower.includes(modelPattern.toLowerCase())) {
                    logger.info(`Model pattern matched: "${modelPattern}"`);
                    
                    // Search for this specific driver
                    const foundDriver = await this.searchDriver(modelConfig.search, availableDrivers);
                    if (foundDriver) {
                        logger.info(`Found model-specific driver: ${foundDriver}`);
                        return foundDriver;
                    }
                }
            }
        }

        // Step 5: Try manufacturer's preferred drivers
        if (mfrData && mfrData.preferredDrivers) {
            for (const driverName of mfrData.preferredDrivers) {
                const foundDriver = await this.searchDriver([driverName], availableDrivers);
                if (foundDriver) {
                    logger.info(`Found manufacturer preferred driver: ${foundDriver}`);
                    return foundDriver;
                }
            }
        }

        // Step 6: Try manufacturer's fallback drivers
        if (mfrData && mfrData.fallbackDrivers) {
            for (const driverName of mfrData.fallbackDrivers) {
                const foundDriver = await this.searchDriver([driverName], availableDrivers);
                if (foundDriver) {
                    logger.info(`Found manufacturer fallback driver: ${foundDriver}`);
                    return foundDriver;
                }
            }
        }

        // Step 7: Use generic driver based on protocol
        const genericDriver = this.getGenericDriver(protocol, mfrData);
        logger.info(`Using generic driver: ${genericDriver}`);
        return genericDriver;
    }

    /**
     * Check if printer is thermal/POS and return appropriate driver
     */
    checkThermalPrinter(text) {
        const lower = text.toLowerCase();
        
        // Check known thermal brands
        for (const [brand, data] of Object.entries(THERMAL_DATABASE)) {
            if (lower.includes(brand) || lower.includes(data.name.toLowerCase())) {
                return 'raw';
            }
            // Check model patterns
            for (const model of data.models) {
                if (lower.includes(model.toLowerCase())) {
                    return 'raw';
                }
            }
        }
        
        // Check thermal patterns
        const thermalPatterns = [
            /tm-[a-z]?\d+/i,  // Epson TM series
            /tsp\d+/i,        // Star TSP series
            /btp-[a-z]?\d+/i, // SNBC BTP series
            /ct-[a-z]\d+/i,   // Citizen CT series
            /receipt/i,
            /thermal/i,
            /pos.?printer/i,
            /esc.?pos/i,
        ];
        
        for (const pattern of thermalPatterns) {
            if (pattern.test(lower)) {
                return 'raw';
            }
        }
        
        return null;
    }

    /**
     * Identify manufacturer from text
     */
    identifyManufacturer(text) {
        const lower = text.toLowerCase();
        
        for (const [key, data] of Object.entries(DRIVER_DATABASE)) {
            // Check main name
            if (lower.includes(key)) {
                return data;
            }
            // Check aliases
            if (data.aliases) {
                for (const alias of data.aliases) {
                    if (lower.includes(alias.toLowerCase())) {
                        return data;
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Get available drivers on the system (cached)
     */
    async getAvailableDrivers() {
        const now = Date.now();
        
        if (this.availableDrivers && (now - this.driversCacheTime) < this.CACHE_TTL) {
            return this.availableDrivers;
        }
        
        try {
            const { stdout } = await execCupsCommand('lpinfo -m 2>/dev/null');
            const lines = stdout.split('\n').filter(l => l.trim());
            
            this.availableDrivers = lines.map(line => {
                const parts = line.split(/\s+/);
                const ppd = parts[0];
                const description = parts.slice(1).join(' ');
                return { ppd, description, lower: `${ppd} ${description}`.toLowerCase() };
            });
            
            this.driversCacheTime = now;
            logger.info(`Cached ${this.availableDrivers.length} available drivers`);
            
            return this.availableDrivers;
        } catch (error) {
            logger.warn('Failed to get available drivers:', error.message);
            return [];
        }
    }

    /**
     * Search for a driver in available drivers
     */
    async searchDriver(searchTerms, availableDrivers) {
        if (!searchTerms || searchTerms.length === 0) return null;
        
        // Score each driver
        const scored = [];
        
        for (const driver of availableDrivers) {
            let score = 0;
            
            for (const term of searchTerms) {
                const termLower = term.toLowerCase();
                
                // Exact PPD match (highest priority)
                if (driver.ppd.toLowerCase() === termLower) {
                    score += 100;
                }
                // PPD contains term
                else if (driver.ppd.toLowerCase().includes(termLower)) {
                    score += 50;
                }
                // Description contains term
                else if (driver.description.toLowerCase().includes(termLower)) {
                    score += 30;
                }
            }
            
            // Bonus for known quality drivers
            if (driver.ppd.includes('hplip')) score += 15;
            if (driver.ppd.includes('gutenprint')) score += 10;
            if (driver.ppd.includes('Postscript')) score += 8;
            if (driver.ppd.includes('escpr')) score += 8;
            if (driver.ppd.includes('brlaser')) score += 8;
            if (driver.ppd.includes('splix')) score += 8;
            
            // Penalize generic/fallback
            if (driver.ppd === 'raw') score -= 20;
            if (driver.ppd === 'everywhere') score -= 10;
            
            if (score > 0) {
                scored.push({ driver: driver.ppd, score, desc: driver.description });
            }
        }
        
        // Sort by score
        scored.sort((a, b) => b.score - a.score);
        
        if (scored.length > 0) {
            logger.debug(`Driver search results: ${scored.slice(0, 3).map(s => `${s.driver}(${s.score})`).join(', ')}`);
            return scored[0].driver;
        }
        
        return null;
    }

    /**
     * Get generic driver based on protocol and manufacturer
     */
    getGenericDriver(protocol, mfrData) {
        // If manufacturer has IPP Everywhere support and protocol is IPP
        if (mfrData?.ippEverywhereSupport && (protocol === 'ipp' || protocol === 'ipps')) {
            return 'everywhere';
        }
        
        // Use generic driver from database if manufacturer known
        if (mfrData?.genericDriver) {
            return mfrData.genericDriver;
        }
        
        // Protocol-based fallback
        const protocolDrivers = GENERIC_DRIVERS[protocol] || GENERIC_DRIVERS.socket;
        return protocolDrivers.primary;
    }

    /**
     * Get fallback driver when no specific match is found (legacy compatibility)
     */
    getFallbackDriver(manufacturer, protocol) {
        const mfrData = this.identifyManufacturer(manufacturer || '');
        return this.getGenericDriver(protocol, mfrData);
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
            
            await execCupsCommand(cmd);
            await execCupsCommand(`cupsenable "${safeName}"`);
            await execCupsCommand(`cupsaccept "${safeName}"`);
            
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
            await execCupsCommand(`cupsreject "${safeName}"`).catch(() => {});
            
            // Disable printer
            await execCupsCommand(`cupsdisable "${safeName}"`).catch(() => {});
            
            // Remove printer
            await execCupsCommand(`lpadmin -x "${safeName}"`);
            
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
            const result = await execCupsCommand(`lpstat -p "${safeName}"`);
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
            const result = await execCupsCommand('lpstat -p -d');
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
            await execCupsCommand(`lpoptions -d "${safeName}"`);
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
            const result = await execCupsCommand(cmd);
            
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
            await execCupsCommand(`cancel "${safeJobId}"`);
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
            
            const result = await execCupsCommand(cmd);
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
            const result = await execCupsCommand(`lpoptions -p "${safeName}" -l`);
            
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
