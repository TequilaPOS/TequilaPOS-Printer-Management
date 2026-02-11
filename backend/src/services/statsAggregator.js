// ===========================================
// Stats Aggregator - Daily Statistics
// ===========================================

const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Aggregate yesterday's statistics for all printers
 */
async function aggregateDailyStats() {
    logger.info('Running daily stats aggregation...');
    
    try {
        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        // Get all printers
        const printers = await db.query('SELECT id FROM printers');
        
        for (const printer of printers) {
            try {
                // Calculate stats for this printer for yesterday
                const stats = await db.queryOne(`
                    SELECT 
                        COUNT(*) as total_jobs,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_jobs,
                        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_jobs,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs,
                        SUM(COALESCE(pages, 0)) as total_pages,
                        SUM(COALESCE(copies, 0)) as total_copies,
                        AVG(TIMESTAMPDIFF(SECOND, submitted_at, completed_at)) as avg_duration
                    FROM print_jobs
                    WHERE printer_id = ?
                    AND DATE(submitted_at) = ?
                `, [printer.id, dateStr]);
                
                // Insert or update stats
                await db.query(`
                    INSERT INTO printer_stats_daily 
                    (printer_id, date, total_jobs, successful_jobs, failed_jobs, cancelled_jobs, 
                     total_pages, total_copies, avg_job_duration_seconds)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        total_jobs = VALUES(total_jobs),
                        successful_jobs = VALUES(successful_jobs),
                        failed_jobs = VALUES(failed_jobs),
                        cancelled_jobs = VALUES(cancelled_jobs),
                        total_pages = VALUES(total_pages),
                        total_copies = VALUES(total_copies),
                        avg_job_duration_seconds = VALUES(avg_job_duration_seconds)
                `, [
                    printer.id,
                    dateStr,
                    stats.total_jobs || 0,
                    stats.successful_jobs || 0,
                    stats.failed_jobs || 0,
                    stats.cancelled_jobs || 0,
                    stats.total_pages || 0,
                    stats.total_copies || 0,
                    Math.round(stats.avg_duration || 0)
                ]);
                
            } catch (printerError) {
                logger.error(`Failed to aggregate stats for printer ${printer.id}:`, printerError);
            }
        }
        
        logger.info(`Daily stats aggregation completed for ${printers.length} printers`);
        
    } catch (error) {
        logger.error('Stats aggregation error:', error);
    }
}

/**
 * Clean up old logs based on retention settings
 */
async function cleanupOldLogs() {
    logger.info('Cleaning up old logs...');
    
    try {
        // Get retention settings
        const logRetention = await db.queryOne(
            "SELECT setting_value FROM settings WHERE setting_key = 'log_retention_days'"
        );
        const statsRetention = await db.queryOne(
            "SELECT setting_value FROM settings WHERE setting_key = 'stats_retention_days'"
        );
        
        const logDays = parseInt(logRetention?.setting_value) || 90;
        const statsDays = parseInt(statsRetention?.setting_value) || 365;
        
        // Delete old system logs
        const logsDeleted = await db.update(
            `DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [logDays]
        );
        
        // Delete old notifications
        const notifsDeleted = await db.update(
            `DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) AND is_read = 1`,
            [logDays]
        );
        
        // Delete old daily stats
        const statsDeleted = await db.update(
            `DELETE FROM printer_stats_daily WHERE date < DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
            [statsDays]
        );
        
        logger.info(`Cleanup completed: ${logsDeleted} logs, ${notifsDeleted} notifications, ${statsDeleted} stats deleted`);
        
    } catch (error) {
        logger.error('Cleanup error:', error);
    }
}

/**
 * Start the stats aggregator cron jobs
 */
function startStatsAggregator() {
    // Run daily stats aggregation at midnight
    cron.schedule('0 0 * * *', aggregateDailyStats);
    
    // Run cleanup weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', cleanupOldLogs);
    
    logger.info('Stats aggregator started');
}

module.exports = {
    startStatsAggregator,
    aggregateDailyStats,
    cleanupOldLogs
};
