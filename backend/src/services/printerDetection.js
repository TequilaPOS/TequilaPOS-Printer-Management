// ===========================================
// Printer Detection Service
// Auto-detect printer model, capabilities, and suggest drivers
// ===========================================

const { execCommand, execCupsCommand } = require('../utils/shellExec');
const logger = require('../utils/logger');
const net = require('net');
const http = require('http');

class PrinterDetectionService {

    /**
     * Detect printer info by IP address
     * Tries multiple methods: HTTP, PJL, SNMP
     */
    async detectPrinter(ip, port = 9100) {
        logger.info(`Detecting printer at ${ip}:${port}`);
        
        const result = {
            ip,
            port,
            detected: false,
            manufacturer: null,
            model: null,
            supportsIPP: false,
            supportsPCL: false,
            supportsPostScript: false,
            suggestedDriver: null,
            suggestedProtocol: 'socket',
            webInterface: null,
            tonerLevels: null,
            serialNumber: null,
            printerType: null  // 'thermal', 'impact', 'office', etc.
        };

        try {
            // 1. Try SNMP detection first (most reliable for receipt printers)
            const snmpInfo = await this.detectViaSNMP(ip);
            if (snmpInfo.detected) {
                Object.assign(result, snmpInfo);
                logger.info(`SNMP detected: ${snmpInfo.manufacturer} ${snmpInfo.model}`);
            }

            // 2. Try HTTP detection (most printers have web interface)
            if (!result.detected) {
                const httpInfo = await this.detectViaHTTP(ip);
                if (httpInfo.detected) {
                    Object.assign(result, httpInfo);
                }
            }

            // 3. Try PJL detection (HP, Brother, etc.)
            if (!result.detected) {
                const pjlInfo = await this.detectViaPJL(ip, port);
                if (pjlInfo.detected) {
                    Object.assign(result, pjlInfo);
                }
            }

            // 4. Try IPP detection
            const ippInfo = await this.detectViaIPP(ip);
            if (ippInfo.supportsIPP) {
                result.supportsIPP = true;
                result.suggestedProtocol = 'ipp';
                if (ippInfo.model && !result.model) {
                    result.model = ippInfo.model;
                    result.manufacturer = ippInfo.manufacturer;
                }
            }

            // 5. Suggest driver based on detected info
            if (result.model || result.manufacturer) {
                result.suggestedDriver = await this.suggestDriver(result);
                result.detected = true;
                if (result.suggestedDriver && result.suggestedDriver.type) {
                    result.printerType = result.suggestedDriver.type;
                }
            }

            // 6. Try to get toner levels via SNMP
            const tonerInfo = await this.getTonerViaSNMP(ip);
            if (tonerInfo) {
                result.tonerLevels = tonerInfo;
            }

        } catch (error) {
            logger.error(`Error detecting printer at ${ip}:`, error.message);
        }

        return result;
    }

    /**
     * Detect printer via SNMP (works great for receipt printers)
     */
    async detectViaSNMP(ip) {
        const result = { detected: false };
        
        try {
            // Standard printer MIB OIDs
            // 1.3.6.1.2.1.25.3.2.1.3.1 = hrDeviceDescr (Device Description)
            // 1.3.6.1.2.1.1.1.0 = sysDescr (System Description)
            // 1.3.6.1.2.1.43.5.1.1.16.1 = prtGeneralSerialNumber
            // 1.3.6.1.2.1.43.5.1.1.17.1 = prtGeneralPrinterName
            
            const snmpResult = await execCommand(
                `snmpget -v1 -c public -t 2 ${ip} 1.3.6.1.2.1.25.3.2.1.3.1 1.3.6.1.2.1.1.1.0 2>/dev/null`
            );
            
            if (snmpResult.success && snmpResult.stdout) {
                const output = snmpResult.stdout.toUpperCase();
                
                // Parse device description
                const descMatch = snmpResult.stdout.match(/STRING:\s*"?([^"\n]+)"?/gi);
                if (descMatch && descMatch.length > 0) {
                    const fullDesc = descMatch.map(m => m.replace(/STRING:\s*"?/i, '').replace(/"$/, '')).join(' ');
                    
                    // Detect manufacturer and model
                    if (output.includes('EPSON')) {
                        result.detected = true;
                        result.manufacturer = 'Epson';
                        
                        // Extract model
                        const modelMatch = fullDesc.match(/TM-[A-Z0-9]+/i) || 
                                          fullDesc.match(/EPSON\s+([A-Z0-9-]+)/i);
                        if (modelMatch) {
                            result.model = modelMatch[0] || modelMatch[1];
                        }
                    } else if (output.includes('STAR')) {
                        result.detected = true;
                        result.manufacturer = 'Star';
                        const modelMatch = fullDesc.match(/TSP[0-9]+|SP[0-9]+|mC-Print/i);
                        if (modelMatch) result.model = modelMatch[0];
                    } else if (output.includes('SNBC') || output.includes('BTP-')) {
                        result.detected = true;
                        result.manufacturer = 'SNBC';
                        const modelMatch = fullDesc.match(/BTP-[A-Z0-9]+/i);
                        if (modelMatch) result.model = modelMatch[0];
                    } else if (output.includes('CITIZEN')) {
                        result.detected = true;
                        result.manufacturer = 'Citizen';
                        const modelMatch = fullDesc.match(/CT-[A-Z0-9]+|CL-[A-Z0-9]+/i);
                        if (modelMatch) result.model = modelMatch[0];
                    } else if (output.includes('BIXOLON')) {
                        result.detected = true;
                        result.manufacturer = 'Bixolon';
                    } else if (output.includes('HP') || output.includes('HEWLETT')) {
                        result.detected = true;
                        result.manufacturer = 'HP';
                        const modelMatch = fullDesc.match(/(?:HP|LaserJet|OfficeJet)\s*([A-Z0-9-]+)/i);
                        if (modelMatch) result.model = modelMatch[1];
                    } else if (output.includes('BROTHER')) {
                        result.detected = true;
                        result.manufacturer = 'Brother';
                        const modelMatch = fullDesc.match(/(?:Brother|HL|MFC|DCP)-?([A-Z0-9-]+)/i);
                        if (modelMatch) result.model = modelMatch[1];
                    }
                }
            }
        } catch (error) {
            // SNMP not available or failed
        }
        
        return result;
    }

    /**
     * Detect printer via HTTP web interface
     */
    async detectViaHTTP(ip) {
        return new Promise((resolve) => {
            const result = { detected: false };
            
            const req = http.get(`http://${ip}/`, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        // Parse HTML for printer info
                        const titleMatch = data.match(/<title[^>]*>([^<]+)</i);
                        if (titleMatch) {
                            const title = titleMatch[1];
                            
                            // HP printers
                            if (title.includes('HP') || data.includes('/hp/device/')) {
                                result.detected = true;
                                result.manufacturer = 'HP';
                                const modelMatch = title.match(/HP\s+([^\s&<]+(?:\s+[^\s&<]+)?)/i);
                                if (modelMatch) {
                                    result.model = modelMatch[1].trim();
                                }
                                result.webInterface = `http://${ip}/`;
                            }
                            
                            // Brother printers
                            else if (title.includes('Brother') || data.includes('Brother')) {
                                result.detected = true;
                                result.manufacturer = 'Brother';
                                const modelMatch = title.match(/Brother\s+([^\s&<]+)/i);
                                if (modelMatch) {
                                    result.model = modelMatch[1];
                                }
                            }
                            
                            // Canon printers
                            else if (title.includes('Canon') || data.includes('Canon')) {
                                result.detected = true;
                                result.manufacturer = 'Canon';
                            }
                            
                            // Epson printers
                            else if (title.includes('EPSON') || data.includes('EPSON')) {
                                result.detected = true;
                                result.manufacturer = 'Epson';
                            }
                            
                            // Xerox printers
                            else if (title.includes('Xerox') || data.includes('Xerox')) {
                                result.detected = true;
                                result.manufacturer = 'Xerox';
                            }
                            
                            // Lexmark printers
                            else if (title.includes('Lexmark') || data.includes('Lexmark')) {
                                result.detected = true;
                                result.manufacturer = 'Lexmark';
                            }
                            
                            // Ricoh printers
                            else if (title.includes('Ricoh') || data.includes('Ricoh')) {
                                result.detected = true;
                                result.manufacturer = 'Ricoh';
                            }
                            
                            // Kyocera printers
                            else if (title.includes('Kyocera') || data.includes('KYOCERA')) {
                                result.detected = true;
                                result.manufacturer = 'Kyocera';
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                    resolve(result);
                });
            });
            
            req.on('error', () => resolve(result));
            req.on('timeout', () => {
                req.destroy();
                resolve(result);
            });
        });
    }

    /**
     * Detect printer via PJL (Printer Job Language)
     * Works with HP, Brother, Lexmark, etc.
     */
    async detectViaPJL(ip, port = 9100) {
        return new Promise((resolve) => {
            const result = { detected: false };
            
            const socket = new net.Socket();
            socket.setTimeout(5000);
            
            socket.connect(port, ip, () => {
                // Send PJL INFO ID command
                socket.write('\x1B%-12345X@PJL INFO ID\r\n\x1B%-12345X');
            });
            
            let data = '';
            socket.on('data', (chunk) => {
                data += chunk.toString();
                
                // Look for printer ID in response
                const idMatch = data.match(/@PJL INFO ID\r?\n"?([^"\r\n]+)"?/i);
                if (idMatch) {
                    result.detected = true;
                    const fullModel = idMatch[1].trim();
                    
                    // Parse manufacturer and model
                    if (fullModel.toLowerCase().includes('hp') || fullModel.toLowerCase().includes('hewlett')) {
                        result.manufacturer = 'HP';
                        result.model = fullModel.replace(/hp\s*/i, '').trim();
                    } else if (fullModel.toLowerCase().includes('brother')) {
                        result.manufacturer = 'Brother';
                        result.model = fullModel.replace(/brother\s*/i, '').trim();
                    } else {
                        result.model = fullModel;
                    }
                    
                    result.supportsPCL = true;
                    socket.destroy();
                }
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(result);
            });
            
            socket.on('error', () => {
                resolve(result);
            });
            
            socket.on('close', () => {
                resolve(result);
            });
        });
    }

    /**
     * Detect if printer supports IPP
     */
    async detectViaIPP(ip) {
        const result = { supportsIPP: false };
        
        try {
            // Try common IPP paths
            const paths = ['/ipp/print', '/ipp', '/'];
            
            for (const path of paths) {
                try {
                    const response = await this.httpRequest(`http://${ip}:631${path}`, 'POST', {
                        'Content-Type': 'application/ipp'
                    });
                    
                    if (response.statusCode === 200 || response.statusCode === 426) {
                        result.supportsIPP = true;
                        break;
                    }
                } catch (e) {
                    // Try next path
                }
            }
        } catch (error) {
            // IPP not supported
        }
        
        return result;
    }

    /**
     * Get toner levels via SNMP
     */
    async getTonerViaSNMP(ip) {
        try {
            // Use snmpwalk if available
            const result = await execCommand(
                `snmpwalk -v1 -c public ${ip} 1.3.6.1.2.1.43.11.1.1.9 2>/dev/null | head -5`
            );
            
            if (result.success && result.stdout) {
                // Parse SNMP response for toner levels
                const levels = {};
                const lines = result.stdout.split('\n');
                
                for (const line of lines) {
                    const match = line.match(/INTEGER:\s*(\d+)/);
                    if (match) {
                        const level = parseInt(match[1]);
                        if (level >= 0 && level <= 100) {
                            if (!levels.black) levels.black = level;
                            else if (!levels.cyan) levels.cyan = level;
                            else if (!levels.magenta) levels.magenta = level;
                            else if (!levels.yellow) levels.yellow = level;
                        }
                    }
                }
                
                return Object.keys(levels).length > 0 ? levels : null;
            }
        } catch (error) {
            // SNMP not available or failed
        }
        
        return null;
    }

    /**
     * Suggest best driver for detected printer
     */
    async suggestDriver(printerInfo) {
        const { manufacturer, model, supportsIPP } = printerInfo;
        const mfgUpper = (manufacturer || '').toUpperCase();
        const modelUpper = (model || '').toUpperCase();
        
        // ==========================================
        // Receipt Printers (Thermal & Impact)
        // ==========================================
        
        // Epson TM-U series (Impact/Dot Matrix receipt printers)
        if ((modelUpper.includes('TM-U') || modelUpper.includes('TMU') || 
             modelUpper.includes('U220') || modelUpper.includes('U230')) &&
            (mfgUpper.includes('EPSON') || mfgUpper === '')) {
            return {
                driver: 'EPSON/tm-impact-receipt-rastertotmir.ppd',
                name: 'EPSON TM Impact Receipt',
                protocol: 'socket',
                type: 'impact'
            };
        }
        
        // Epson TM-T series (Thermal receipt printers)
        if ((modelUpper.includes('TM-T') || modelUpper.includes('TMT') ||
             modelUpper.includes('T88') || modelUpper.includes('T20') ||
             modelUpper.includes('T82') || modelUpper.includes('T70')) &&
            (mfgUpper.includes('EPSON') || mfgUpper === '')) {
            return {
                driver: 'EPSON/tm-ba-thermal-rastertotmtr-203.ppd',
                name: 'EPSON TM Thermal (203dpi)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Generic Epson receipt printers (thermal by default)
        if (mfgUpper.includes('EPSON') && 
            (modelUpper.includes('TM-') || modelUpper.includes('TM ') || modelUpper.startsWith('TM'))) {
            // Check if it's impact (U series) or thermal (T series)
            if (modelUpper.includes('U') && !modelUpper.includes('T')) {
                return {
                    driver: 'EPSON/tm-impact-receipt-rastertotmir.ppd',
                    name: 'EPSON TM Impact Receipt',
                    protocol: 'socket',
                    type: 'impact'
                };
            }
            return {
                driver: 'EPSON/tm-ba-thermal-rastertotmtr-203.ppd',
                name: 'EPSON TM Thermal (203dpi)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Star Micronics receipt printers
        if (mfgUpper.includes('STAR') && 
            (modelUpper.includes('TSP') || modelUpper.includes('SP700') || 
             modelUpper.includes('MC-PRINT') || modelUpper.includes('MPOP'))) {
            return {
                driver: 'raw',
                name: 'Star Receipt (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // SNBC (BTP series) thermal printers
        if (mfgUpper.includes('SNBC') || modelUpper.includes('BTP-')) {
            return {
                driver: 'raw',
                name: 'SNBC Thermal (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Bixolon receipt printers
        if (mfgUpper.includes('BIXOLON') || mfgUpper.includes('SAMSUNG')) {
            return {
                driver: 'raw',
                name: 'Bixolon Thermal (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Citizen receipt printers
        if (mfgUpper.includes('CITIZEN') && 
            (modelUpper.includes('CT-') || modelUpper.includes('CL-'))) {
            return {
                driver: 'raw',
                name: 'Citizen Thermal (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Sewoo/Lukhan receipt printers
        if (mfgUpper.includes('SEWOO') || mfgUpper.includes('LUKHAN') ||
            modelUpper.includes('SLK-') || modelUpper.includes('LK-')) {
            return {
                driver: 'raw',
                name: 'Sewoo Thermal (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // Generic receipt/thermal/POS printers
        if (modelUpper.includes('THERMAL') || modelUpper.includes('RECEIPT') ||
            modelUpper.includes('POS') || modelUpper.includes('58MM') ||
            modelUpper.includes('80MM')) {
            return {
                driver: 'raw',
                name: 'Generic Thermal Receipt (RAW/ESC-POS)',
                protocol: 'socket',
                type: 'thermal'
            };
        }
        
        // ==========================================
        // Office/Laser Printers
        // ==========================================
        
        // If IPP is supported, use driverless
        if (supportsIPP) {
            return {
                driver: 'everywhere',
                name: 'IPP Everywhere (Driverless)',
                protocol: 'ipp',
                type: 'office'
            };
        }
        
        // Get available drivers
        let drivers = [];
        try {
            const result = await execCupsCommand('lpinfo -m 2>/dev/null');
            if (result.success) {
                drivers = result.stdout.split('\n').filter(line => line.trim());
            }
        } catch (e) {
            // Use default drivers
        }
        
        const suggestions = [];
        
        // Match by manufacturer and model
        const searchTerms = [];
        if (manufacturer) searchTerms.push(manufacturer.toLowerCase());
        if (model) searchTerms.push(model.toLowerCase());
        
        for (const driver of drivers) {
            const driverLower = driver.toLowerCase();
            let score = 0;
            
            for (const term of searchTerms) {
                if (driverLower.includes(term)) score += 10;
            }
            
            // Prefer PCL 6 over PCL 5
            if (driverLower.includes('pcl6') || driverLower.includes('pxl')) score += 5;
            if (driverLower.includes('pcl5') || driverLower.includes('pcl 5')) score += 3;
            if (driverLower.includes('postscript') || driverLower.includes('ps')) score += 4;
            
            if (score > 0) {
                const [driverPath, ...nameParts] = driver.split(' ');
                suggestions.push({
                    driver: driverPath,
                    name: nameParts.join(' ') || driverPath,
                    score,
                    type: 'office'
                });
            }
        }
        
        // Sort by score and return best match
        suggestions.sort((a, b) => b.score - a.score);
        
        if (suggestions.length > 0) {
            return suggestions[0];
        }
        
        // Fallback drivers by manufacturer
        const fallbacks = {
            'HP': { driver: 'lsb/usr/cupsfilters/pxlmono.ppd', name: 'HP LaserJet Series PCL 6', protocol: 'socket', type: 'office' },
            'Brother': { driver: 'lsb/usr/cupsfilters/pxlmono.ppd', name: 'Generic PCL 6', protocol: 'socket', type: 'office' },
            'Canon': { driver: 'lsb/usr/cupsfilters/pxlmono.ppd', name: 'Generic PCL 6', protocol: 'socket', type: 'office' },
            'Epson': { driver: 'raw', name: 'Epson Generic (RAW)', protocol: 'socket', type: 'thermal' },
            'Xerox': { driver: 'drv:///sample.drv/generic.ppd', name: 'Generic PostScript', protocol: 'socket', type: 'office' },
            'default': { driver: 'raw', name: 'Generic RAW', protocol: 'socket', type: 'generic' }
        };
        
        return fallbacks[manufacturer] || fallbacks['default'];
    }

    /**
     * Get list of available drivers
     */
    async getAvailableDrivers() {
        try {
            const result = await execCupsCommand('lpinfo -m 2>/dev/null');
            if (result.success) {
                const drivers = [];
                const lines = result.stdout.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    const [path, ...nameParts] = line.split(' ');
                    drivers.push({
                        path,
                        name: nameParts.join(' ') || path,
                        isGeneric: path.includes('generic') || path.includes('sample'),
                        isPCL: path.includes('pcl') || path.includes('pxl'),
                        isPostScript: path.includes('ps') || path.includes('postscript')
                    });
                }
                
                return drivers;
            }
        } catch (error) {
            logger.error('Failed to get drivers:', error);
        }
        
        return [];
    }

    /**
     * Helper: HTTP request
     */
    httpRequest(url, method = 'GET', headers = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 80,
                path: urlObj.pathname,
                method,
                headers,
                timeout: 5000
            };
            
            const req = http.request(options, (res) => {
                resolve({ statusCode: res.statusCode });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            req.end();
        });
    }
}

module.exports = new PrinterDetectionService();
