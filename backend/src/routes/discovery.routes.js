// ===========================================
// Discovery Routes
// Network printer auto-discovery
// ===========================================

const express = require('express');
const discoveryService = require('../services/discoveryService');
const cupsService = require('../services/cupsService');
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
            driver = 'raw',
            location = '',
            description = ''
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

        // Parse manufacturer from name/description BEFORE adding to CUPS
        let manufacturer = null;
        const searchText = (name + ' ' + description).toLowerCase();
        const brands = ['hp', 'epson', 'canon', 'brother', 'xerox', 'ricoh', 'lexmark', 'samsung', 'kyocera'];
        for (const brand of brands) {
            if (searchText.includes(brand)) {
                manufacturer = brand.charAt(0).toUpperCase() + brand.slice(1);
                break;
            }
        }

        // Add to CUPS with manufacturer and model info for driver detection
        try {
            const cupsResult = await cupsService.addPrinter({
                cupsName,
                ip,
                port,
                protocol,
                location,
                description,
                manufacturer: manufacturer || '',
                model: name
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
        const result = await db.query(`
            INSERT INTO printers (
                name, ip_address, port, protocol, cups_name, 
                manufacturer, model, location, description, 
                status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?)
        `, [
            name,
            ip,
            port,
            protocol,
            cupsName,
            manufacturer,
            name, // Use name as model for now
            location,
            description,
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
