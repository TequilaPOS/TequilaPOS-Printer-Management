// ===========================================
// Thermal Printer Service - Direct Printing Support
// ===========================================
// Based on patterns from node-thermal-printer and escpos
// Supports: EPSON, STAR, BIXOLON, MUNBYN, SNBC, POSBANK, BLOGIC, and ESC/POS compatible

const net = require('net');
const logger = require('../utils/logger');

// ESC/POS Commands
const ESC = '\x1b';
const GS = '\x1d';
const FS = '\x1c';

class ThermalPrinterService {
    
    constructor() {
        // Printer types with their specific command sets
        this.printerTypes = {
            EPSON: 'epson',        // TM-T20, TM-U220, TM-T88
            STAR: 'star',          // TSP100, TSP650, TSP143
            BIXOLON: 'bixolon',    // SRP-E300, SRP-350
            MUNBYN: 'munbyn',      // ITPP068, ITPP047 (ESC/POS compatible)
            SNBC: 'snbc',          // BTP-R180 (ESC/POS compatible)
            POSBANK: 'posbank',    // A11 PRIME (ESC/POS compatible)
            BLOGIC: 'blogic',      // S11 (ESC/POS compatible)
            CUSTOM: 'custom',
            BEMATECH: 'bematech',
            DARUMA: 'daruma',
            BROTHER: 'brother'
        };
        
        // Brands that use standard ESC/POS (EPSON compatible)
        this.escposCompatible = [
            'epson', 'munbyn', 'snbc', 'posbank', 'blogic', 
            'bixolon', 'custom', 'bematech', 'kwickpos', 'mapletouch'
        ];
        
        // Connection interfaces
        this.interfaces = {
            TCP: 'tcp',
            USB: 'usb',
            SERIAL: 'serial',
            CUPS: 'cups'
        };
    }

    /**
     * Test direct TCP connection to thermal printer
     * Most thermal printers listen on port 9100
     */
    async testTcpConnection(ip, port = 9100, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let connected = false;
            
            const timer = setTimeout(() => {
                if (!connected) {
                    socket.destroy();
                    reject(new Error(`Connection timeout after ${timeout}ms`));
                }
            }, timeout);
            
            socket.connect(port, ip, () => {
                connected = true;
                clearTimeout(timer);
                socket.end();
                resolve({ success: true, ip, port });
            });
            
            socket.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Connection failed: ${err.message}`));
            });
        });
    }

    /**
     * Send raw data to printer via TCP
     */
    async sendTcp(ip, port, data, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let completed = false;
            
            const timer = setTimeout(() => {
                if (!completed) {
                    socket.destroy();
                    reject(new Error(`Send timeout after ${timeout}ms`));
                }
            }, timeout);
            
            socket.connect(port, ip, () => {
                logger.info(`Connected to printer at ${ip}:${port}`);
                socket.write(data, (err) => {
                    if (err) {
                        clearTimeout(timer);
                        socket.destroy();
                        reject(err);
                        return;
                    }
                    
                    // Give printer time to process
                    setTimeout(() => {
                        completed = true;
                        clearTimeout(timer);
                        socket.end();
                        resolve({ success: true, bytesWritten: data.length });
                    }, 500);
                });
            });
            
            socket.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`TCP error: ${err.message}`));
            });
        });
    }

    /**
     * Auto-detect printer type by sending status request
     */
    async detectPrinterType(ip, port = 9100) {
        try {
            // Try to get printer status using ESC/POS command
            const statusCmd = Buffer.from([0x1D, 0x61, 0x01]); // GS a n - enable automatic status back
            
            return new Promise((resolve, reject) => {
                const socket = new net.Socket();
                let response = Buffer.alloc(0);
                
                const timer = setTimeout(() => {
                    socket.destroy();
                    // If no response but connected, assume EPSON compatible
                    resolve({ type: 'epson', detected: false, reason: 'timeout_assumed' });
                }, 3000);
                
                socket.connect(port, ip, () => {
                    socket.write(statusCmd);
                });
                
                socket.on('data', (data) => {
                    response = Buffer.concat([response, data]);
                });
                
                socket.on('close', () => {
                    clearTimeout(timer);
                    if (response.length > 0) {
                        // Analyze response to determine printer type
                        const printerType = this.analyzeStatusResponse(response);
                        resolve({ type: printerType, detected: true, response: response.toString('hex') });
                    } else {
                        resolve({ type: 'epson', detected: false, reason: 'no_response' });
                    }
                });
                
                socket.on('error', (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            });
        } catch (error) {
            logger.error('Printer detection error:', error);
            return { type: 'unknown', detected: false, error: error.message };
        }
    }

    /**
     * Analyze status response to determine printer type
     */
    analyzeStatusResponse(response) {
        // This is simplified - real implementation would check specific patterns
        const hexResponse = response.toString('hex');
        
        // Star printers often have different status formats
        if (hexResponse.includes('0f')) {
            return 'star';
        }
        
        // Default to EPSON (most common thermal printer protocol)
        return 'epson';
    }

    /**
     * Build ESC/POS command buffer for EPSON compatible printers
     */
    buildEpsonCommands() {
        return {
            // Initialize printer
            init: Buffer.from([0x1B, 0x40]),  // ESC @
            
            // Text formatting
            alignLeft: Buffer.from([0x1B, 0x61, 0x00]),    // ESC a 0
            alignCenter: Buffer.from([0x1B, 0x61, 0x01]),  // ESC a 1
            alignRight: Buffer.from([0x1B, 0x61, 0x02]),   // ESC a 2
            
            // Font styles
            boldOn: Buffer.from([0x1B, 0x45, 0x01]),   // ESC E 1
            boldOff: Buffer.from([0x1B, 0x45, 0x00]),  // ESC E 0
            underlineOn: Buffer.from([0x1B, 0x2D, 0x01]),  // ESC - 1
            underlineOff: Buffer.from([0x1B, 0x2D, 0x00]), // ESC - 0
            
            // Font size
            normalSize: Buffer.from([0x1D, 0x21, 0x00]),    // GS ! 0
            doubleHeight: Buffer.from([0x1D, 0x21, 0x01]),  // GS ! 1
            doubleWidth: Buffer.from([0x1D, 0x21, 0x10]),   // GS ! 16
            doubleSize: Buffer.from([0x1D, 0x21, 0x11]),    // GS ! 17
            
            // Paper control
            lineFeed: Buffer.from([0x0A]),  // LF
            cut: Buffer.from([0x1D, 0x56, 0x41, 0x03]),  // GS V A 3 (partial cut)
            fullCut: Buffer.from([0x1D, 0x56, 0x00]),    // GS V 0 (full cut)
            
            // Cash drawer
            openDrawer: Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]),  // ESC p 0 25 250
            
            // Beep
            beep: Buffer.from([0x1B, 0x42, 0x02, 0x05]),  // ESC B 2 5 (2 beeps, 5*100ms)
        };
    }

    /**
     * Build STAR printer commands
     */
    buildStarCommands() {
        return {
            init: Buffer.from([0x1B, 0x40]),
            
            alignLeft: Buffer.from([0x1B, 0x1D, 0x61, 0x00]),
            alignCenter: Buffer.from([0x1B, 0x1D, 0x61, 0x01]),
            alignRight: Buffer.from([0x1B, 0x1D, 0x61, 0x02]),
            
            boldOn: Buffer.from([0x1B, 0x45]),
            boldOff: Buffer.from([0x1B, 0x46]),
            
            normalSize: Buffer.from([0x1B, 0x69, 0x00, 0x00]),
            doubleHeight: Buffer.from([0x1B, 0x69, 0x01, 0x00]),
            doubleWidth: Buffer.from([0x1B, 0x69, 0x00, 0x01]),
            doubleSize: Buffer.from([0x1B, 0x69, 0x01, 0x01]),
            
            lineFeed: Buffer.from([0x0A]),
            cut: Buffer.from([0x1B, 0x64, 0x02]),  // ESC d 2 (partial cut)
            fullCut: Buffer.from([0x1B, 0x64, 0x00]),
            
            openDrawer: Buffer.from([0x07]),  // BEL
        };
    }

    /**
     * Generate test page data for printer
     */
    generateTestPage(printerType = 'epson') {
        const cmds = printerType === 'star' ? this.buildStarCommands() : this.buildEpsonCommands();
        const parts = [];
        
        // Initialize
        parts.push(cmds.init);
        
        // Header
        parts.push(cmds.alignCenter);
        parts.push(cmds.doubleSize);
        parts.push(Buffer.from('PRINTER TEST PAGE\n'));
        parts.push(cmds.normalSize);
        parts.push(Buffer.from('================================\n'));
        
        // Print date/time
        parts.push(cmds.alignLeft);
        const now = new Date();
        parts.push(Buffer.from(`Date: ${now.toLocaleDateString()}\n`));
        parts.push(Buffer.from(`Time: ${now.toLocaleTimeString()}\n`));
        parts.push(Buffer.from('--------------------------------\n'));
        
        // Font styles test
        parts.push(cmds.boldOn);
        parts.push(Buffer.from('BOLD TEXT\n'));
        parts.push(cmds.boldOff);
        
        parts.push(cmds.underlineOn);
        parts.push(Buffer.from('UNDERLINED TEXT\n'));
        parts.push(cmds.underlineOff);
        
        // Size tests
        parts.push(cmds.doubleHeight);
        parts.push(Buffer.from('DOUBLE HEIGHT\n'));
        parts.push(cmds.doubleWidth);
        parts.push(Buffer.from('DOUBLE WIDTH\n'));
        parts.push(cmds.normalSize);
        
        // Alignment test
        parts.push(Buffer.from('--------------------------------\n'));
        parts.push(cmds.alignLeft);
        parts.push(Buffer.from('LEFT\n'));
        parts.push(cmds.alignCenter);
        parts.push(Buffer.from('CENTER\n'));
        parts.push(cmds.alignRight);
        parts.push(Buffer.from('RIGHT\n'));
        parts.push(cmds.alignLeft);
        
        // Character test
        parts.push(Buffer.from('--------------------------------\n'));
        parts.push(Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ\n'));
        parts.push(Buffer.from('abcdefghijklmnopqrstuvwxyz\n'));
        parts.push(Buffer.from('0123456789\n'));
        parts.push(Buffer.from('!@#$%^&*()_+-=[]{}|;:\'",.<>?/\n'));
        
        // Footer
        parts.push(Buffer.from('================================\n'));
        parts.push(cmds.alignCenter);
        parts.push(Buffer.from('TEST COMPLETE\n'));
        parts.push(Buffer.from('Printer Management System v1.0\n'));
        parts.push(cmds.alignLeft);
        
        // Feed and cut
        parts.push(cmds.lineFeed);
        parts.push(cmds.lineFeed);
        parts.push(cmds.lineFeed);
        parts.push(cmds.cut);
        
        return Buffer.concat(parts);
    }

    /**
     * Print test page via TCP
     */
    async printTestPage(ip, port = 9100, printerType = 'epson') {
        try {
            // First test connection
            await this.testTcpConnection(ip, port);
            
            // Generate and send test page
            const testData = this.generateTestPage(printerType);
            const result = await this.sendTcp(ip, port, testData);
            
            logger.info(`Test page sent to ${ip}:${port}`);
            return { success: true, ...result };
            
        } catch (error) {
            logger.error(`Failed to print test page to ${ip}:${port}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Open cash drawer
     */
    async openCashDrawer(ip, port = 9100, printerType = 'epson') {
        try {
            const cmds = printerType === 'star' ? this.buildStarCommands() : this.buildEpsonCommands();
            await this.sendTcp(ip, port, cmds.openDrawer);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Trigger beep on printer
     */
    async beep(ip, port = 9100, printerType = 'epson') {
        try {
            const cmds = this.buildEpsonCommands();
            await this.sendTcp(ip, port, cmds.beep);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Print raw text
     */
    async printText(ip, port, text, options = {}) {
        const { 
            printerType = 'epson',
            cut = true,
            feed = 3 
        } = options;
        
        try {
            const cmds = printerType === 'star' ? this.buildStarCommands() : this.buildEpsonCommands();
            const parts = [];
            
            parts.push(cmds.init);
            parts.push(Buffer.from(text));
            
            for (let i = 0; i < feed; i++) {
                parts.push(cmds.lineFeed);
            }
            
            if (cut) {
                parts.push(cmds.cut);
            }
            
            const data = Buffer.concat(parts);
            await this.sendTcp(ip, port, data);
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Scan network for printers on common thermal printer ports
     */
    async scanNetwork(baseIp, timeout = 1000) {
        const ports = [9100, 9101, 9102, 515, 631]; // Common thermal printer ports
        const results = [];
        
        // Parse base IP to get network range
        const parts = baseIp.split('.');
        if (parts.length !== 4) {
            throw new Error('Invalid IP address format');
        }
        
        const networkBase = parts.slice(0, 3).join('.');
        const scanPromises = [];
        
        // Scan common range (1-254)
        for (let i = 1; i <= 254; i++) {
            const ip = `${networkBase}.${i}`;
            
            for (const port of ports) {
                scanPromises.push(
                    this.testTcpConnection(ip, port, timeout)
                        .then(result => results.push({ ...result, scanPort: port }))
                        .catch(() => {}) // Ignore failures
                );
            }
        }
        
        await Promise.all(scanPromises);
        return results;
    }
}

// Export singleton instance
module.exports = new ThermalPrinterService();
