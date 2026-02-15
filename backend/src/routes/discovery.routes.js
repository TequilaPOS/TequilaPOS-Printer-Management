// ===========================================
// Discovery Routes
// Network printer auto-discovery
// ===========================================

const express = require('express');
const discoveryService = require('../services/discoveryService');
const cupsService = require('../services/cupsServiceV2');
const db = require('../config/database');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole(['admin', 'operator']));

/**
 * GET /api/discovery/status
 * Get current scan status
 */
router.get('/status', (req, res) => {
    const progress = discoveryService.getProgress();
    res.json(progress);
});

/**
 * GET /api/discovery/network
 * Detect local network
 */
router.get('/network', async (req, res, next) => {
    try {
        const network = await discoveryService.detectLocalNetwork();
        res.json({ network });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/discovery/scan
 * Start network scan for printers
 */
router.post('/scan', async (req, res, next) => {
    try {
        const { network, quick = false } = req.body;

        if (!network) {
            return res.status(400).json({ error: 'Network range required (e.g., 192.168.1.0/24)' });
        }

        // Check if scan already running
        const progress = discoveryService.getProgress();
        if (progress.status === 'scanning' || progress.status === 'quick-scan') {
            return res.status(409).json({ 
                error: 'Scan already in progress',
                progress 
            });
        }

        logger.info(`Starting ${quick ? 'quick' : 'full'} network scan: ${network}`, {
            user: req.user.email
        });

        // Start scan in background
        const scanPromise = quick 
            ? discoveryService.quickScan(network)
            : discoveryService.scanNetwork(network);

        // Return immediately with scan started
        res.json({ 
            message: 'Scan started',
            network,
            quick,
            status: 'scanning'
        });

        // Log results when complete
        scanPromise.then(results => {
            logAction('discovery', 'Network scan completed', {
                network,
                quick,
                found: results.length
            }, req);
        }).catch(err => {
            logger.error('Scan failed:', err);
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/discovery/abort
 * Abort current scan
 */
router.post('/abort', (req, res) => {
    discoveryService.abort();
    res.json({ message: 'Scan aborted' });
});

/**
 * POST /api/discovery/scan-thermal
 * Scan specifically for thermal/POS printers
 */
router.post('/scan-thermal', async (req, res, next) => {
    try {
        const { network } = req.body;

        if (!network) {
            return res.status(400).json({ error: 'Network range required (e.g., 192.168.1.0/24)' });
        }

        // Check if scan already running
        const progress = discoveryService.getProgress();
        if (progress.status === 'scanning' || progress.status === 'quick-scan' || progress.status === 'thermal-scan') {
            return res.status(409).json({ 
                error: 'Scan already in progress',
                progress 
            });
        }

        logger.info(`Starting thermal printer scan: ${network}`, {
            user: req.user.email
        });

        // Start scan in background
        const scanPromise = discoveryService.scanThermalPrinters(network);

        // Return immediately
        res.json({ 
            message: 'Thermal printer scan started',
            network,
            status: 'thermal-scan'
        });

        // Log results when complete
        scanPromise.then(results => {
            logAction('discovery', 'Thermal printer scan completed', {
                network,
                found: results.length
            }, req);
        }).catch(err => {
            logger.error('Thermal scan failed:', err);
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/discovery/recommend-driver
 * Get recommended driver for a printer based on manufacturer and model
 */
router.post('/recommend-driver', async (req, res, next) => {
    try {
        const { manufacturer, model, protocol = 'socket' } = req.body;
        
        if (!manufacturer && !model) {
            return res.status(400).json({ error: 'Manufacturer or model required' });
        }

        // Use cupsServiceV2 to find best driver
        const driverInfo = cupsService.getRecommendedDriver(model, manufacturer, model);
        
        // Get driver info
        const { DRIVER_DATABASE, THERMAL_DATABASE } = require('../services/driverDatabase');
        
        // Detect manufacturer
        const mfrLower = (manufacturer || '').toLowerCase();
        const modelLower = (model || '').toLowerCase();
        const fullText = `${mfrLower} ${modelLower}`;
        
        let mfrInfo = null;
        let isThermal = false;
        
        // Check thermal
        for (const [key, data] of Object.entries(THERMAL_DATABASE)) {
            if (fullText.includes(key) || fullText.includes(data.name.toLowerCase())) {
                isThermal = true;
                mfrInfo = { name: data.name, type: 'thermal' };
                break;
            }
        }
        
        // Check network printers
        if (!isThermal) {
            for (const [key, data] of Object.entries(DRIVER_DATABASE)) {
                if (fullText.includes(key)) {
                    mfrInfo = { 
                        name: data.name, 
                        type: 'network',
                        preferredDrivers: data.preferredDrivers,
                        ippSupport: data.ippEverywhereSupport || false
                    };
                    break;
                }
            }
        }

        res.json({
            recommended: {
                driver,
                protocol: isThermal ? 'socket' : protocol,
                port: isThermal ? 9100 : (protocol === 'ipp' ? 631 : 9100),
            },
            manufacturer: mfrInfo,
            isThermal,
            alternatives: isThermal 
                ? ['raw', 'lsb/usr/cupsfilters/textonly.ppd']
                : ['everywhere', 'lsb/usr/cupsfilters/Generic-PDF_Printer-PDF.ppd']
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/discovery/drivers
 * List available printer drivers
 */
router.get('/drivers', async (req, res, next) => {
    try {
        const { search, type } = req.query;
        
        const { exec } = require('child_process');
        
        let command = 'lpinfo -m 2>/dev/null';
        if (search) {
            command += ` | grep -i "${search}"`;
        }
        command += ' | head -100';

        exec(command, { timeout: 10000 }, (error, stdout) => {
            if (error) {
                return res.json({ drivers: [], error: 'Failed to get drivers' });
            }

            const lines = stdout.trim().split('\n').filter(l => l);
            const drivers = lines.map(line => {
                const parts = line.split(' ');
                const ppd = parts[0];
                const description = parts.slice(1).join(' ');
                return { ppd, description };
            });

            // Add thermal printer options
            const thermalDrivers = [
                { ppd: 'raw', description: 'Raw Queue (Direct ESC/POS) - Best for thermal printers' },
                { ppd: 'lsb/usr/cupsfilters/textonly.ppd', description: 'Text Only Printer' },
            ];

            res.json({ 
                drivers: type === 'thermal' ? thermalDrivers : [...thermalDrivers, ...drivers],
                total: drivers.length + thermalDrivers.length
            });
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/discovery/thermal-manufacturers
 * List supported thermal printer manufacturers
 */
router.get('/thermal-manufacturers', (req, res) => {
    const manufacturers = [
        { key: 'epson', name: 'Epson', models: ['TM-T20', 'TM-T88', 'TM-U220', 'TM-T82', 'TM-M30'], protocol: 'escpos' },
        { key: 'star', name: 'Star Micronics', models: ['TSP100', 'TSP650', 'TSP700', 'TSP800', 'mPOP'], protocol: 'starline' },
        { key: 'munbyn', name: 'Munbyn', models: ['ITPP047', 'ITPP941', 'ITPP068', 'WiFi Series'], protocol: 'escpos' },
        { key: 'snbc', name: 'SNBC', models: ['BTP-R880NP', 'BTP-R580', 'BTP-M300'], protocol: 'escpos' },
        { key: 'posbank', name: 'POS Bank', models: ['A7', 'A10', 'A11'], protocol: 'escpos' },
        { key: 'bematech', name: 'Bematech', models: ['MP-4200', 'MP-100S', 'LR2000'], protocol: 'escpos' },
        { key: 'citizen', name: 'Citizen', models: ['CT-S310', 'CT-S601', 'CT-S651'], protocol: 'escpos' },
        { key: 'custom', name: 'Custom', models: ['TG2480', 'KUBE', 'Q3X'], protocol: 'escpos' },
        { key: 'rongta', name: 'Rongta', models: ['RP80', 'RP326', 'RP400'], protocol: 'escpos' },
        { key: 'xprinter', name: 'Xprinter', models: ['XP-58', 'XP-80', 'XP-Q200'], protocol: 'escpos' },
        { key: 'sewoo', name: 'Sewoo', models: ['SLK-TS400', 'LK-P20', 'LK-P30'], protocol: 'escpos' },
    ];
    
    res.json({ manufacturers });
});

/**
 * POST /api/discovery/scan-ip
 * Scan a single IP
 */
router.post('/scan-ip', async (req, res, next) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({ error: 'IP address required' });
        }

        // Validate IP format
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            return res.status(400).json({ error: 'Invalid IP address format' });
        }

        const result = await discoveryService.scanIP(ip);

        if (!result || !result.isPrinter) {
            return res.json({ 
                found: false, 
                message: 'No printer found at this IP' 
            });
        }

        res.json({
            found: true,
            printer: result
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/discovery/add
 * Add discovered printer to system
 */
router.post('/add', async (req, res, next) => {
    try {
        const { 
            ip,
            name,
            protocol = 'socket',
            port = 9100,
            driver,  // Optional - will auto-detect if not provided
            location = '',
            description = '',
            manufacturer = '',
            model = '',
            printerType = 'auto'   // 'auto', 'thermal', 'impact', 'network'
        } = req.body;

        if (!ip || !name) {
            return res.status(400).json({ error: 'IP and name required' });
        }

        // Check if printer already exists
        const existing = await db.queryOne(
            'SELECT id FROM printers WHERE ip_address = ?',
            [ip]
        );

        if (existing) {
            return res.status(409).json({ 
                error: 'Printer already exists',
                printer_id: existing.id
            });
        }

        // Determine final driver based on printerType
        let finalDriver = driver;
        let isThermal = false;
        let isImpact = false;
        
        if (!finalDriver) {
            switch (printerType) {
                case 'thermal':
                    finalDriver = 'raw';
                    isThermal = true;
                    logger.info(`Discovery: Manual thermal selection → raw`);
                    break;
                case 'impact':
                    // Use Epson impact driver
                    finalDriver = 'EPSON/tm-impact-receipt-rastertotmir.ppd';
                    isImpact = true;
                    logger.info(`Discovery: Manual impact selection → EPSON impact driver`);
                    break;
                case 'network':
                    finalDriver = 'everywhere';
                    logger.info(`Discovery: Manual network selection → IPP Everywhere`);
                    break;
                default:
                    // Auto-detect using getRecommendedDriver
                    const driverInfo = cupsService.getRecommendedDriver(name, manufacturer, model || name);
                    finalDriver = driverInfo.driver;
                    isThermal = driverInfo.type === 'thermal';
                    isImpact = driverInfo.type === 'impact';
                    logger.info(`Discovery: Auto-detect for "${name}" → ${driverInfo.name} (${driverInfo.driver})`);
            }
        }

        // Generate CUPS name
        const cupsName = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 50);

        // Build device URI based on protocol
        let deviceUri;
        switch (protocol) {
            case 'ipp':
                deviceUri = `ipp://${ip}:${port}/ipp/print`;
                break;
            case 'ipps':
                deviceUri = `ipps://${ip}:${port}/ipp/print`;
                break;
            case 'lpd':
                deviceUri = `lpd://${ip}/queue`;
                break;
            case 'http':
                deviceUri = `http://${ip}:${port}/`;
                break;
            default: // socket
                deviceUri = `socket://${ip}:${port}`;
        }

        // Parse manufacturer from name if not provided
        let finalManufacturer = manufacturer;
        if (!finalManufacturer) {
            const searchText = `${name} ${description}`.toLowerCase();
            const brands = ['hp', 'epson', 'canon', 'brother', 'xerox', 'ricoh', 'lexmark', 'samsung', 'kyocera',
                          'star', 'munbyn', 'snbc', 'citizen', 'bixolon', 'zebra', 'honeywell', 'tsc'];
            for (const brand of brands) {
                if (searchText.includes(brand)) {
                    finalManufacturer = brand.charAt(0).toUpperCase() + brand.slice(1);
                    break;
                }
            }
        }

        // Add to CUPS using cupsServiceV2
        try {
            const cupsResult = await cupsService.addPrinter({
                name: cupsName,
                ip,
                port,
                protocol,
                location,
                description,
                driver: finalDriver,
                manufacturer: finalManufacturer || '',
                model: model || name,
                skipDetection: true  // We already determined the driver
            });
            
            if (!cupsResult.success) {
                logger.error('CUPS add printer failed:', cupsResult.error);
                return res.status(500).json({ 
                    error: 'Failed to add printer to CUPS',
                    details: cupsResult.error
                });
            }
        } catch (cupsError) {
            logger.error('CUPS add printer exception:', cupsError);
            return res.status(500).json({ 
                error: 'Failed to add printer to CUPS',
                details: cupsError.message
            });
        }

        // Add to database
        const printerTypeValue = isImpact ? 'impact' : (isThermal ? 'thermal' : 'network');
        const snmpEnabled = (isThermal || isImpact) ? 0 : 1; // Disable SNMP for POS printers
        const result = await db.query(`
            INSERT INTO printers (
                name, ip_address, port, protocol, printer_type, cups_name, 
                manufacturer, model, location, description, 
                status, snmp_enabled, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
        `, [
            name,
            ip,
            port,
            protocol,
            printerTypeValue,
            cupsName,
            finalManufacturer || '',
            model || name,
            location,
            description,
            snmpEnabled,
            req.user.id
        ]);

        logAction('printer', 'Printer added via discovery', {
            printer_id: result.insertId,
            ip,
            name,
            protocol
        }, req);

        res.status(201).json({
            id: result.insertId,
            name,
            ip_address: ip,
            cups_name: cupsName,
            protocol,
            message: 'Printer added successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/discovery/add-all
 * Add multiple discovered printers
 */
router.post('/add-all', async (req, res, next) => {
    try {
        const { printers } = req.body;

        if (!printers || !Array.isArray(printers) || printers.length === 0) {
            return res.status(400).json({ error: 'Printers array required' });
        }

        const results = {
            added: [],
            failed: [],
            skipped: []
        };

        for (const printer of printers) {
            try {
                // Check if exists
                const existing = await db.queryOne(
                    'SELECT id FROM printers WHERE ip_address = ?',
                    [printer.ip]
                );

                if (existing) {
                    results.skipped.push({
                        ip: printer.ip,
                        reason: 'Already exists'
                    });
                    continue;
                }

                const name = printer.recommended?.name || `Printer_${printer.ip.replace(/\./g, '_')}`;
                const protocol = printer.recommended?.protocol || 'socket';
                const port = printer.recommended?.port || 9100;
                const driver = printer.recommended?.driver || 'raw';

                // Include IP suffix to make CUPS name unique
                const ipSuffix = printer.ip.split('.').slice(-1)[0]; // Last octet
                const baseCupsName = name.toLowerCase()
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .substring(0, 40);
                const cupsName = `${baseCupsName}_${ipSuffix}`;

                // Add to CUPS with manufacturer and model for driver detection
                const cupsResult = await cupsService.addPrinter({
                    cupsName,
                    ip: printer.ip,
                    port,
                    protocol,
                    description: printer.info?.model || '',
                    manufacturer: printer.info?.manufacturer || '',
                    model: printer.info?.model || name
                });
                
                if (!cupsResult.success) {
                    results.failed.push({
                        ip: printer.ip,
                        error: cupsResult.error || 'CUPS add failed'
                    });
                    continue;
                }

                // Add to DB
                const result = await db.query(`
                    INSERT INTO printers (
                        name, ip_address, port, protocol, cups_name,
                        manufacturer, model, description, status, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?)
                `, [
                    name,
                    printer.ip,
                    port,
                    protocol,
                    cupsName,
                    printer.info?.manufacturer || null,
                    printer.info?.model || name,
                    printer.info?.description || '',
                    req.user.id
                ]);

                results.added.push({
                    id: result.insertId,
                    ip: printer.ip,
                    name
                });

            } catch (err) {
                results.failed.push({
                    ip: printer.ip,
                    error: err.message
                });
            }
        }

        logAction('printer', 'Bulk printers added', {
            added: results.added.length,
            failed: results.failed.length,
            skipped: results.skipped.length
        }, req);

        res.json({
            message: `Added ${results.added.length} printers`,
            results
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
