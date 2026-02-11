const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply auth to all routes
router.use(authenticateToken);

/**
 * Get current maintenance schedule
 */
router.get('/schedule', async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM maintenance_schedule ORDER BY id LIMIT 1'
        );
        
        if (rows.length === 0) {
            // Return default schedule if none exists
            return res.json({
                id: null,
                name: 'Default Schedule',
                is_active: false,
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false,
                start_time: '06:00:00',
                end_time: '20:00:00',
                timezone: 'America/Bogota'
            });
        }
        
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error fetching maintenance schedule:', error);
        next(error);
    }
});

/**
 * Update maintenance schedule
 */
router.put('/schedule', requireRole(['admin']), async (req, res, next) => {
    try {
        const {
            name,
            description,
            is_active,
            monday,
            tuesday,
            wednesday,
            thursday,
            friday,
            saturday,
            sunday,
            start_time,
            end_time,
            timezone
        } = req.body;

        // Check if schedule exists
        const [existing] = await pool.execute('SELECT id FROM maintenance_schedule LIMIT 1');
        
        if (existing.length === 0) {
            // Insert new schedule
            await pool.execute(
                `INSERT INTO maintenance_schedule 
                (name, description, is_active, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, timezone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, description, is_active, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, timezone || 'America/Bogota']
            );
        } else {
            // Update existing schedule
            await pool.execute(
                `UPDATE maintenance_schedule SET
                    name = ?,
                    description = ?,
                    is_active = ?,
                    monday = ?,
                    tuesday = ?,
                    wednesday = ?,
                    thursday = ?,
                    friday = ?,
                    saturday = ?,
                    sunday = ?,
                    start_time = ?,
                    end_time = ?,
                    timezone = ?
                WHERE id = ?`,
                [name, description, is_active, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, timezone || 'America/Bogota', existing[0].id]
            );
        }

        // Fetch and return updated schedule
        const [rows] = await pool.execute('SELECT * FROM maintenance_schedule ORDER BY id LIMIT 1');
        
        logger.info(`Maintenance schedule updated by user ${req.user.id}`);
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error updating maintenance schedule:', error);
        next(error);
    }
});

/**
 * Check if monitoring is currently active based on schedule
 */
router.get('/is-active', async (req, res, next) => {
    try {
        const isActive = await isMonitoringActive();
        res.json({ isActive, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Error checking monitoring status:', error);
        next(error);
    }
});

/**
 * Toggle schedule on/off quickly
 */
router.post('/toggle', requireRole(['admin']), async (req, res, next) => {
    try {
        const { is_active } = req.body;
        
        await pool.execute(
            'UPDATE maintenance_schedule SET is_active = ? WHERE id = (SELECT id FROM (SELECT id FROM maintenance_schedule LIMIT 1) as t)',
            [is_active]
        );

        const [rows] = await pool.execute('SELECT * FROM maintenance_schedule ORDER BY id LIMIT 1');
        
        logger.info(`Maintenance schedule toggled to ${is_active ? 'ON' : 'OFF'} by user ${req.user.id}`);
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error toggling maintenance schedule:', error);
        next(error);
    }
});

/**
 * Helper function to check if monitoring should be active
 * Exported for use by snmpMonitor
 */
async function isMonitoringActive() {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM maintenance_schedule WHERE is_active = TRUE LIMIT 1'
        );
        
        // If no active schedule, always monitor
        if (rows.length === 0) {
            return true;
        }

        const schedule = rows[0];
        const now = new Date();
        
        // Get current day (0=Sunday, 1=Monday, etc.)
        const dayOfWeek = now.getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[dayOfWeek];
        
        // Check if today is an active day
        if (!schedule[todayName]) {
            return false;
        }

        // Check if current time is within active hours
        const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format
        const startTime = schedule.start_time;
        const endTime = schedule.end_time;

        // Handle overnight schedules (e.g., 22:00 - 06:00)
        if (startTime > endTime) {
            // Active if current time is after start OR before end
            return currentTime >= startTime || currentTime <= endTime;
        } else {
            // Normal schedule: active if current time is between start and end
            return currentTime >= startTime && currentTime <= endTime;
        }
    } catch (error) {
        logger.error('Error checking if monitoring is active:', error);
        // Default to active if error
        return true;
    }
}

// Export both router and helper function
module.exports = router;
module.exports.isMonitoringActive = isMonitoringActive;
