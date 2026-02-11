/**
 * SNMP Printer Monitor Service
 * Based on CUPS snmp-supplies.c implementation
 * 
 * Monitors printer status, supply levels, and page counts via SNMP
 * Supports: HP, Canon, Epson, Brother, Xerox, Lexmark, Samsung, Ricoh
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const logger = require('../utils/logger');

// SNMP OIDs (from CUPS backend/snmp-supplies.c)
const SNMP_OIDS = {
    // System info
    sysDescr: '.1.3.6.1.2.1.1.1.0',
    sysName: '.1.3.6.1.2.1.1.5.0',
    
    // Host Resources MIB
    hrDeviceDescr: '.1.3.6.1.2.1.25.3.2.1.3.1',
    hrPrinterStatus: '.1.3.6.1.2.1.25.3.5.1.1.1',
    hrPrinterDetectedErrorState: '.1.3.6.1.2.1.25.3.5.1.2.1',
    
    // Printer MIB - General
    prtGeneralSerialNumber: '.1.3.6.1.2.1.43.5.1.1.17.1',
    prtInputDefaultIndex: '.1.3.6.1.2.1.43.5.1.1.8.1',
    
    // Printer MIB - Marker (Toner/Ink)
    prtMarkerSuppliesEntry: '.1.3.6.1.2.1.43.11.1.1',
    prtMarkerSuppliesDescription: '.1.3.6.1.2.1.43.11.1.1.6.1',
    prtMarkerSuppliesLevel: '.1.3.6.1.2.1.43.11.1.1.9.1',
    prtMarkerSuppliesMaxCapacity: '.1.3.6.1.2.1.43.11.1.1.8.1',
    prtMarkerSuppliesType: '.1.3.6.1.2.1.43.11.1.1.5.1',
    prtMarkerSuppliesColorantIndex: '.1.3.6.1.2.1.43.11.1.1.3.1',
    
    // Marker Colorant
    prtMarkerColorantValue: '.1.3.6.1.2.1.43.12.1.1.4.1',
    
    // Page Counter
    prtMarkerLifeCount: '.1.3.6.1.2.1.43.10.2.1.4.1.1',
    
    // Input (Paper Tray)
    prtInputCurrentLevel: '.1.3.6.1.2.1.43.8.2.1.10.1',
    prtInputMaxCapacity: '.1.3.6.1.2.1.43.8.2.1.9.1',
    prtInputMediaName: '.1.3.6.1.2.1.43.8.2.1.12.1',
    prtInputName: '.1.3.6.1.2.1.43.8.2.1.13.1',
    
    // Output (Paper Output Tray)
    prtOutputRemainingCapacity: '.1.3.6.1.2.1.43.9.2.1.6.1',
    
    // HP Private MIBs
    hpPML: '.1.3.6.1.4.1.11.2.3.9.4.2',
    
    // Canon Private MIBs  
    canonModel: '.1.3.6.1.4.1.1602.1.1.1.1.0',
    
    // Epson Private MIBs
    epsonModel: '.1.3.6.1.4.1.1248.1.2.2.1.1.1.1.1',
};

// Supply types (from CUPS CUPS_TC_* constants)
const SUPPLY_TYPES = {
    1: 'other',
    2: 'unknown',
    3: 'toner',
    4: 'wasteToner',
    5: 'ink',
    6: 'inkCartridge',
    7: 'inkRibbon',
    8: 'wasteInk',
    9: 'opc',
    10: 'developer',
    11: 'fuserOil',
    12: 'solidWax',
    13: 'ribbonWax',
    14: 'wasteWax',
    15: 'fuser',
    16: 'coronaWire',
    17: 'fuserOilWick',
    18: 'cleanerUnit',
    19: 'fuserCleaningPad',
    20: 'transferUnit',
    21: 'tonerCartridge',
    22: 'fuserOiler',
    23: 'water',
    24: 'wasteWater',
    25: 'glueWaterAdditive',
    26: 'wastePaper',
    27: 'bindingSupply',
    28: 'bandingSupply',
    29: 'stitchingWire',
    30: 'shrinkWrap',
    31: 'paperWrap',
    32: 'staples',
    33: 'inserts',
    34: 'covers'
};

// Printer states (from CUPS hrPrinterDetectedErrorState bits)
const PRINTER_STATES = {
    0x8000: 'Low paper',
    0x4000: 'Out of paper',
    0x2000: 'Low toner',
    0x1000: 'Out of toner',
    0x0800: 'Door open',
    0x0400: 'Paper jam',
    0x0200: 'Printer offline',
    0x0100: 'Service requested',
    0x0080: 'Input tray missing',
    0x0040: 'Output tray missing',
    0x0020: 'Marker supply missing',
    0x0010: 'Output tray nearly full',
    0x0008: 'Output tray full',
    0x0004: 'Input tray empty',
    0x0002: 'Maintenance required'
};

// Color mapping (from CUPS backend_walk_cb)
const COLORANT_COLORS = {
    'black': '#000000',
    'blue': '#0000FF',
    'brown': '#A52A2A',
    'cyan': '#00FFFF',
    'gold': '#FFD700',
    'gray': '#808080',
    'green': '#008000',
    'magenta': '#FF00FF',
    'orange': '#FFA500',
    'pink': '#FFC0CB',
    'red': '#FF0000',
    'silver': '#C0C0C0',
    'violet': '#EE82EE',
    'white': '#FFFFFF',
    'yellow': '#FFFF00'
};

class SNMPMonitor {
    constructor(options = {}) {
        this.community = options.community || 'public';
        this.timeout = options.timeout || 10;  // Increased from 5 to 10 seconds
        this.retries = options.retries || 2;   // Increased from 1 to 2 retries
        this.version = options.version || '2c';
    }

    /**
     * Execute SNMP command using snmpget/snmpwalk
     */
    async snmpGet(ip, oid) {
        try {
            const cmd = `snmpget -v ${this.version} -c ${this.community} -t ${this.timeout} -r ${this.retries} ${ip} ${oid} 2>/dev/null`;
            const { stdout } = await execAsync(cmd, { timeout: (this.timeout + 2) * 1000 });
            return this.parseSnmpOutput(stdout);
        } catch (error) {
            logger.debug(`SNMP get failed for ${ip} ${oid}: ${error.message}`);
            return null;
        }
    }

    async snmpWalk(ip, oid) {
        try {
            const cmd = `snmpwalk -v ${this.version} -c ${this.community} -t ${this.timeout} -r ${this.retries} ${ip} ${oid} 2>/dev/null`;
            const { stdout } = await execAsync(cmd, { timeout: (this.timeout + 5) * 1000 });
            return this.parseSnmpWalkOutput(stdout);
        } catch (error) {
            logger.debug(`SNMP walk failed for ${ip} ${oid}: ${error.message}`);
            return [];
        }
    }

    /**
     * Parse single SNMP response
     */
    parseSnmpOutput(output) {
        if (!output || output.includes('No Such Object') || output.includes('Timeout')) {
            return null;
        }
        
        // Format: OID = TYPE: VALUE
        const match = output.match(/=\s*(?:(\w+):\s*)?(.+)$/m);
        if (match) {
            const type = match[1] || 'STRING';
            let value = match[2].trim();
            
            // Clean up string values
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            
            // Convert integers
            if (type === 'INTEGER' || type === 'Gauge32' || type === 'Counter32') {
                value = parseInt(value) || 0;
            }
            
            return { type, value };
        }
        return null;
    }

    /**
     * Parse SNMP walk output (multiple values)
     * Handles formats: 
     *   SNMPv2-SMI::mib-2.43.11.1.1.6.1.1 = STRING: "Cartucho negro"
     *   .1.3.6.1.2.1.43.11.1.1.6.1.1 = STRING: "Cartucho negro"
     */
    parseSnmpWalkOutput(output) {
        if (!output) return [];
        
        const results = [];
        const lines = output.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            // Match OID in various formats: .1.3.6..., SNMPv2-SMI::mib-2.43..., etc.
            const oidMatch = line.match(/(?:SNMPv2-[\w-]+::|ISO::|^)(?:mib-2\.)?([.\d]+)\s*=/i) || line.match(/^([.\d]+)\s*=/);
            const valueMatch = line.match(/=\s*(?:(\w+):\s*)?(.+)$/);
            
            if (oidMatch && valueMatch) {
                let oid = oidMatch[1];
                // Normalize OID - ensure it starts with a dot
                if (!oid.startsWith('.')) {
                    oid = '.' + oid;
                }
                
                const type = valueMatch[1] || 'STRING';
                let value = valueMatch[2].trim();
                
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                if (type === 'INTEGER' || type === 'Gauge32' || type === 'Counter32') {
                    value = parseInt(value) || 0;
                }
                
                // Extract index from OID (last number)
                const indexMatch = oid.match(/\.(\d+)$/);
                const index = indexMatch ? parseInt(indexMatch[1]) : 1;
                
                results.push({ oid, type, value, index });
            }
        }
        
        return results;
    }

    /**
     * Get complete printer status via SNMP
     * Returns: supplies, page count, printer state, errors
     */
    async getPrinterStatus(ip) {
        const status = {
            ip,
            timestamp: new Date().toISOString(),
            online: false,
            supplies: [],
            pageCount: null,
            printerState: null,
            errors: [],
            paperTrays: [],
            serialNumber: null,
            model: null,
            description: null
        };

        try {
            // Check if SNMP is available
            const sysDescr = await this.snmpGet(ip, SNMP_OIDS.sysDescr);
            if (!sysDescr) {
                status.errors.push('SNMP not available or timeout');
                return status;
            }
            
            status.online = true;
            status.description = sysDescr.value;
            
            // Get printer model
            const hrDeviceDescr = await this.snmpGet(ip, SNMP_OIDS.hrDeviceDescr);
            if (hrDeviceDescr) {
                status.model = hrDeviceDescr.value;
            }
            
            // Get serial number
            const serialNum = await this.snmpGet(ip, SNMP_OIDS.prtGeneralSerialNumber);
            if (serialNum) {
                status.serialNumber = serialNum.value;
            }
            
            // Get printer state
            const printerState = await this.snmpGet(ip, SNMP_OIDS.hrPrinterStatus);
            if (printerState) {
                const stateMap = {
                    1: 'other',
                    2: 'unknown', 
                    3: 'idle',
                    4: 'printing',
                    5: 'warmup'
                };
                status.printerState = stateMap[printerState.value] || 'unknown';
            }
            
            // Get error states
            const errorState = await this.snmpGet(ip, SNMP_OIDS.hrPrinterDetectedErrorState);
            if (errorState && errorState.value) {
                status.errors = this.parseErrorState(errorState.value);
            }
            
            // Get page count
            const pageCount = await this.snmpGet(ip, SNMP_OIDS.prtMarkerLifeCount);
            if (pageCount) {
                status.pageCount = pageCount.value;
            }
            
            // Get supply levels (toner/ink)
            status.supplies = await this.getSupplyLevels(ip);
            
            // Get paper tray status
            status.paperTrays = await this.getPaperTrayStatus(ip);
            
            logger.info(`SNMP status for ${ip}: state=${status.printerState}, supplies=${status.supplies.length}`);
            
        } catch (error) {
            logger.error(`SNMP monitoring error for ${ip}:`, error);
            status.errors.push(error.message);
        }
        
        return status;
    }

    /**
     * Get supply levels (toner, ink, etc.)
     */
    async getSupplyLevels(ip) {
        const supplies = [];
        
        try {
            // Walk marker supplies table
            const descriptions = await this.snmpWalk(ip, SNMP_OIDS.prtMarkerSuppliesDescription);
            const levels = await this.snmpWalk(ip, SNMP_OIDS.prtMarkerSuppliesLevel);
            const maxCapacities = await this.snmpWalk(ip, SNMP_OIDS.prtMarkerSuppliesMaxCapacity);
            const types = await this.snmpWalk(ip, SNMP_OIDS.prtMarkerSuppliesType);
            const colorants = await this.snmpWalk(ip, SNMP_OIDS.prtMarkerColorantValue);
            
            // Build supply list
            for (const desc of descriptions) {
                const index = desc.index;
                const level = levels.find(l => l.index === index);
                const maxCap = maxCapacities.find(m => m.index === index);
                const type = types.find(t => t.index === index);
                const colorant = colorants.find(c => c.index === index);
                
                // Calculate percentage
                let percent = -1;
                if (level && maxCap && maxCap.value > 0 && level.value >= 0) {
                    percent = Math.round((level.value / maxCap.value) * 100);
                } else if (level && level.value >= 0 && level.value <= 100) {
                    // Some printers report percentage directly
                    percent = level.value;
                }
                
                // Determine color from description or colorant
                const descLower = (desc.value || '').toLowerCase();
                let color = 'none';
                let colorHex = '#808080';
                
                for (const [name, hex] of Object.entries(COLORANT_COLORS)) {
                    if (descLower.includes(name) || (colorant && colorant.value?.toLowerCase().includes(name))) {
                        color = name;
                        colorHex = hex;
                        break;
                    }
                }
                
                supplies.push({
                    index,
                    name: desc.value,
                    type: SUPPLY_TYPES[type?.value] || 'unknown',
                    typeCode: type?.value || 0,
                    level: level?.value ?? -1,
                    maxCapacity: maxCap?.value ?? -1,
                    percent,
                    color,
                    colorHex,
                    colorant: colorant?.value || null,
                    status: this.getSupplyStatus(percent)
                });
            }
            
        } catch (error) {
            logger.debug(`Failed to get supply levels for ${ip}: ${error.message}`);
        }
        
        return supplies;
    }

    /**
     * Get paper tray status
     */
    async getPaperTrayStatus(ip) {
        const trays = [];
        
        try {
            const names = await this.snmpWalk(ip, SNMP_OIDS.prtInputName);
            const levels = await this.snmpWalk(ip, SNMP_OIDS.prtInputCurrentLevel);
            const maxLevels = await this.snmpWalk(ip, SNMP_OIDS.prtInputMaxCapacity);
            const mediaNames = await this.snmpWalk(ip, SNMP_OIDS.prtInputMediaName);
            
            for (const name of names) {
                const index = name.index;
                const level = levels.find(l => l.index === index);
                const maxLevel = maxLevels.find(m => m.index === index);
                const mediaName = mediaNames.find(m => m.index === index);
                
                let percent = -1;
                if (level && maxLevel && maxLevel.value > 0) {
                    percent = Math.round((level.value / maxLevel.value) * 100);
                }
                
                trays.push({
                    index,
                    name: name.value || `Tray ${index}`,
                    mediaName: mediaName?.value || 'Unknown',
                    level: level?.value ?? -1,
                    maxCapacity: maxLevel?.value ?? -1,
                    percent,
                    status: percent < 10 ? 'low' : percent < 0 ? 'unknown' : 'ok'
                });
            }
            
        } catch (error) {
            logger.debug(`Failed to get paper tray status for ${ip}: ${error.message}`);
        }
        
        return trays;
    }

    /**
     * Parse hrPrinterDetectedErrorState bitmask
     */
    parseErrorState(value) {
        const errors = [];
        
        // Value can be a hex string or integer
        let errorBits = 0;
        if (typeof value === 'string') {
            // Parse hex string like "00 00"
            const hex = value.replace(/\s/g, '');
            errorBits = parseInt(hex, 16);
        } else {
            errorBits = value;
        }
        
        for (const [bit, name] of Object.entries(PRINTER_STATES)) {
            if (errorBits & parseInt(bit)) {
                errors.push(name);
            }
        }
        
        return errors;
    }

    /**
     * Get supply status label
     */
    getSupplyStatus(percent) {
        if (percent < 0) return 'unknown';
        if (percent <= 1) return 'empty';
        if (percent <= 10) return 'low';
        if (percent <= 25) return 'almost-low';
        return 'ok';
    }

    /**
     * Discover printers via SNMP broadcast
     */
    async discoverPrinters(network = '255.255.255.255') {
        const printers = [];
        
        try {
            // Use CUPS-style discovery
            const cmd = `snmpwalk -v 1 -c public -t 2 -r 0 ${network} ${SNMP_OIDS.hrDeviceDescr} 2>/dev/null`;
            const { stdout } = await execAsync(cmd, { timeout: 10000 });
            
            // Parse responses to find printers
            const lines = stdout.split('\n').filter(l => l.trim());
            for (const line of lines) {
                const ipMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch) {
                    const ip = ipMatch[1];
                    const descMatch = line.match(/STRING:\s*"?([^"]+)"?/);
                    printers.push({
                        ip,
                        description: descMatch ? descMatch[1] : 'Unknown',
                        source: 'snmp-discovery'
                    });
                }
            }
        } catch (error) {
            logger.debug(`SNMP discovery error: ${error.message}`);
        }
        
        return printers;
    }
}

// Singleton instance
const snmpMonitor = new SNMPMonitor();

module.exports = {
    SNMPMonitor,
    snmpMonitor,
    SNMP_OIDS,
    SUPPLY_TYPES,
    PRINTER_STATES,
    COLORANT_COLORS
};
