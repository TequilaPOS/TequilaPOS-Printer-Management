// ===========================================
// Printer Routes - v2 with Auto-Detection
// ===========================================

const express = require('express');
const db = require('../config/database');
const cupsService = require('../services/cupsServiceV2');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const { isValidIP, isValidHostname, pingHost } = require('../utils/shellExec');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Sync database with CUPS - remove printers that don't exist in CUPS
 */
async function syncWithCUPS() {
    try {
        // Get all printers from CUPS
        const cupsPrinters = await cupsService.listPrinters();
        const cupsNames = new Set(cupsPrinters.map(p => p.name));
        
        // Get all printers from database
        const dbPrinters = await db.query('SELECT id, name, cups_name FROM printers');
        
        const removed = [];
        for (const printer of dbPrinters) {
            if (printer.cups_name && !cupsNames.has(printer.cups_name)) {
                // Printer exists in DB but not in CUPS - remove from DB
                logger.info(`Sync: Removing printer "${printer.name}" (${printer.cups_name}) - not found in CUPS`);
                await db.update('DELETE FROM printers WHERE id = ?', [printer.id]);
                removed.push({ id: printer.id, name: printer.name, cups_name: printer.cups_name });
            }
        }
        
        return { synced: true, removed, cupsCount: cupsPrinters.length, dbCount: dbPrinters.length - removed.length };
    } catch (error) {
        logger.error('Sync with CUPS failed:', error);
        return { synced: false, error: error.message };
    }
}

/**
 * POST /api/printers/sync
 * Manually sync database with CUPS
 */
router.post('/sync', requireRole(['admin']), async (req, res, next) => {
    try {
        const result = await syncWithCUPS();
        
        if (result.removed && result.removed.length > 0) {
            await logAction('printer', 'Sync: Removed orphaned printers', { 
                removed: result.removed 
            }, req);
        }
        
        res.json({
            message: result.removed?.length > 0 
                ? `Synced: Removed ${result.removed.length} orphaned printer(s)`
                : 'All printers are in sync',
            ...result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers
 * List all printers with current status
 */
router.get('/', async (req, res, next) => {
    try {
        const { status, location, search, autoSync } = req.query;
        
        // Auto-sync on each request if enabled (default: true for admins)
        if (autoSync !== 'false') {
            await syncWithCUPS();
        }
        
        let sql = `
            SELECT p.*, u.name as created_by_name,
                   (SELECT COUNT(*) FROM print_jobs WHERE printer_id = p.id AND DATE(submitted_at) = CURDATE()) as jobs_today
            FROM printers p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            sql += ' AND p.status = ?';
            params.push(status);
        }
        
        if (location) {
            sql += ' AND p.location LIKE ?';
            params.push(`%${location}%`);
        }
        
        if (search) {
            sql += ' AND (p.name LIKE ? OR p.ip_address LIKE ? OR p.cups_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        sql += ' ORDER BY p.is_default DESC, p.name ASC';
        
        const printers = await db.query(sql, params);
        
        // Sync status with CUPS
        for (const printer of printers) {
            if (printer.cups_name) {
                try {
                    const cupsStatus = await cupsService.getPrinterStatus(printer.cups_name);
                    printer.cupsStatus = cupsStatus.status;
                } catch (e) {
                    printer.cupsStatus = 'unknown';
                }
            }
        }
        
        res.json({
            printers,
            total: printers.length
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/detect
 * Auto-detect printer at IP address
 */
router.post('/detect', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip_address, port = 9100 } = req.body;
        
        if (!ip_address) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        if (!isValidIP(ip_address) && !isValidHostname(ip_address)) {
            return res.status(400).json({ error: 'Invalid IP address or hostname' });
        }
        
        // Test connectivity first
        const pingResult = await pingHost(ip_address);
        if (!pingResult.success) {
            return res.status(400).json({ 
                error: 'Cannot reach printer at specified IP',
                details: pingResult
            });
        }
        
        // Auto-detect printer
        const detected = await cupsService.detectPrinter(ip_address, port);
        
        // Get available drivers
        const drivers = await cupsService.getAvailableDrivers();
        
        res.json({
            detected,
            connectivity: pingResult,
            availableDrivers: drivers.slice(0, 20) // Top 20 drivers
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/drivers
 * List all available drivers
 */
router.get('/drivers', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const drivers = await cupsService.getAvailableDrivers();
        res.json({ drivers });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/cups
 * List all CUPS printers
 */
router.get('/cups', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printers = await cupsService.listPrinters();
        res.json({ printers });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/:id
 * Get printer details
 */
router.get('/:id', async (req, res, next) => {
    try {
        const printer = await db.queryOne(`
            SELECT p.*, u.name as created_by_name
            FROM printers p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.id = ?
        `, [req.params.id]);
        
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Get CUPS status
        const cupsStatus = await cupsService.getPrinterStatus(printer.cups_name);
        
        // Get recent jobs
        const recentJobs = await db.query(`
            SELECT * FROM print_jobs 
            WHERE printer_id = ? 
            ORDER BY submitted_at DESC 
            LIMIT 10
        `, [req.params.id]);
        
        res.json({
            ...printer,
            cupsStatus,
            recentJobs
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers
 * Add a new printer (with auto-detection)
 */
router.post('/', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { 
            name, 
            ip_address, 
            dns_name, 
            port = 9100, 
            protocol = 'socket',
            location, 
            description,
            manufacturer,
            model,
            driver,  // Optional: specific driver to use
            printerType = 'auto',  // 'auto', 'thermal', 'impact', 'network'
            skipDetection = true  // Skip slow auto-detection by default
        } = req.body;
        
        // Validation
        if (!name || !ip_address) {
            return res.status(400).json({ error: 'Name and IP address are required' });
        }
        
        if (!isValidIP(ip_address) && !isValidHostname(ip_address)) {
            return res.status(400).json({ error: 'Invalid IP address or hostname' });
        }
        
        // Check for duplicate IP
        const existing = await db.queryOne(
            'SELECT id FROM printers WHERE ip_address = ?',
            [ip_address]
        );
        if (existing) {
            return res.status(409).json({ error: 'Printer with this IP already exists' });
        }
        
        // Test connectivity first (quick ping)
        const pingResult = await pingHost(ip_address);
        if (!pingResult.success) {
            return res.status(400).json({ 
                error: 'Cannot reach printer at specified IP',
                details: pingResult
            });
        }
        
        // Determine driver based on printerType selection
        let selectedDriver = driver;
        if (!selectedDriver && printerType !== 'auto') {
            switch (printerType) {
                case 'thermal':
                    selectedDriver = 'raw';  // ESC/POS compatible
                    break;
                case 'impact':
                    // Use Epson impact driver if manufacturer is Epson
                    if ((manufacturer || '').toLowerCase().includes('epson') || 
                        (name || '').toLowerCase().includes('epson') ||
                        (model || '').toLowerCase().includes('tm-u')) {
                        selectedDriver = 'EPSON/tm-impact-receipt-rastertotmir.ppd';
                    } else {
                        selectedDriver = 'raw';  // Generic impact
                    }
                    break;
                case 'network':
                    selectedDriver = 'everywhere';  // IPP Everywhere
                    break;
            }
            logger.info(`Manual printerType selection: ${printerType} → driver: ${selectedDriver}`);
        }
        
        // Add to CUPS (skip slow detection by default)
        const cupsResult = await cupsService.addPrinter({
            name,
            ip: ip_address,
            port,
            protocol,
            location,
            description: description || `${manufacturer || ''} ${model || ''}`.trim(),
            driver: selectedDriver,
            manufacturer,  // Pass manufacturer for driver detection
            model,         // Pass model for driver detection
            skipDetection: selectedDriver ? true : (skipDetection !== false)  // Skip if we already have driver
        });
        
        if (!cupsResult.success) {
            return res.status(500).json({ 
                error: 'Failed to add printer to CUPS',
                details: cupsResult.error
            });
        }
        
        // Get detected info
        const detected = cupsResult.detected || {};
        const finalManufacturer = manufacturer || detected.manufacturer || null;
        const finalModel = model || detected.model || null;
        const finalDescription = description || (detected.manufacturer ? `${detected.manufacturer} ${detected.model || ''}`.trim() : null);
        
        // Add to database
        const printerId = await db.insert(`
            INSERT INTO printers 
            (name, ip_address, dns_name, port, protocol, cups_name, 
             manufacturer, model, location, description, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?)
        `, [
            name, ip_address, dns_name || null, port, protocol, cupsResult.cupsName,
            finalManufacturer, finalModel, location || null, finalDescription, req.user.id
        ]);
        
        await logAction('printer', 'Printer added', { 
            printerId, name, ip_address, 
            cupsName: cupsResult.cupsName,
            driver: cupsResult.driver,
            detected
        }, req);
        
        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.emit('printer:added', { printerId, name, ip_address });
        }
        
        res.status(201).json({
            id: printerId,
            name,
            ip_address,
            cups_name: cupsResult.cupsName,
            driver: cupsResult.driver,
            detected,
            message: 'Printer added successfully'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/printers/:id
 * Update printer
 */
router.put('/:id', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { name, dns_name, location, description, manufacturer, model } = req.body;
        
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Check if name is being changed - need to update CUPS
        let newCupsName = printer.cups_name;
        if (name && name !== printer.name) {
            // Generate new CUPS name
            newCupsName = cupsService.generateCupsName(name);
            
            // Remove old printer from CUPS
            try {
                await cupsService.deletePrinter(printer.cups_name);
            } catch (e) {
                logger.warn(`Failed to remove old CUPS printer: ${e.message}`);
            }
            
            // Add printer with new name
            const cupsResult = await cupsService.addPrinter({
                name: name,
                ip: printer.ip_address,
                port: printer.port || 9100,
                protocol: printer.protocol || 'socket',
                location: location || printer.location,
                description: description || printer.description,
                skipDetection: true
            });
            
            if (!cupsResult.success) {
                // Try to restore old printer
                await cupsService.addPrinter({
                    name: printer.name,
                    ip: printer.ip_address,
                    port: printer.port || 9100,
                    protocol: printer.protocol || 'socket',
                    location: printer.location,
                    description: printer.description,
                    skipDetection: true
                });
                return res.status(500).json({ 
                    error: 'Failed to rename printer in CUPS',
                    details: cupsResult.error
                });
            }
            
            newCupsName = cupsResult.cupsName;
        }
        
        await db.update(`
            UPDATE printers SET
                name = COALESCE(?, name),
                cups_name = ?,
                dns_name = COALESCE(?, dns_name),
                location = COALESCE(?, location),
                description = COALESCE(?, description),
                manufacturer = COALESCE(?, manufacturer),
                model = COALESCE(?, model),
                updated_at = NOW()
            WHERE id = ?
        `, [
            name || null,
            newCupsName,
            dns_name || null, 
            location || null, 
            description || null, 
            manufacturer || null, 
            model || null, 
            req.params.id
        ]);
        
        await logAction('printer', 'Printer updated', { 
            printerId: req.params.id,
            nameChanged: name !== printer.name,
            oldCupsName: printer.cups_name,
            newCupsName
        }, req);
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('printer:updated', { printerId: req.params.id });
        }
        
        res.json({ 
            message: 'Printer updated successfully',
            cups_name: newCupsName
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/printers/:id
 * Delete printer (admin only)
 */
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Remove from CUPS (ignore errors if printer doesn't exist in CUPS)
        try {
            await cupsService.deletePrinter(printer.cups_name);
        } catch (cupsError) {
            logger.warn(`CUPS delete failed for ${printer.cups_name}: ${cupsError.message}`);
            // Continue anyway - we still want to remove from database
        }
        
        // Log BEFORE deleting (don't pass printerId since it will be deleted)
        await logAction('printer', 'Printer deleted', { 
            deletedPrinterId: req.params.id, 
            name: printer.name,
            ip: printer.ip_address
        }, req);
        
        // Delete from database (cascade will handle related records)
        await db.update('DELETE FROM printers WHERE id = ?', [req.params.id]);
        
        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.emit('printer:removed', { printerId: req.params.id });
        }
        
        res.json({ message: 'Printer deleted successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/test
 * Test printer connectivity and print test page
 */
router.post('/:id/test', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Test connectivity
        const pingResult = await pingHost(printer.ip_address);
        
        // Get CUPS status
        let cupsStatus = null;
        if (printer.cups_name) {
            cupsStatus = await cupsService.getPrinterStatus(printer.cups_name);
        }
        
        // Print test page if requested and printer is reachable
        let printResult = null;
        if (req.body.printPage && pingResult.success && printer.cups_name) {
            printResult = await cupsService.printTestPage(printer.cups_name);
            
            // Log the test print job
            if (printResult.success) {
                await db.insert(`
                    INSERT INTO print_jobs (printer_id, user_id, document_name, status, pages)
                    VALUES (?, ?, 'Test Page', 'completed', 1)
                `, [printer.id, req.user.id]);
            }
        }
        
        // Try to get toner levels
        let tonerLevels = null;
        if (pingResult.success) {
            tonerLevels = await cupsService.getTonerLevels(printer.ip_address);
        }
        
        res.json({
            connectivity: pingResult,
            cupsStatus,
            testPrint: printResult,
            tonerLevels
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/printers/:id/maintenance
 * Toggle individual printer maintenance mode
 */
router.put('/:id/maintenance', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { enabled, note, until } = req.body;
        
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        await db.update(`
            UPDATE printers SET
                in_maintenance = ?,
                maintenance_note = ?,
                maintenance_until = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            enabled ? 1 : 0,
            enabled ? (note || null) : null,
            enabled && until ? new Date(until) : null,
            req.params.id
        ]);
        
        await logAction('printer', enabled ? 'Printer put in maintenance' : 'Printer maintenance ended', { 
            printerId: req.params.id,
            note
        }, req);
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('printer:maintenance', { 
                printerId: req.params.id, 
                inMaintenance: enabled,
                note
            });
        }
        
        res.json({ 
            message: enabled ? 'Printer is now in maintenance mode' : 'Maintenance mode ended',
            inMaintenance: enabled
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/print-test
 * Print a test page to verify printer configuration
 */
router.post('/:id/print-test', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        if (!printer.cups_name) {
            return res.status(400).json({ error: 'Printer not configured in CUPS' });
        }
        
        const result = await cupsService.printTestPage(printer.cups_name);
        
        if (result.success) {
            // Log the print job - extract numeric job ID
            const jobIdMatch = result.jobId ? result.jobId.match(/(\d+)$/) : null;
            const numericJobId = jobIdMatch ? parseInt(jobIdMatch[1]) : null;
            
            await db.insert(`
                INSERT INTO print_jobs (printer_id, user_id, document_name, status, pages, cups_job_id)
                VALUES (?, ?, 'Test Page', 'processing', 1, ?)
            `, [printer.id, req.user.id, numericJobId]);
            
            await logAction('print', 'Test page printed', { printerId: printer.id, jobId: result.jobId }, req);
        }
        
        res.json(result);
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/:id/toner
 * Get toner levels for printer
 */
router.get('/:id/toner', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const tonerLevels = await cupsService.getTonerLevels(printer.ip_address);
        
        // Update in DB if we got levels
        if (tonerLevels && tonerLevels.black !== undefined) {
            await db.update(`
                UPDATE printers SET toner_level = ?, updated_at = NOW() WHERE id = ?
            `, [tonerLevels.black, printer.id]);
        }
        
        res.json({ 
            tonerLevels,
            message: tonerLevels ? 'Toner levels retrieved' : 'Unable to read toner levels (SNMP may not be supported)'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/set-default
 * Set printer as default
 */
router.post('/:id/set-default', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Set in CUPS
        const result = await cupsService.setDefaultPrinter(printer.cups_name);
        if (!result.success) {
            return res.status(500).json({ error: 'Failed to set default printer in CUPS' });
        }
        
        // Update database
        await db.update('UPDATE printers SET is_default = 0');
        await db.update('UPDATE printers SET is_default = 1 WHERE id = ?', [req.params.id]);
        
        await logAction('printer', 'Default printer set', { printerId: req.params.id }, req);
        
        res.json({ message: 'Default printer set successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/enable
 * Enable/disable printer
 */
router.post('/:id/toggle', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { enable } = req.body;
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const cmd = enable ? 'cupsenable' : 'cupsdisable';
        const { execCommand, sanitizeForShell } = require('../utils/shellExec');
        await execCommand(`${cmd} "${sanitizeForShell(printer.cups_name)}"`);
        
        const newStatus = enable ? 'online' : 'paused';
        await db.update('UPDATE printers SET status = ? WHERE id = ?', [newStatus, req.params.id]);
        
        res.json({ message: `Printer ${enable ? 'enabled' : 'disabled'} successfully` });
        
    } catch (error) {
        next(error);
    }
});

// ===========================================
// SNMP Monitoring Endpoints
// ===========================================

/**
 * GET /api/printers/:id/snmp
 * Get full SNMP status including supplies, page count, errors
 */
router.get('/:id/snmp', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const { snmpMonitor } = require('../services/snmpMonitor');
        const status = await snmpMonitor.getPrinterStatus(printer.ip_address);
        
        res.json({
            printer: {
                id: printer.id,
                name: printer.name,
                ip_address: printer.ip_address
            },
            snmp: status
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/:id/supplies
 * Get supply levels (toner, ink, etc.) from database or live SNMP
 */
router.get('/:id/supplies', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const { live } = req.query;
        
        if (live === 'true') {
            // Get live data from SNMP
            const { snmpMonitor } = require('../services/snmpMonitor');
            const status = await snmpMonitor.getPrinterStatus(printer.ip_address);
            return res.json({ supplies: status.supplies, source: 'live' });
        }
        
        // Get from database
        const supplies = await db.query(
            'SELECT * FROM printer_supplies WHERE printer_id = ? ORDER BY name',
            [req.params.id]
        );
        
        res.json({ supplies, source: 'cached' });
        
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.json({ supplies: [], message: 'Supply tracking not yet enabled' });
        }
        next(error);
    }
});

/**
 * GET /api/printers/:id/page-count
 * Get page counter from printer via SNMP
 */
router.get('/:id/page-count', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const { snmpMonitor } = require('../services/snmpMonitor');
        const status = await snmpMonitor.getPrinterStatus(printer.ip_address);
        
        // Update database if we got page count
        if (status.pageCount !== null) {
            await db.update(
                'UPDATE printers SET page_count = ?, updated_at = NOW() WHERE id = ?',
                [status.pageCount, printer.id]
            );
        }
        
        res.json({ 
            pageCount: status.pageCount,
            printerState: status.printerState,
            errors: status.errors
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/poll
 * Force immediate SNMP poll for printer
 */
router.post('/:id/poll', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const { printerMonitor } = require('../services/printerMonitor');
        const status = await printerMonitor.forcePoll(printer.id);
        
        await logAction('printer', 'Manual poll triggered', { printerId: req.params.id }, req);
        
        res.json({ 
            message: 'Printer polled successfully',
            status 
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/discover
 * Discover printers on local network via SNMP broadcast
 */
router.get('/discover', requireRole(['admin']), async (req, res, next) => {
    try {
        const { network = '255.255.255.255' } = req.query;
        
        const { snmpMonitor } = require('../services/snmpMonitor');
        const discovered = await snmpMonitor.discoverPrinters(network);
        
        // Check which are already in database
        const existingIPs = await db.query('SELECT ip_address FROM printers');
        const existingSet = new Set(existingIPs.map(p => p.ip_address));
        
        const results = discovered.map(p => ({
            ...p,
            alreadyAdded: existingSet.has(p.ip)
        }));
        
        res.json({
            discovered: results,
            total: results.length,
            new: results.filter(p => !p.alreadyAdded).length
        });
        
    } catch (error) {
        next(error);
    }
});

// ===========================================
// CUPS Control Endpoints
// ===========================================

const { execCommand } = require('../utils/shellExec');

/**
 * POST /api/printers/:id/pause
 * Pause printer (stop accepting jobs but keep current jobs)
 */
router.post('/:id/pause', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        await execCommand(`cupsdisable "${printer.cups_name}"`);
        await db.update('UPDATE printers SET status = ? WHERE id = ?', ['paused', req.params.id]);
        await logAction('printer', 'Printer paused', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'Printer paused' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/resume
 * Resume printer (start processing jobs again)
 */
router.post('/:id/resume', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        await execCommand(`cupsenable "${printer.cups_name}"`);
        await db.update('UPDATE printers SET status = ? WHERE id = ?', ['online', req.params.id]);
        await logAction('printer', 'Printer resumed', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'Printer resumed' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/reject
 * Stop accepting new jobs
 */
router.post('/:id/reject', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        await execCommand(`cupsreject "${printer.cups_name}"`);
        await logAction('printer', 'Printer rejecting jobs', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'Printer now rejecting new jobs' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/accept
 * Start accepting new jobs
 */
router.post('/:id/accept', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        await execCommand(`cupsaccept "${printer.cups_name}"`);
        await logAction('printer', 'Printer accepting jobs', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'Printer now accepting jobs' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/set-default
 * Set as default printer
 */
router.post('/:id/set-default', requireRole(['admin']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        await execCommand(`lpadmin -d "${printer.cups_name}"`);
        
        // Update database
        await db.update('UPDATE printers SET is_default = 0');
        await db.update('UPDATE printers SET is_default = 1 WHERE id = ?', [req.params.id]);
        
        await logAction('printer', 'Set as default printer', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'Printer set as default' });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/printers/:id/options
 * Set printer options/defaults
 */
router.put('/:id/options', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured in CUPS' });
        }
        
        const { options } = req.body;
        // options format: { "sides": "two-sided-long-edge", "ColorModel": "Gray" }
        
        if (!options || typeof options !== 'object') {
            return res.status(400).json({ error: 'Options object is required' });
        }
        
        // Build lpadmin command for each option
        for (const [key, value] of Object.entries(options)) {
            await execCommand(`lpadmin -p "${printer.cups_name}" -o ${key}=${value}`);
        }
        
        await logAction('printer', 'Printer options updated', { printerId: req.params.id, options }, req);
        
        res.json({ success: true, message: 'Printer options updated' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/printers/:id/jobs
 * Get print queue for a specific printer
 */
router.get('/:id/jobs', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const pending = await cupsService.getJobs(printer.cups_name, false);
        const completed = await cupsService.getJobs(printer.cups_name, true);
        
        res.json({
            printer: printer.name,
            pending,
            completed: completed.slice(0, 20) // Last 20 completed
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/printers/:id/jobs
 * Cancel all jobs for a printer
 */
router.delete('/:id/jobs', requireRole(['admin']), async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        await execCommand(`cancel -a "${printer.cups_name}"`);
        await logAction('printer', 'All jobs cancelled', { printerId: req.params.id }, req);
        
        res.json({ success: true, message: 'All jobs cancelled' });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/printers/:id/move-job
 * Move a job to another printer
 */
router.post('/:id/move-job', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { jobId, targetPrinterId } = req.body;
        
        if (!jobId || !targetPrinterId) {
            return res.status(400).json({ error: 'jobId and targetPrinterId are required' });
        }
        
        const targetPrinter = await db.queryOne('SELECT * FROM printers WHERE id = ?', [targetPrinterId]);
        if (!targetPrinter || !targetPrinter.cups_name) {
            return res.status(404).json({ error: 'Target printer not found' });
        }
        
        await execCommand(`lpmove ${jobId} "${targetPrinter.cups_name}"`);
        await logAction('printer', 'Job moved', { jobId, targetPrinterId }, req);
        
        res.json({ success: true, message: `Job moved to ${targetPrinter.name}` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
