// ===========================================
// CUPS Service v2 - Auto-detection + Sync
// ===========================================

const { execCommand, sanitizeForShell } = require('../utils/shellExec');
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
     * Add printer to CUPS with auto-detected or specified driver
     */
    async addPrinter({ name, ip, port = 9100, protocol = 'socket', location = '', description = '', driver = null, skipDetection = false }) {
        const cupsName = this.generateCupsName(name);
        const safeLocation = sanitizeForShell(location || '');
        const safeDescription = sanitizeForShell(description || '');
        
        logger.info(`Adding printer: ${cupsName} at ${ip}:${port}`);
        
        try {
            // Use raw driver by default for speed, or auto-detect if requested
            let selectedDriver = driver;
            let detectedInfo = null;
            
            if (!selectedDriver) {
                if (!skipDetection) {
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
            await execCommand(`lpadmin -x "${cupsName}" 2>/dev/null`).catch(() => {});
            
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
            
            const result = await execCommand(cmd);
            
            if (!result.success && result.stderr && !result.stderr.includes('deprecated')) {
                throw new Error(result.stderr);
            }
            
            // Enable and accept jobs
            await execCommand(`cupsenable "${cupsName}"`);
            await execCommand(`cupsaccept "${cupsName}"`);
            
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
            await execCommand(`lpadmin -x "${cupsName}"`);
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
            const result = await execCommand(`lpstat -p "${cupsName}" 2>/dev/null`);
            
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
            const result = await execCommand('lpstat -p -d 2>/dev/null');
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
            
            const result = await execCommand(cmd);
            
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
            
            const result = await execCommand(cmd);
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
            await execCommand(`cancel ${jobId}`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Print test page
     */
    async printTestPage(cupsName) {
        const testContent = `
╔══════════════════════════════════════════════════════════╗
║           PRINTER MANAGEMENT SYSTEM                     ║
║                  TEST PAGE                              ║
╚══════════════════════════════════════════════════════════╝

Printer: ${cupsName}
Date: ${new Date().toLocaleString()}
Server: Docker/CUPS

────────────────────────────────────────────────────────────

This test page confirms that your printer is configured
correctly and can receive print jobs from the Print Server.

If you can read this page clearly:
✓ Network connection is working
✓ Printer driver is compatible
✓ Print queue is functioning

────────────────────────────────────────────────────────────

    ████████████████████████████████████████
    █                                      █
    █   GRAYSCALE TEST                     █
    █   ░░░░▒▒▒▒▓▓▓▓████                   █
    █   Light  Mid  Dark  Black            █
    █                                      █
    ████████████████████████████████████████

────────────────────────────────────────────────────────────
                    Print Server v1.0
────────────────────────────────────────────────────────────
`;
        
        return await this.printText(cupsName, testContent, 'Test Page');
    }

    /**
     * Get toner/supply levels (if supported)
     */
    async getTonerLevels(ip) {
        return await printerDetection.getTonerViaSNMP(ip);
    }
}

module.exports = new CupsService();
