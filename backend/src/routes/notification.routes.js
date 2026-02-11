// ===========================================
// Notification Routes
// ===========================================

const express = require('express');
const db = require('../config/database');
const notificationService = require('../services/notificationService');
const { authenticateToken, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/notifications
 * Get user's in-app notifications
 */
router.get('/', async (req, res, next) => {
    try {
        const { unread_only, limit = 50 } = req.query;
        
        let sql = `
            SELECT n.*, p.name as printer_name
            FROM notifications n
            LEFT JOIN printers p ON n.printer_id = p.id
            WHERE n.user_id = ?
        `;
        const params = [req.user.id];
        
        if (unread_only === 'true') {
            sql += ' AND n.is_read = 0';
        }
        
        sql += ' ORDER BY n.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const notifications = await db.query(sql, params);
        
        // Get unread count
        const unreadCount = await db.queryOne(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        
        res.json({
            notifications,
            unreadCount: unreadCount.count
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', async (req, res, next) => {
    try {
        await notificationService.markAsRead(req.params.id, req.user.id);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', async (req, res, next) => {
    try {
        await notificationService.markAllAsRead(req.user.id);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/notifications/configs
 * Get user's notification configurations
 */
router.get('/configs', async (req, res, next) => {
    try {
        const configs = await db.query(`
            SELECT nc.*, p.name as printer_name
            FROM notification_configs nc
            LEFT JOIN printers p ON nc.printer_id = p.id
            WHERE nc.user_id = ?
            ORDER BY nc.event_type, nc.notification_method
        `, [req.user.id]);
        
        res.json({ configs });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notifications/configs
 * Create notification configuration
 */
router.post('/configs', async (req, res, next) => {
    try {
        const { printer_id, event_type, notification_method, destination } = req.body;
        
        // Validation
        const validEvents = ['printer_offline', 'printer_online', 'paper_low', 'toner_low', 'print_error', 'printer_added'];
        const validMethods = ['email', 'webhook', 'in_app'];
        
        if (!event_type || !validEvents.includes(event_type)) {
            return res.status(400).json({ error: 'Invalid event type' });
        }
        
        if (!notification_method || !validMethods.includes(notification_method)) {
            return res.status(400).json({ error: 'Invalid notification method' });
        }
        
        if (notification_method === 'email' && !destination) {
            // Use user's email as default
            const user = await db.queryOne('SELECT email FROM users WHERE id = ?', [req.user.id]);
            req.body.destination = user.email;
        }
        
        if (notification_method === 'webhook' && !destination) {
            return res.status(400).json({ error: 'Webhook URL is required' });
        }
        
        // Check for duplicate
        const existing = await db.queryOne(`
            SELECT id FROM notification_configs 
            WHERE user_id = ? AND event_type = ? AND notification_method = ?
            AND (printer_id = ? OR (printer_id IS NULL AND ? IS NULL))
        `, [req.user.id, event_type, notification_method, printer_id, printer_id]);
        
        if (existing) {
            return res.status(409).json({ error: 'Configuration already exists' });
        }
        
        const configId = await db.insert(`
            INSERT INTO notification_configs 
            (user_id, printer_id, event_type, notification_method, destination)
            VALUES (?, ?, ?, ?, ?)
        `, [req.user.id, printer_id || null, event_type, notification_method, destination || null]);
        
        res.status(201).json({
            id: configId,
            message: 'Notification configuration created'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/notifications/configs/:id
 * Update notification configuration
 */
router.put('/configs/:id', async (req, res, next) => {
    try {
        const config = await db.queryOne(
            'SELECT * FROM notification_configs WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        const { destination, is_enabled } = req.body;
        
        await db.update(`
            UPDATE notification_configs SET
                destination = COALESCE(?, destination),
                is_enabled = COALESCE(?, is_enabled),
                updated_at = NOW()
            WHERE id = ?
        `, [destination, is_enabled, req.params.id]);
        
        res.json({ message: 'Configuration updated' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/notifications/configs/:id
 * Delete notification configuration
 */
router.delete('/configs/:id', async (req, res, next) => {
    try {
        const affected = await db.update(
            'DELETE FROM notification_configs WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        
        if (affected === 0) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        res.json({ message: 'Configuration deleted' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/notifications/test
 * Send test notification
 */
router.post('/test', async (req, res, next) => {
    try {
        const { config_id } = req.body;
        
        let config;
        if (config_id) {
            config = await db.queryOne(
                'SELECT * FROM notification_configs WHERE id = ? AND user_id = ?',
                [config_id, req.user.id]
            );
        } else {
            // Use request body as config
            config = {
                ...req.body,
                user_id: req.user.id
            };
        }
        
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        const result = await notificationService.sendTestNotification(config);
        
        res.json({
            message: 'Test notification sent',
            result
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
