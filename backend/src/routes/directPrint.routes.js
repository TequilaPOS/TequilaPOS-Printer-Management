// ===========================================
// Direct Printing Routes - For thermal/receipt printers
// ===========================================

const express = require('express');
const thermalPrinter = require('../services/thermalPrinter');
const db = require('../config/database');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/direct-print/test-connection
 * Test direct TCP connection to printer
 */
router.post('/test-connection', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100 } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        const result = await thermalPrinter.testTcpConnection(ip, port);
        
        res.json({
            success: true,
            message: `Successfully connected to ${ip}:${port}`,
            ...result
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/detect
 * Auto-detect printer type
 */
router.post('/detect', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100 } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        const result = await thermalPrinter.detectPrinterType(ip, port);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/test-page
 * Print a test page via direct TCP
 */
router.post('/test-page', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100, printerType = 'epson' } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        const result = await thermalPrinter.printTestPage(ip, port, printerType);
        
        // Log action
        await logAction(req, 'print', 'direct_print', { ip, port, printerType, success: result.success });
        
        res.json(result);
        
    } catch (error) {
        logger.error('Direct print test page error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/text
 * Print raw text via direct TCP
 */
router.post('/text', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100, text, printerType = 'epson', cut = true, feed = 3 } = req.body;
        
        if (!ip || !text) {
            return res.status(400).json({ error: 'IP address and text are required' });
        }
        
        const result = await thermalPrinter.printText(ip, port, text, { printerType, cut, feed });
        
        // Log action
        await logAction(req, 'print', 'direct_print_text', { 
            ip, port, textLength: text.length, success: result.success 
        });
        
        res.json(result);
        
    } catch (error) {
        logger.error('Direct print text error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/cash-drawer
 * Open cash drawer
 */
router.post('/cash-drawer', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100, printerType = 'epson' } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        const result = await thermalPrinter.openCashDrawer(ip, port, printerType);
        
        // Log action
        await logAction(req, 'action', 'open_cash_drawer', { ip, port, success: result.success });
        
        res.json(result);
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/beep
 * Trigger printer beep
 */
router.post('/beep', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { ip, port = 9100, printerType = 'epson' } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP address is required' });
        }
        
        const result = await thermalPrinter.beep(ip, port, printerType);
        
        res.json(result);
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/direct-print/scan
 * Scan network for printers
 */
router.post('/scan', requireRole(['admin']), async (req, res, next) => {
    try {
        const { baseIp, timeout = 1000 } = req.body;
        
        if (!baseIp) {
            return res.status(400).json({ error: 'Base IP is required (e.g., 192.168.1.1)' });
        }
        
        logger.info(`Starting network scan from ${baseIp}`);
        
        const results = await thermalPrinter.scanNetwork(baseIp, timeout);
        
        // Log action
        await logAction(req, 'scan', 'network_scan', { 
            baseIp, found: results.length 
        });
        
        res.json({
            success: true,
            found: results.length,
            printers: results
        });
        
    } catch (error) {
        logger.error('Network scan error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/direct-print/printer-types
 * Get supported printer types
 */
router.get('/printer-types', async (req, res) => {
    res.json({
        types: [
            { id: 'epson', name: 'EPSON', description: 'EPSON TM series and compatible' },
            { id: 'star', name: 'STAR', description: 'Star Micronics TSP series' },
            { id: 'custom', name: 'CUSTOM', description: 'CUSTOM thermal printers' },
            { id: 'bematech', name: 'BEMATECH', description: 'Bematech MP series' },
            { id: 'daruma', name: 'DARUMA', description: 'Daruma thermal printers' },
            { id: 'brother', name: 'BROTHER', description: 'Brother label printers' }
        ],
        protocols: [
            { id: 'tcp', name: 'TCP/IP', port: 9100, description: 'Direct socket connection' },
            { id: 'ipp', name: 'IPP', port: 631, description: 'Internet Printing Protocol' },
            { id: 'cups', name: 'CUPS', port: null, description: 'CUPS print server' }
        ]
    });
});

/**
 * POST /api/direct-print/by-printer/:id/test
 * Print test page for a specific printer from database
 */
router.post('/by-printer/:id/test', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const printer = await db.queryOne(
            'SELECT * FROM printers WHERE id = ?',
            [req.params.id]
        );
        
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        const port = printer.port || 9100;
        const printerType = printer.printer_type || 'epson';
        
        const result = await thermalPrinter.printTestPage(printer.ip_address, port, printerType);
        
        // Update last test timestamp
        if (result.success) {
            await db.query(
                'UPDATE printers SET last_test_at = NOW() WHERE id = ?',
                [req.params.id]
            );
        }
        
        // Log action
        await logAction(req, 'print', 'test_page', { 
            printerId: req.params.id,
            printerName: printer.name,
            success: result.success 
        });
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('printer:test', {
                printerId: req.params.id,
                success: result.success,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            ...result,
            printer: {
                id: printer.id,
                name: printer.name
            }
        });
        
    } catch (error) {
        logger.error('Printer test page error:', error);
        next(error);
    }
});

module.exports = router;
