// ===========================================
// CUPS Service v2 - Auto-detection + Sync
// ===========================================

const { execCommand, execCupsCommand, sanitizeForShell } = require('../utils/shellExec');
const logger = require('../utils/logger');
const printerDetection = require('./printerDetection');

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
     * Detect printer and get recommended configuration
     */
    async detectPrinter(ip, port = 9100) {
        return await printerDetection.detectPrinter(ip, port);
    }

    /**
     * Get available drivers
     */
    async getAvailableDrivers() {
        return await printerDetection.getAvailableDrivers();
    }

    /**
     * Get recommended driver based on printer name/model
     * Returns specific drivers for known printer types
     */
    getRecommendedDriver(name, manufacturer, model) {
        const nameUpper = (name || '').toUpperCase();
        const modelUpper = (model || '').toUpperCase();
        const mfgUpper = (manufacturer || '').toUpperCase();
        
        // Epson TM-U series (Impact/Dot Matrix receipt printers)
        if ((nameUpper.includes('TM-U') || modelUpper.includes('TM-U') || 
             nameUpper.includes('TMU') || modelUpper.includes('TMU')) &&
            (mfgUpper.includes('EPSON') || nameUpper.includes('EPSON'))) {
            return {
                driver: 'EPSON/tm-impact-receipt-rastertotmir.ppd',
                type: 'impact',
                name: 'EPSON TM Impact Receipt'
            };
        }
        
        // Epson TM-T series (Thermal receipt printers)
        if ((nameUpper.includes('TM-T') || modelUpper.includes('TM-T') ||
             nameUpper.includes('TMT') || modelUpper.includes('TMT')) &&
            (mfgUpper.includes('EPSON') || nameUpper.includes('EPSON'))) {
            return {
                driver: 'EPSON/tm-ba-thermal-rastertotmtr-203.ppd',
                type: 'thermal',
                name: 'EPSON TM Thermal (203dpi)'
            };
        }
        
        // Generic Epson thermal
        if (mfgUpper.includes('EPSON') && (nameUpper.includes('THERMAL') || modelUpper.includes('THERMAL'))) {
            return {
                driver: 'EPSON/tm-ba-thermal-rastertotmtr-203.ppd',
                type: 'thermal',
                name: 'EPSON TM Thermal (203dpi)'
            };
        }
        
        // Generic Epson impact
        if (mfgUpper.includes('EPSON') && (nameUpper.includes('IMPACT') || modelUpper.includes('IMPACT') ||
            nameUpper.includes('MATRIX') || modelUpper.includes('MATRIX'))) {
            return {
                driver: 'EPSON/tm-impact-receipt-rastertotmir.ppd',
                type: 'impact',
                name: 'EPSON TM Impact Receipt'
            };
        }
        
        // Default: use raw (works with most thermal printers via ESC/POS)
        return {
            driver: 'raw',
            type: 'generic',
            name: 'Generic RAW'
        };
    }

    /**
     * Add printer to CUPS with auto-detected or specified driver
     */
    async addPrinter({ name, ip, port = 9100, protocol = 'socket', location = '', description = '', driver = null, skipDetection = false, manufacturer = '', model = '' }) {
        const cupsName = this.generateCupsName(name);
        const safeLocation = sanitizeForShell(location || '');
        const safeDescription = sanitizeForShell(description || '');
        
        logger.info(`Adding printer: ${cupsName} at ${ip}:${port}`);
        
        try {
            // Use raw driver by default for speed, or auto-detect if requested
            let selectedDriver = driver;
            let detectedInfo = null;
            let driverInfo = null;
            
            if (!selectedDriver) {
                // First, check if we can recommend a driver based on name/model
                driverInfo = this.getRecommendedDriver(name, manufacturer, model);
                
                if (driverInfo.type !== 'generic') {
                    selectedDriver = driverInfo.driver;
                    logger.info(`Recommended driver for ${name}: ${driverInfo.name} (${driverInfo.driver})`);
                } else if (!skipDetection) {
                    try {
                        // Set a timeout for detection (5 seconds max)
                        const detectionPromise = this.detectPrinter(ip, port);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Detection timeout')), 5000)
                        );
                        detectedInfo = await Promise.race([detectionPromise, timeoutPromise]);
                        
                        if (detectedInfo && detectedInfo.suggestedDriver) {
                            selectedDriver = detectedInfo.suggestedDriver.driver;
                            logger.info(`Auto-detected: ${detectedInfo.manufacturer} ${detectedInfo.model}, using driver: ${selectedDriver}`);
                        }
                        
                        // Check if detected info suggests a specific driver
                        if (detectedInfo && (detectedInfo.manufacturer || detectedInfo.model)) {
                            driverInfo = this.getRecommendedDriver(name, detectedInfo.manufacturer, detectedInfo.model);
                            if (driverInfo.type !== 'generic') {
                                selectedDriver = driverInfo.driver;
                                logger.info(`Using detected model driver: ${driverInfo.name}`);
                            }
                        }
                    } catch (e) {
                        logger.info(`Detection skipped or timed out: ${e.message}`);
                    }
                }
                
                // Fallback to raw (works with most printers)
                if (!selectedDriver) {
                    selectedDriver = 'raw';
                    logger.info('Using raw driver (universal)');
                }
            }
            
            // Build URI based on protocol
            let uri;
            switch (protocol) {
                case 'ipp':
                    uri = `ipp://${ip}:631/ipp/print`;
                    break;
                case 'ipps':
                    uri = `ipps://${ip}:631/ipp/print`;
                    break;
                case 'lpd':
                    uri = `lpd://${ip}/queue`;
                    break;
                case 'socket':
                default:
                    uri = `socket://${ip}:${port}`;
                    break;
            }
            
            // Remove existing printer if exists
            await execCupsCommand(`lpadmin -x "${cupsName}" 2>/dev/null`).catch(() => {});
            
            // Add printer with driver
            let cmd;
            if (selectedDriver === 'everywhere') {
                // IPP Everywhere (driverless)
                cmd = `lpadmin -p "${cupsName}" -v "ipp://${ip}:631/ipp/print" -E -m everywhere`;
            } else {
                // Specific driver
                cmd = `lpadmin -p "${cupsName}" -v "${uri}" -E -m "${selectedDriver}"`;
            }
            
            if (safeLocation) {
                cmd += ` -L "${safeLocation}"`;
            }
            if (safeDescription) {
                cmd += ` -D "${safeDescription}"`;
            }
            
            const result = await execCupsCommand(cmd);
            
            if (!result.success && result.stderr && !result.stderr.includes('deprecated')) {
                throw new Error(result.stderr);
            }
            
            // Enable and accept jobs
            await execCupsCommand(`cupsenable "${cupsName}"`);
            await execCupsCommand(`cupsaccept "${cupsName}"`);
            
            logger.info(`Printer ${cupsName} added successfully`);
            
            return {
                success: true,
                cupsName,
                uri,
                driver: selectedDriver,
                detected: detectedInfo,
                message: 'Printer added successfully'
            };
            
        } catch (error) {
            logger.error(`Failed to add printer:`, error);
            return {
                success: false,
                error: error.message || 'Failed to add printer to CUPS'
            };
        }
    }

    /**
     * Remove printer from CUPS
     */
    async removePrinter(cupsName) {
        try {
            await execCupsCommand(`lpadmin -x "${cupsName}"`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Alias for removePrinter (for compatibility)
     */
    async deletePrinter(cupsName) {
        return this.removePrinter(cupsName);
    }

    /**
     * Get printer status from CUPS
     */
    async getPrinterStatus(cupsName) {
        try {
            const result = await execCupsCommand(`lpstat -p "${cupsName}" 2>/dev/null`);
            
            if (result.success && result.stdout) {
                const output = result.stdout.toLowerCase();
                
                if (output.includes('idle')) {
                    return { status: 'online', message: 'Printer is idle and ready' };
                } else if (output.includes('printing')) {
                    return { status: 'printing', message: 'Printer is currently printing' };
                } else if (output.includes('disabled')) {
                    return { status: 'offline', message: 'Printer is disabled' };
                } else if (output.includes('paused')) {
                    return { status: 'paused', message: 'Printer is paused' };
                }
            }
            
            return { status: 'unknown', message: 'Unable to determine status' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    /**
     * List all CUPS printers
     */
    async listPrinters() {
        try {
            const result = await execCupsCommand('lpstat -p -d 2>/dev/null');
            const printers = [];
            
            if (result.success && result.stdout) {
                const lines = result.stdout.split('\n');
                
                for (const line of lines) {
                    const match = line.match(/^printer\s+(\S+)\s+(.+)/);
                    if (match) {
                        const name = match[1];
                        const statusText = match[2].toLowerCase();
                        
                        let status = 'unknown';
                        if (statusText.includes('idle')) status = 'online';
                        else if (statusText.includes('printing')) status = 'printing';
                        else if (statusText.includes('disabled')) status = 'offline';
                        
                        printers.push({ name, status, statusText: match[2] });
                    }
                }
            }
            
            return printers;
        } catch (error) {
            logger.error('Failed to list printers:', error);
            return [];
        }
    }

    /**
     * Print a file
     */
    async printFile(cupsName, filePath, options = {}) {
        try {
            let cmd = `lp -d "${cupsName}"`;
            
            // Add options
            if (options.copies && options.copies > 1) {
                cmd += ` -n ${parseInt(options.copies)}`;
            }
            if (options.duplex) {
                cmd += ` -o sides=two-sided-long-edge`;
            }
            if (options.color === false) {
                cmd += ` -o ColorModel=Gray`;
            }
            if (options.paperSize) {
                cmd += ` -o media=${options.paperSize}`;
            }
            
            cmd += ` "${filePath}"`;
            
            const result = await execCupsCommand(cmd);
            
            if (result.success) {
                // Extract job ID
                const match = result.stdout.match(/request id is (\S+)/);
                const jobId = match ? match[1] : null;
                
                return { success: true, jobId, message: 'Print job submitted' };
            }
            
            return { success: false, error: result.stderr || 'Failed to submit print job' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Print text directly
     */
    async printText(cupsName, text, title = 'Text Print') {
        try {
            // Create temp file
            const fs = require('fs');
            const path = require('path');
            const tmpFile = path.join('/tmp', `print_${Date.now()}.txt`);
            
            fs.writeFileSync(tmpFile, text);
            
            const result = await this.printFile(cupsName, tmpFile, { title });
            
            // Clean up
            fs.unlinkSync(tmpFile);
            
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get print jobs
     * @param {string} cupsName - Printer CUPS name (optional, filters results)
     * @param {string|boolean} filter - 'all', 'completed', 'not-completed', or boolean for completed
     */
    async getJobs(cupsName = null, filter = 'not-completed') {
        try {
            let cmd = 'lpstat -W ';
            
            // Handle different filter types
            if (filter === 'all' || filter === true) {
                cmd += 'all';
            } else if (filter === 'completed') {
                cmd += 'completed';
            } else {
                cmd += 'not-completed';
            }
            
            // Don't use -p flag as it shows printer status instead of jobs
            // We'll filter by cupsName in code below
            
            const result = await execCupsCommand(cmd);
            const jobs = [];
            
            if (result.success && result.stdout) {
                const lines = result.stdout.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    // Format: PrinterName-JobID  owner  size  date
                    const match = line.match(/^(\S+)-(\d+)\s+(\S+)\s+(\d+)\s+(.+)$/);
                    if (match) {
                        const printerName = match[1];
                        
                        // Filter by cupsName if specified
                        if (cupsName && printerName !== cupsName) {
                            continue;
                        }
                        
                        jobs.push({
                            printer: printerName,
                            jobId: parseInt(match[2]),
                            fullJobId: `${printerName}-${match[2]}`,
                            owner: match[3],
                            size: parseInt(match[4]),
                            date: match[5].trim()
                        });
                    }
                }
            }
            
            return jobs;
        } catch (error) {
            logger.error('Failed to get jobs:', error);
            return [];
        }
    }

    /**
     * Cancel a print job
     */
    async cancelJob(jobId) {
        try {
            await execCupsCommand(`cancel ${jobId}`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Print test page - auto-detects thermal vs regular printer
     */
    async printTestPage(cupsName) {
        // Check if this looks like a thermal printer by name patterns
        const thermalPatterns = /thermal|receipt|pos|epson|tm-|tsp|snbc|btp|star|citizen/i;
        const isThermal = thermalPatterns.test(cupsName);
        
        if (isThermal) {
            return await this.printThermalTestPage(cupsName);
        }
        
        // Regular printer - use text
        const testContent = `
================================
   PRINTER MANAGEMENT SYSTEM
        TEST PAGE
================================

Printer: ${cupsName}
Date: ${new Date().toLocaleString()}
Server: Docker/CUPS

--------------------------------

This test page confirms that your
printer is configured correctly.

If you can read this page clearly:
- Network connection is working
- Printer driver is compatible
- Print queue is functioning

--------------------------------
      Print Server v1.0
================================
`;
        
        return await this.printText(cupsName, testContent, 'Test Page');
    }

    /**
     * Print thermal test page with ESC/POS commands and auto-cut
     */
    async printThermalTestPage(cupsName) {
        try {
            const timestamp = new Date().toLocaleString();
            
            // ESC/POS commands:
            // \x1b\x40 = Initialize printer
            // \x1b\x61\x01 = Center align
            // \x1b\x45\x01 = Bold on
            // \x1b\x45\x00 = Bold off
            // \x1b\x61\x00 = Left align
            // \x1b\x64\x05 = Feed 5 lines
            // \x1d\x56\x00 = Full cut
            
            const escposData = Buffer.concat([
                Buffer.from('\x1b\x40'),           // Initialize
                Buffer.from('\x1b\x61\x01'),       // Center align
                Buffer.from('\x1b\x45\x01'),       // Bold ON
                Buffer.from('================================\n'),
                Buffer.from('   PRINT SERVER TEST\n'),
                Buffer.from('================================\n'),
                Buffer.from('\x1b\x45\x00'),       // Bold OFF
                Buffer.from('\n'),
                Buffer.from(`Printer: ${cupsName}\n`),
                Buffer.from(`Date: ${timestamp}\n`),
                Buffer.from('\n'),
                Buffer.from('--------------------------------\n'),
                Buffer.from('\x1b\x61\x00'),       // Left align
                Buffer.from('If you can read this:\n'),
                Buffer.from('  [OK] Network working\n'),
                Buffer.from('  [OK] CUPS configured\n'),
                Buffer.from('  [OK] Ready to print\n'),
                Buffer.from('--------------------------------\n'),
                Buffer.from('\x1b\x61\x01'),       // Center align
                Buffer.from('Print Server v1.0\n'),
                Buffer.from('\n\n\n'),
                Buffer.from('\x1b\x64\x14'),       // Feed 20 lines (for paper to clear cutter)
                Buffer.from('\x1d\x56\x00'),       // Full cut
            ]);
            
            // Write to temp file
            const fs = require('fs');
            const path = require('path');
            const tmpFile = path.join('/tmp', `thermal_test_${Date.now()}.bin`);
            fs.writeFileSync(tmpFile, escposData);
            
            // Print with raw option
            const cmd = `lp -d "${cupsName}" -o raw "${tmpFile}"`;
            const result = await execCupsCommand(cmd);
            
            // Clean up
            fs.unlinkSync(tmpFile);
            
            if (result.success) {
                const match = result.stdout.match(/request id is (\S+)/);
                const jobId = match ? match[1] : null;
                return { success: true, jobId, message: 'Thermal test page sent' };
            }
            
            return { success: false, error: result.stderr || 'Failed to print' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get toner/supply levels (if supported)
     */
    async getTonerLevels(ip) {
        return await printerDetection.getTonerViaSNMP(ip);
    }
}

module.exports = new CupsService();
