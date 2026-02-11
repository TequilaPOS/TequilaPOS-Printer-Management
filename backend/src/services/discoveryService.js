// ===========================================
// Network Discovery Service
// Auto-discover printers on the network
// ===========================================

const net = require('net');
const snmp = require('net-snmp');
const { exec } = require('child_process');
const logger = require('../utils/logger');

// Common printer ports
const PRINTER_PORTS = {
    9100: 'socket',      // RAW/JetDirect
    631: 'ipp',          // IPP/CUPS
    515: 'lpd',          // LPD
    80: 'http',          // Web interface
    443: 'https'         // Secure web
};

// SNMP OIDs for printer info
const SNMP_OIDS = {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    hrDeviceDescr: '1.3.6.1.2.1.25.3.2.1.3.1',
    prtGeneralModelName: '1.3.6.1.2.1.43.5.1.1.16.1',
    prtGeneralSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
    // Printer MIB
    printerModel: '1.3.6.1.2.1.25.3.2.1.3.1',
    printerVendor: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0', // HP specific
};

// Known printer manufacturers by MAC OUI or SNMP response
const MANUFACTURERS = {
    'hp': { name: 'HP', drivers: ['HP', 'hplip'] },
    'hewlett': { name: 'HP', drivers: ['HP', 'hplip'] },
    'epson': { name: 'Epson', drivers: ['Epson', 'epson-escpr'] },
    'canon': { name: 'Canon', drivers: ['Canon', 'cnijfilter'] },
    'brother': { name: 'Brother', drivers: ['Brother'] },
    'xerox': { name: 'Xerox', drivers: ['Xerox'] },
    'ricoh': { name: 'Ricoh', drivers: ['Ricoh'] },
    'lexmark': { name: 'Lexmark', drivers: ['Lexmark'] },
    'samsung': { name: 'Samsung', drivers: ['Samsung'] },
    'kyocera': { name: 'Kyocera', drivers: ['Kyocera'] },
    'konica': { name: 'Konica Minolta', drivers: ['Konica'] },
};

class DiscoveryService {
    constructor() {
        this.scanning = false;
        this.progress = { current: 0, total: 0, found: [] };
        this.abortController = null;
    }

    /**
     * Parse network range from CIDR or range notation
     */
    parseNetworkRange(network) {
        // Support formats: 192.168.1.0/24 or 192.168.1.1-254
        if (network.includes('/')) {
            const [base, mask] = network.split('/');
            const maskBits = parseInt(mask);
            const hostBits = 32 - maskBits;
            const numHosts = Math.pow(2, hostBits) - 2;
            const baseParts = base.split('.').map(Number);
            
            const ips = [];
            for (let i = 1; i <= Math.min(numHosts, 254); i++) {
                const ip = [...baseParts];
                ip[3] = i;
                ips.push(ip.join('.'));
            }
            return ips;
        } else if (network.includes('-')) {
            const [start, end] = network.split('-');
            const baseParts = start.split('.');
            const startNum = parseInt(baseParts[3]);
            const endNum = parseInt(end);
            
            const ips = [];
            for (let i = startNum; i <= endNum; i++) {
                baseParts[3] = i;
                ips.push(baseParts.join('.'));
            }
            return ips;
        }
        
        // Single IP
        return [network];
    }

    /**
     * Check if a port is open on an IP
     */
    async checkPort(ip, port, timeout = 1000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;

            socket.setTimeout(timeout);
            
            socket.on('connect', () => {
                resolved = true;
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve(false);
                }
            });

            socket.on('error', () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve(false);
                }
            });

            try {
                socket.connect(port, ip);
            } catch {
                resolve(false);
            }
        });
    }

    /**
     * Get SNMP info from device
     */
    async getSNMPInfo(ip, community = 'public', timeout = 3000) {
        return new Promise((resolve) => {
            const session = snmp.createSession(ip, community, {
                timeout: timeout,
                retries: 1
            });

            const oids = [
                SNMP_OIDS.sysDescr,
                SNMP_OIDS.sysName,
                SNMP_OIDS.hrDeviceDescr,
            ];

            session.get(oids, (error, varbinds) => {
                session.close();

                if (error) {
                    resolve(null);
                    return;
                }

                const info = {};
                varbinds.forEach((vb) => {
                    if (snmp.isVarbindError(vb)) return;
                    
                    const value = vb.value.toString();
                    if (vb.oid === SNMP_OIDS.sysDescr) info.description = value;
                    if (vb.oid === SNMP_OIDS.sysName) info.name = value;
                    if (vb.oid === SNMP_OIDS.hrDeviceDescr) info.model = value;
                });

                resolve(Object.keys(info).length > 0 ? info : null);
            });
        });
    }

    /**
     * Try to get IPP info using CUPS
     */
    async getIPPInfo(ip) {
        return new Promise((resolve) => {
            exec(`ipptool -tv ipp://${ip}:631/ipp/print get-printer-attributes.test 2>/dev/null | head -50`, 
                { timeout: 5000 },
                (error, stdout) => {
                    if (error || !stdout) {
                        resolve(null);
                        return;
                    }

                    const info = {};
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        if (line.includes('printer-make-and-model')) {
                            const match = line.match(/=\s*(.+)/);
                            if (match) info.model = match[1].trim();
                        }
                        if (line.includes('printer-name')) {
                            const match = line.match(/=\s*(.+)/);
                            if (match) info.name = match[1].trim();
                        }
                    }

                    resolve(Object.keys(info).length > 0 ? info : null);
                }
            );
        });
    }

    /**
     * Detect manufacturer from description/model string
     */
    detectManufacturer(text) {
        if (!text) return null;
        
        const lower = text.toLowerCase();
        for (const [key, value] of Object.entries(MANUFACTURERS)) {
            if (lower.includes(key)) {
                return value;
            }
        }
        return null;
    }

    /**
     * Get recommended CUPS driver for printer
     */
    async getRecommendedDriver(manufacturer, model) {
        return new Promise((resolve) => {
            // Search for matching driver
            exec(`lpinfo -m 2>/dev/null | grep -i "${manufacturer || ''}" | head -10`, 
                { timeout: 5000 },
                (error, stdout) => {
                    if (error || !stdout) {
                        resolve('raw'); // Fallback to raw
                        return;
                    }

                    const lines = stdout.trim().split('\n');
                    if (lines.length > 0 && lines[0]) {
                        // Return first matching driver
                        const driver = lines[0].split(' ')[0];
                        resolve(driver || 'raw');
                    } else {
                        resolve('raw');
                    }
                }
            );
        });
    }

    /**
     * Scan a single IP for printer services
     */
    async scanIP(ip) {
        const result = {
            ip,
            isPrinter: false,
            protocols: [],
            info: {},
            recommended: {}
        };

        // Check common printer ports in parallel
        const portChecks = await Promise.all(
            Object.entries(PRINTER_PORTS).map(async ([port, protocol]) => {
                const open = await this.checkPort(ip, parseInt(port));
                return { port: parseInt(port), protocol, open };
            })
        );

        const openPorts = portChecks.filter(p => p.open);
        
        if (openPorts.length === 0) {
            return null; // No printer ports open
        }

        result.protocols = openPorts.map(p => ({ port: p.port, protocol: p.protocol }));

        // Check if port 9100 (JetDirect) is open - strong printer indicator
        const has9100 = openPorts.some(p => p.port === 9100);
        const has631 = openPorts.some(p => p.port === 631);
        
        // Try SNMP first (most reliable)
        const snmpInfo = await this.getSNMPInfo(ip);
        if (snmpInfo) {
            result.info = { ...result.info, ...snmpInfo };
            result.isPrinter = true;
        }

        // Try IPP if port 631 is open
        if (has631) {
            const ippInfo = await this.getIPPInfo(ip);
            if (ippInfo) {
                result.info = { ...result.info, ...ippInfo };
                result.isPrinter = true;
            }
        }

        // If we have 9100 but no other info, it's likely a printer
        if (has9100 && !result.isPrinter) {
            result.isPrinter = true;
            result.info.description = 'Network Printer (JetDirect)';
        }

        if (!result.isPrinter) {
            return null;
        }

        // Detect manufacturer
        const descText = result.info.description || result.info.model || '';
        const manufacturer = this.detectManufacturer(descText);
        
        if (manufacturer) {
            result.info.manufacturer = manufacturer.name;
        }

        // Determine best protocol
        if (has9100) {
            result.recommended.protocol = 'socket';
            result.recommended.port = 9100;
        } else if (has631) {
            result.recommended.protocol = 'ipp';
            result.recommended.port = 631;
        } else if (openPorts.some(p => p.port === 515)) {
            result.recommended.protocol = 'lpd';
            result.recommended.port = 515;
        }

        // Get recommended driver
        result.recommended.driver = await this.getRecommendedDriver(
            manufacturer?.name,
            result.info.model
        );

        // Generate suggested name
        result.recommended.name = this.generatePrinterName(result.info, ip);

        return result;
    }

    /**
     * Generate a friendly printer name
     */
    generatePrinterName(info, ip) {
        if (info.model) {
            // Clean up model name
            return info.model
                .replace(/[^a-zA-Z0-9\s-]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
        }
        if (info.name) {
            return info.name.replace(/[^a-zA-Z0-9\s-]/g, '_');
        }
        return `Printer_${ip.replace(/\./g, '_')}`;
    }

    /**
     * Scan network range for printers
     */
    async scanNetwork(network, onProgress = null) {
        if (this.scanning) {
            throw new Error('Scan already in progress');
        }

        this.scanning = true;
        this.progress = { current: 0, total: 0, found: [], status: 'starting' };

        try {
            const ips = this.parseNetworkRange(network);
            this.progress.total = ips.length;
            this.progress.status = 'scanning';

            logger.info(`Starting network scan: ${network} (${ips.length} IPs)`);

            // Scan IPs in batches to avoid overwhelming the network
            const batchSize = 20;
            const results = [];

            for (let i = 0; i < ips.length; i += batchSize) {
                if (!this.scanning) break; // Check for abort

                const batch = ips.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(ip => this.scanIP(ip).catch(() => null))
                );

                for (const result of batchResults) {
                    if (result && result.isPrinter) {
                        results.push(result);
                        this.progress.found.push(result);
                        logger.info(`Found printer: ${result.ip} - ${result.info.model || 'Unknown'}`);
                    }
                }

                this.progress.current = Math.min(i + batchSize, ips.length);
                
                if (onProgress) {
                    onProgress(this.progress);
                }
            }

            this.progress.status = 'completed';
            logger.info(`Scan completed: Found ${results.length} printers`);

            return results;

        } finally {
            this.scanning = false;
        }
    }

    /**
     * Quick scan common printer IPs
     */
    async quickScan(baseNetwork) {
        // Common printer IP endings
        const commonEndings = [1, 10, 20, 30, 50, 100, 150, 200, 250];
        const baseParts = baseNetwork.split('.').slice(0, 3).join('.');
        
        const ips = commonEndings.map(n => `${baseParts}.${n}`);
        
        this.scanning = true;
        this.progress = { current: 0, total: ips.length, found: [], status: 'quick-scan' };

        try {
            const results = [];
            
            for (let i = 0; i < ips.length; i++) {
                const result = await this.scanIP(ips[i]).catch(() => null);
                if (result && result.isPrinter) {
                    results.push(result);
                    this.progress.found.push(result);
                }
                this.progress.current = i + 1;
            }

            this.progress.status = 'completed';
            return results;

        } finally {
            this.scanning = false;
        }
    }

    /**
     * Abort current scan
     */
    abort() {
        this.scanning = false;
        this.progress.status = 'aborted';
    }

    /**
     * Get current scan progress
     */
    getProgress() {
        return this.progress;
    }

    /**
     * Detect local network
     */
    async detectLocalNetwork() {
        return new Promise((resolve) => {
            exec("ip route | grep default | awk '{print $3}' | head -1", (error, stdout) => {
                if (!error && stdout.trim()) {
                    const gateway = stdout.trim();
                    const parts = gateway.split('.');
                    parts[3] = '0';
                    resolve(`${parts.join('.')}/24`);
                } else {
                    // Fallback: try to detect from interfaces
                    exec("hostname -I | awk '{print $1}'", (err2, stdout2) => {
                        if (!err2 && stdout2.trim()) {
                            const ip = stdout2.trim();
                            const parts = ip.split('.');
                            parts[3] = '0';
                            resolve(`${parts.join('.')}/24`);
                        } else {
                            resolve('192.168.1.0/24');
                        }
                    });
                }
            });
        });
    }
}

module.exports = new DiscoveryService();
