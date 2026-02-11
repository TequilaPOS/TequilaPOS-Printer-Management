// ===========================================
// System Routes
// ===========================================

const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const cupsService = require('../services/cupsService');
const { triggerCheck } = require('../services/printerMonitor');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/system/health
 * Public health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        // Quick database check
        await db.queryOne('SELECT 1');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * GET /api/system/stats
 * System statistics
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
    try {
        const stats = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
        
        // Database stats
        const dbStats = await db.queryOne(`
            SELECT 
                (SELECT COUNT(*) FROM printers) as total_printers,
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM print_jobs WHERE DATE(submitted_at) = CURDATE()) as jobs_today,
                (SELECT COUNT(*) FROM printers WHERE status = 'online') as printers_online
        `);
        
        res.json({ ...stats, database: dbStats });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/system/logs
 * System logs (admin only)
 */
router.get('/logs', authenticateToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const { 
            level, 
            category, 
            user_id,
            printer_id,
            search,
            date_from,
            date_to,
            page = 1, 
            limit = 100 
        } = req.query;
        
        let sql = `
            SELECT sl.*, u.name as user_name, p.name as printer_name
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            LEFT JOIN printers p ON sl.printer_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (level) {
            sql += ' AND sl.level = ?';
            params.push(level);
        }
        
        if (category) {
            sql += ' AND sl.category = ?';
            params.push(category);
        }
        
        if (user_id) {
            sql += ' AND sl.user_id = ?';
            params.push(user_id);
        }
        
        if (printer_id) {
            sql += ' AND sl.printer_id = ?';
            params.push(printer_id);
        }
        
        if (search) {
            sql += ' AND sl.message LIKE ?';
            params.push(`%${search}%`);
        }
        
        if (date_from) {
            sql += ' AND DATE(sl.created_at) >= ?';
            params.push(date_from);
        }
        
        if (date_to) {
            sql += ' AND DATE(sl.created_at) <= ?';
            params.push(date_to);
        }
        
        // Count total
        const countResult = await db.queryOne(
            sql.replace(/SELECT sl\.\*, u\.name as user_name, p\.name as printer_name/g, 'SELECT COUNT(*) as total'),
            params
        );
        
        // Add pagination
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const offset = (pageNum - 1) * limitNum;
        sql += ` ORDER BY sl.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
        
        const logs = await db.query(sql, params);
        
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                pages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/system/cups-status
 * Get CUPS system status
 */
router.get('/cups-status', authenticateToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const printers = await cupsService.listAllPrinters();
        
        res.json({
            cups: printers,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/system/refresh-printers
 * Manually trigger printer status refresh
 */
router.post('/refresh-printers', authenticateToken, requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        // Trigger immediate check
        triggerCheck();
        
        res.json({ message: 'Printer status refresh triggered' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/system/settings
 * Get system settings (admin only)
 */
router.get('/settings', authenticateToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const settings = await db.query('SELECT * FROM settings ORDER BY setting_key');
        
        // Convert to object
        const settingsObj = {};
        for (const s of settings) {
            settingsObj[s.setting_key] = s.setting_value;
        }
        
        res.json({ settings: settingsObj, raw: settings });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/system/settings
 * Update system settings
 */
router.put('/settings', authenticateToken, requireRole(['admin']), async (req, res, next) => {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Settings object required' });
        }
        
        for (const [key, value] of Object.entries(settings)) {
            await db.query(`
                INSERT INTO settings (setting_key, setting_value)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE setting_value = ?
            `, [key, value, value]);
        }
        
        res.json({ message: 'Settings updated successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/system/ping
 * Ping an IP address to check if it's reachable
 */
router.post('/ping', authenticateToken, async (req, res, next) => {
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
        
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // Use ping with short timeout (1 second, 1 packet)
        const pingCmd = process.platform === 'win32' 
            ? `ping -n 1 -w 1000 ${ip}`
            : `ping -c 1 -W 1 ${ip}`;
        
        try {
            await execPromise(pingCmd, { timeout: 3000 });
            res.json({ ip, status: 'online', reachable: true });
        } catch (pingError) {
            res.json({ ip, status: 'offline', reachable: false });
        }
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/system/ping-batch
 * Ping multiple IP addresses at once
 */
router.post('/ping-batch', authenticateToken, async (req, res, next) => {
    try {
        const { ips } = req.body;
        
        if (!ips || !Array.isArray(ips)) {
            return res.status(400).json({ error: 'Array of IP addresses required' });
        }
        
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        
        const results = await Promise.all(ips.map(async (ip) => {
            if (!ipRegex.test(ip)) {
                return { ip, status: 'invalid', reachable: false };
            }
            
            const pingCmd = process.platform === 'win32' 
                ? `ping -n 1 -w 1000 ${ip}`
                : `ping -c 1 -W 1 ${ip}`;
            
            try {
                await execPromise(pingCmd, { timeout: 3000 });
                return { ip, status: 'online', reachable: true };
            } catch (pingError) {
                return { ip, status: 'offline', reachable: false };
            }
        }));
        
        res.json({ results });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
