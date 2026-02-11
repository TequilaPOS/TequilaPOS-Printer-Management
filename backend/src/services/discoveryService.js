// ===========================================
// Network Discovery Service
// Auto-discover printers on the network
// Supports: Network printers, Thermal/POS printers
// ===========================================

const net = require('net');
const snmp = require('net-snmp');
const { exec } = require('child_process');
const logger = require('../utils/logger');

// Common printer ports
const PRINTER_PORTS = {
    9100: 'socket',      // RAW/JetDirect/Thermal
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
    printerModel: '1.3.6.1.2.1.25.3.2.1.3.1',
    printerVendor: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0',
};

// Known printer manufacturers - Network printers
const MANUFACTURERS = {
    'hp': { name: 'HP', drivers: ['HP', 'hplip'], type: 'network' },
    'hewlett': { name: 'HP', drivers: ['HP', 'hplip'], type: 'network' },
    'canon': { name: 'Canon', drivers: ['Canon', 'cnijfilter'], type: 'network' },
    'brother': { name: 'Brother', drivers: ['Brother'], type: 'network' },
    'xerox': { name: 'Xerox', drivers: ['Xerox'], type: 'network' },
    'ricoh': { name: 'Ricoh', drivers: ['Ricoh'], type: 'network' },
    'lexmark': { name: 'Lexmark', drivers: ['Lexmark'], type: 'network' },
    'samsung': { name: 'Samsung', drivers: ['Samsung'], type: 'network' },
    'kyocera': { name: 'Kyocera', drivers: ['Kyocera'], type: 'network' },
    'konica': { name: 'Konica Minolta', drivers: ['Konica'], type: 'network' },
};

// Thermal/POS Printer Manufacturers - ESC/POS protocol
const THERMAL_MANUFACTURERS = {
    'epson': { 
        name: 'Epson', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['TM-T20', 'TM-T88', 'TM-U220', 'TM-T82', 'TM-M30', 'TM-P80'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'star': { 
        name: 'Star Micronics', 
        type: 'thermal',
        protocol: 'starline',
        models: ['TSP100', 'TSP650', 'TSP700', 'TSP800', 'mPOP', 'SM-L200'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'munbyn': { 
        name: 'Munbyn', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['ITPP047', 'ITPP941', 'ITPP068'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'snbc': { 
        name: 'SNBC', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['BTP-R880NP', 'BTP-R580', 'BTP-M300'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'posbank': { 
        name: 'POS Bank', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['A7', 'A10', 'A11'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'bematech': { 
        name: 'Bematech', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['MP-4200', 'MP-100S', 'LR2000'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'citizen': { 
        name: 'Citizen', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['CT-S310', 'CT-S601', 'CT-S651'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'custom': { 
        name: 'Custom', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['TG2480', 'KUBE', 'Q3X'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'rongta': { 
        name: 'Rongta', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['RP80', 'RP326', 'RP400'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'xprinter': { 
        name: 'Xprinter', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['XP-58', 'XP-80', 'XP-Q200'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'sewoo': { 
        name: 'Sewoo', 
        type: 'thermal',
        protocol: 'escpos',
        models: ['SLK-TS400', 'LK-P20', 'LK-P30'],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
    'pos': { 
        name: 'Generic POS', 
        type: 'thermal',
        protocol: 'escpos',
        models: [],
        driver: 'raw',
        driverAlt: 'lsb/usr/cupsfilters/textonly.ppd'
    },
};

// Non-printer devices to filter out
const NON_PRINTERS = [
    'hwg-ste', 'hwg', 'sensor', 'temperature', 'humidity',
    'switch', 'router', 'gateway', 'access point', 'ap',
    'camera', 'nvr', 'dvr', 'cctv',
    'phone', 'voip', 'sip',
    'ups', 'pdu', 'apc'
];

class DiscoveryService {
    constructor() {
        this.scanning = false;
        this.progress = { current: 0, total: 0, found: [] };
        this.abortController = null;
    }

    /**
     * Check if device is a non-printer (sensor, router, etc.)
     */
    isNonPrinter(text) {
        if (!text) return false;
        const lower = text.toLowerCase();
        return NON_PRINTERS.some(np => lower.includes(np));
    }

    /**
     * Detect thermal printer by connecting to port 9100 and checking response
     */
    async detectThermalPrinter(ip, timeout = 2000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;
            let responseData = Buffer.alloc(0);

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                // Send ESC/POS status request: ESC + GS + 'a' + n (auto status)
                // or just wait for banner
                socket.write(Buffer.from([0x10, 0x04, 0x01])); // DLE EOT 1 - request status
                
                // Give it time to respond
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        socket.destroy();
                        // If connected to 9100, likely a thermal printer
                        resolve({ 
                            isThermal: true, 
                            response: responseData.toString('hex'),
                            protocol: 'escpos'
                        });
                    }
                }, 500);
            });

            socket.on('data', (data) => {
                responseData = Buffer.concat([responseData, data]);
            });

            socket.on('timeout', () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve(null);
                }
            });

            socket.on('error', () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve(null);
                }
            });

            try {
                socket.connect(9100, ip);
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Detect thermal manufacturer from banner or HTTP response
     */
    async detectThermalManufacturer(ip) {
        // Try HTTP first - many thermal printers have a web interface
        return new Promise((resolve) => {
            const http = require('http');
            
            const req = http.get(`http://${ip}/`, { timeout: 2000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const lower = data.toLowerCase();
                    
                    // Check for known thermal manufacturers in HTTP response
                    for (const [key, mfr] of Object.entries(THERMAL_MANUFACTURERS)) {
                        if (lower.includes(key) || lower.includes(mfr.name.toLowerCase())) {
                            resolve({ manufacturer: mfr, key });
                            return;
                        }
                    }
                    resolve(null);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        });
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
        
        // Check thermal manufacturers first (more specific)
        for (const [key, value] of Object.entries(THERMAL_MANUFACTURERS)) {
            if (lower.includes(key)) {
                return { ...value, key };
            }
        }
        
        // Then check network printers
        for (const [key, value] of Object.entries(MANUFACTURERS)) {
            if (lower.includes(key)) {
                return { ...value, key };
            }
        }
        return null;
    }

    /**
     * Get recommended CUPS driver for printer
     */
    async getRecommendedDriver(manufacturer, model, isThermal = false) {
        // For thermal printers, use raw queue (direct ESC/POS)
        if (isThermal || (manufacturer && manufacturer.type === 'thermal')) {
            return {
                driver: 'raw',
                driverDisplay: 'Raw Queue (Direct ESC/POS)',
                note: 'Thermal printers work best with raw queue for ESC/POS commands'
            };
        }

        return new Promise((resolve) => {
            const searchTerm = model || manufacturer?.name || '';
            
            // Search for specific driver first
            exec(`lpinfo -m 2>/dev/null | grep -i "${searchTerm}" | head -5`, 
                { timeout: 5000 },
                (error, stdout) => {
                    if (!error && stdout.trim()) {
                        const lines = stdout.trim().split('\n');
                        const driver = lines[0].split(' ')[0];
                        resolve({
                            driver: driver,
                            driverDisplay: lines[0],
                            alternatives: lines.slice(1).map(l => l.split(' ')[0]),
                            note: 'Specific driver found'
                        });
                        return;
                    }

                    // Search by manufacturer
                    if (manufacturer?.name) {
                        exec(`lpinfo -m 2>/dev/null | grep -i "${manufacturer.name}" | head -5`, 
                            { timeout: 5000 },
                            (err2, stdout2) => {
                                if (!err2 && stdout2.trim()) {
                                    const lines = stdout2.trim().split('\n');
                                    const driver = lines[0].split(' ')[0];
                                    resolve({
                                        driver: driver,
                                        driverDisplay: lines[0],
                                        alternatives: lines.slice(1).map(l => l.split(' ')[0]),
                                        note: 'Manufacturer driver found'
                                    });
                                    return;
                                }

                                // Fallback to driverless (IPP Everywhere) or generic PDF
                                resolve({
                                    driver: 'driverless',
                                    driverDisplay: 'IPP Everywhere (Driverless)',
                                    alternatives: ['lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd'],
                                    note: 'Using driverless printing (IPP Everywhere)'
                                });
                            }
                        );
                    } else {
                        resolve({
                            driver: 'driverless',
                            driverDisplay: 'IPP Everywhere (Driverless)',
                            alternatives: ['lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd'],
                            note: 'Using driverless printing (IPP Everywhere)'
                        });
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
            isThermal: false,
            printerType: 'unknown', // 'network', 'thermal', 'unknown'
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

        const has9100 = openPorts.some(p => p.port === 9100);
        const has631 = openPorts.some(p => p.port === 631);
        const has515 = openPorts.some(p => p.port === 515);
        const has80 = openPorts.some(p => p.port === 80);
        
        // Try SNMP first (most reliable for network printers)
        const snmpInfo = await this.getSNMPInfo(ip);
        if (snmpInfo) {
            result.info = { ...result.info, ...snmpInfo };
            result.isPrinter = true;
            result.printerType = 'network';
        }

        // Filter out non-printer devices
        if (result.info.description && this.isNonPrinter(result.info.description)) {
            return null;
        }

        // Try IPP if port 631 is open
        if (has631) {
            const ippInfo = await this.getIPPInfo(ip);
            if (ippInfo) {
                result.info = { ...result.info, ...ippInfo };
                result.isPrinter = true;
                result.printerType = 'network';
            }
        }

        // Check for thermal printer (port 9100 only, no SNMP/IPP)
        if (has9100 && !result.isPrinter) {
            // Try to detect thermal manufacturer from HTTP
            const thermalMfr = await this.detectThermalManufacturer(ip);
            
            if (thermalMfr) {
                result.isThermal = true;
                result.printerType = 'thermal';
                result.isPrinter = true;
                result.info.manufacturer = thermalMfr.manufacturer.name;
                result.info.description = `${thermalMfr.manufacturer.name} Thermal Printer`;
                result.info.protocol = thermalMfr.manufacturer.protocol;
            } else {
                // Try thermal detection via connection
                const thermalCheck = await this.detectThermalPrinter(ip);
                if (thermalCheck && thermalCheck.isThermal) {
                    result.isThermal = true;
                    result.printerType = 'thermal';
                    result.isPrinter = true;
                    result.info.description = 'Thermal/POS Printer (ESC/POS)';
                    result.info.protocol = 'escpos';
                }
            }
        }

        // If we have 9100 but still no info, mark as potential printer
        if (has9100 && !result.isPrinter) {
            result.isPrinter = true;
            result.printerType = has631 || has515 ? 'network' : 'thermal';
            result.isThermal = result.printerType === 'thermal';
            result.info.description = result.isThermal 
                ? 'Thermal/POS Printer (Port 9100)' 
                : 'Network Printer (JetDirect)';
        }

        if (!result.isPrinter) {
            return null;
        }

        // Detect manufacturer from description
        const descText = result.info.description || result.info.model || '';
        const manufacturer = this.detectManufacturer(descText);
        
        if (manufacturer) {
            result.info.manufacturer = manufacturer.name;
            if (manufacturer.type === 'thermal') {
                result.isThermal = true;
                result.printerType = 'thermal';
            }
        }

        // Determine best protocol and driver
        if (result.isThermal) {
            // Thermal printers: always use socket:9100 with raw driver
            result.recommended.protocol = 'socket';
            result.recommended.port = 9100;
            result.recommended.driver = 'raw';
            result.recommended.driverDisplay = 'Raw Queue (ESC/POS Direct)';
            result.recommended.note = 'Thermal printer - use raw queue for ESC/POS commands';
            result.recommended.uri = `socket://${ip}:9100`;
        } else {
            // Network printers: prefer IPP if available
            if (has631) {
                result.recommended.protocol = 'ipp';
                result.recommended.port = 631;
                result.recommended.uri = `ipp://${ip}/ipp/print`;
                
                // Get specific driver
                const driverInfo = await this.getRecommendedDriver(manufacturer, result.info.model, false);
                result.recommended.driver = driverInfo.driver;
                result.recommended.driverDisplay = driverInfo.driverDisplay;
                result.recommended.driverAlternatives = driverInfo.alternatives;
                result.recommended.note = driverInfo.note;
            } else if (has9100) {
                result.recommended.protocol = 'socket';
                result.recommended.port = 9100;
                result.recommended.uri = `socket://${ip}:9100`;
                
                const driverInfo = await this.getRecommendedDriver(manufacturer, result.info.model, false);
                result.recommended.driver = driverInfo.driver;
                result.recommended.driverDisplay = driverInfo.driverDisplay;
                result.recommended.driverAlternatives = driverInfo.alternatives;
                result.recommended.note = driverInfo.note;
            } else if (has515) {
                result.recommended.protocol = 'lpd';
                result.recommended.port = 515;
                result.recommended.uri = `lpd://${ip}/queue`;
                
                const driverInfo = await this.getRecommendedDriver(manufacturer, result.info.model, false);
                result.recommended.driver = driverInfo.driver;
                result.recommended.driverDisplay = driverInfo.driverDisplay;
            }
        }

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
     * Scan specifically for thermal printers (port 9100 only)
     */
    async scanThermalPrinters(network, onProgress = null) {
        if (this.scanning) {
            throw new Error('Scan already in progress');
        }

        this.scanning = true;
        this.progress = { current: 0, total: 0, found: [], status: 'thermal-scan' };

        try {
            const ips = this.parseNetworkRange(network);
            this.progress.total = ips.length;

            logger.info(`Starting thermal printer scan: ${network} (${ips.length} IPs)`);

            const batchSize = 30; // Faster for thermal-only scan
            const results = [];

            for (let i = 0; i < ips.length; i += batchSize) {
                if (!this.scanning) break;

                const batch = ips.slice(i, i + batchSize);
                
                // Only check port 9100 for thermal printers
                const batchResults = await Promise.all(
                    batch.map(async (ip) => {
                        try {
                            const port9100Open = await this.checkPort(ip, 9100, 800);
                            if (!port9100Open) return null;

                            // Check if it's NOT a network printer (no SNMP)
                            const snmpInfo = await this.getSNMPInfo(ip, 'public', 1000);
                            
                            // If SNMP responds with printer info, it's a network printer
                            if (snmpInfo && snmpInfo.description && 
                                (snmpInfo.description.toLowerCase().includes('laserjet') ||
                                 snmpInfo.description.toLowerCase().includes('ecosys') ||
                                 snmpInfo.description.toLowerCase().includes('kyocera'))) {
                                return null; // Skip network printers
                            }

                            // Try to detect as thermal
                            const thermalMfr = await this.detectThermalManufacturer(ip);
                            const thermalCheck = await this.detectThermalPrinter(ip);

                            if (thermalMfr || (thermalCheck && thermalCheck.isThermal)) {
                                const result = {
                                    ip,
                                    isPrinter: true,
                                    isThermal: true,
                                    printerType: 'thermal',
                                    protocols: [{ port: 9100, protocol: 'socket' }],
                                    info: {
                                        manufacturer: thermalMfr?.manufacturer?.name || 'Unknown',
                                        description: thermalMfr 
                                            ? `${thermalMfr.manufacturer.name} Thermal Printer`
                                            : 'Thermal/POS Printer',
                                        protocol: thermalMfr?.manufacturer?.protocol || 'escpos'
                                    },
                                    recommended: {
                                        protocol: 'socket',
                                        port: 9100,
                                        uri: `socket://${ip}:9100`,
                                        driver: 'raw',
                                        driverDisplay: 'Raw Queue (ESC/POS Direct)',
                                        note: 'Thermal printer - use raw queue',
                                        name: `Thermal_${ip.replace(/\./g, '_')}`
                                    }
                                };
                                return result;
                            }

                            return null;
                        } catch {
                            return null;
                        }
                    })
                );

                for (const result of batchResults) {
                    if (result) {
                        results.push(result);
                        this.progress.found.push(result);
                        logger.info(`Found thermal printer: ${result.ip} - ${result.info.manufacturer}`);
                    }
                }

                this.progress.current = Math.min(i + batchSize, ips.length);
                
                if (onProgress) {
                    onProgress(this.progress);
                }
            }

            this.progress.status = 'completed';
            logger.info(`Thermal scan completed: Found ${results.length} thermal printers`);

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
