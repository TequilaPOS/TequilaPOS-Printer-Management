// ===========================================
// Notification Service
// ===========================================

const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.emailTransporter = null;
        this.initEmailTransporter();
    }

    initEmailTransporter() {
        if (process.env.SMTP_HOST) {
            this.emailTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });
            
            // Verify connection
            this.emailTransporter.verify((error) => {
                if (error) {
                    logger.warn('Email transporter not available:', error.message);
                } else {
                    logger.info('Email transporter ready');
                }
            });
        }
    }

    /**
     * Send notification based on event
     */
    async sendNotification({ eventType, printerId, printerName, message, details = {} }) {
        logger.info(`Sending notification: ${eventType} for printer ${printerName}`);
        
        try {
            // Get notification configs for this event
            const configs = await db.query(
                `SELECT nc.*, u.email as user_email, u.name as user_name
                 FROM notification_configs nc
                 JOIN users u ON nc.user_id = u.id
                 WHERE nc.is_enabled = 1 
                 AND nc.event_type = ?
                 AND (nc.printer_id IS NULL OR nc.printer_id = ?)`,
                [eventType, printerId]
            );
            
            const results = [];
            
            for (const config of configs) {
                try {
                    let result;
                    
                    switch (config.notification_method) {
                        case 'email':
                            result = await this.sendEmail(config, eventType, printerName, message);
                            break;
                        case 'webhook':
                            result = await this.sendWebhook(config, eventType, printerId, printerName, message, details);
                            break;
                        case 'in_app':
                            result = await this.createInAppNotification(config.user_id, printerId, eventType, printerName, message);
                            break;
                    }
                    
                    results.push({ configId: config.id, method: config.notification_method, success: true });
                    
                } catch (error) {
                    logger.error(`Failed to send ${config.notification_method} notification:`, error);
                    results.push({ configId: config.id, method: config.notification_method, success: false, error: error.message });
                }
            }
            
            return results;
            
        } catch (error) {
            logger.error('Notification service error:', error);
            throw error;
        }
    }

    /**
     * Send email notification
     */
    async sendEmail(config, eventType, printerName, message) {
        if (!this.emailTransporter) {
            throw new Error('Email not configured');
        }
        
        const destination = config.destination || config.user_email;
        
        const subject = `[Printer Alert] ${eventType.replace(/_/g, ' ').toUpperCase()} - ${printerName}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1a56db; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9fafb; }
                    .alert { padding: 15px; border-radius: 5px; margin: 10px 0; }
                    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
                    .alert-danger { background: #fee2e2; border-left: 4px solid #ef4444; }
                    .alert-success { background: #d1fae5; border-left: 4px solid #10b981; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🖨️ Printer Management System</h1>
                    </div>
                    <div class="content">
                        <h2>Notification: ${eventType.replace(/_/g, ' ')}</h2>
                        <div class="alert ${eventType.includes('offline') ? 'alert-danger' : eventType.includes('online') ? 'alert-success' : 'alert-warning'}">
                            <strong>Printer:</strong> ${printerName}<br>
                            <strong>Message:</strong> ${message}<br>
                            <strong>Time:</strong> ${new Date().toLocaleString()}
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Printer Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        await this.emailTransporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: destination,
            subject,
            html
        });
        
        logger.info(`Email sent to ${destination}`);
        return { sent: true, destination };
    }

    /**
     * Send webhook notification
     */
    async sendWebhook(config, eventType, printerId, printerName, message, details) {
        if (!config.destination) {
            throw new Error('Webhook URL not configured');
        }
        
        const payload = {
            event: eventType,
            printer: {
                id: printerId,
                name: printerName
            },
            message,
            details,
            timestamp: new Date().toISOString()
        };
        
        const response = await axios.post(config.destination, payload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'PrinterManagement/1.0'
            }
        });
        
        logger.info(`Webhook sent to ${config.destination}, status: ${response.status}`);
        return { sent: true, status: response.status };
    }

    /**
     * Create in-app notification
     */
    async createInAppNotification(userId, printerId, eventType, printerName, message) {
        const title = `${eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
        
        await db.insert(
            `INSERT INTO notifications (user_id, printer_id, event_type, title, message)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, printerId, eventType, title, message]
        );
        
        return { created: true };
    }

    /**
     * Get unread notifications for user
     */
    async getUnreadNotifications(userId) {
        return await db.query(
            `SELECT n.*, p.name as printer_name
             FROM notifications n
             LEFT JOIN printers p ON n.printer_id = p.id
             WHERE n.user_id = ? AND n.is_read = 0
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [userId]
        );
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        await db.update(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
            [notificationId, userId]
        );
    }

    /**
     * Mark all notifications as read for user
     */
    async markAllAsRead(userId) {
        await db.update(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
            [userId]
        );
    }

    /**
     * Send test notification
     */
    async sendTestNotification(config) {
        const testMessage = 'This is a test notification from Printer Management System';
        
        switch (config.notification_method) {
            case 'email':
                return await this.sendEmail(config, 'test', 'Test Printer', testMessage);
            case 'webhook':
                return await this.sendWebhook(config, 'test', 0, 'Test Printer', testMessage, {});
            case 'in_app':
                return await this.createInAppNotification(config.user_id, null, 'test', 'Test Printer', testMessage);
            default:
                throw new Error('Unknown notification method');
        }
    }
}

module.exports = new NotificationService();
