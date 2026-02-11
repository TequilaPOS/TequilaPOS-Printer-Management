// ===========================================
// Print Job Routes
// ===========================================

const express = require('express');
const db = require('../config/database');
const cupsService = require('../services/cupsService');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/jobs
 * List all print jobs with filters
 */
router.get('/', async (req, res, next) => {
    try {
        const { 
            printer_id, 
            status, 
            user_id,
            date_from, 
            date_to, 
            page = 1, 
            limit = 50 
        } = req.query;
        
        let sql = `
            SELECT pj.*, p.name as printer_name, u.name as user_name
            FROM print_jobs pj
            LEFT JOIN printers p ON pj.printer_id = p.id
            LEFT JOIN users u ON pj.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        
        if (printer_id) {
            sql += ' AND pj.printer_id = ?';
            params.push(printer_id);
        }
        
        if (status) {
            sql += ' AND pj.status = ?';
            params.push(status);
        }
        
        if (user_id) {
            sql += ' AND pj.user_id = ?';
            params.push(user_id);
        }
        
        if (date_from) {
            sql += ' AND DATE(pj.submitted_at) >= ?';
            params.push(date_from);
        }
        
        if (date_to) {
            sql += ' AND DATE(pj.submitted_at) <= ?';
            params.push(date_to);
        }
        
        // Count total
        const countResult = await db.queryOne(
            sql.replace('SELECT pj.*, p.name as printer_name, u.name as user_name', 'SELECT COUNT(*) as total'),
            params
        );
        
        // Add pagination
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;
        sql += ` ORDER BY pj.submitted_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
        
        const jobs = await db.query(sql, params);
        
        res.json({
            jobs,
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
 * GET /api/jobs/:id
 * Get job details
 */
router.get('/:id', async (req, res, next) => {
    try {
        const job = await db.queryOne(`
            SELECT pj.*, p.name as printer_name, p.cups_name, u.name as user_name
            FROM print_jobs pj
            LEFT JOIN printers p ON pj.printer_id = p.id
            LEFT JOIN users u ON pj.user_id = u.id
            WHERE pj.id = ?
        `, [req.params.id]);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(job);
        
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/jobs/:id
 * Cancel a print job
 */
router.delete('/:id', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const job = await db.queryOne(`
            SELECT pj.*, p.cups_name 
            FROM print_jobs pj
            JOIN printers p ON pj.printer_id = p.id
            WHERE pj.id = ?
        `, [req.params.id]);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (job.status === 'completed' || job.status === 'cancelled') {
            return res.status(400).json({ error: 'Job already completed or cancelled' });
        }
        
        // Cancel in CUPS if we have the CUPS job ID
        if (job.cups_job_id) {
            const fullJobId = `${job.cups_name}-${job.cups_job_id}`;
            await cupsService.cancelJob(fullJobId);
        }
        
        // Update database
        await db.update(
            'UPDATE print_jobs SET status = ?, completed_at = NOW() WHERE id = ?',
            ['cancelled', req.params.id]
        );
        
        await logAction('job', 'Print job cancelled', { jobId: req.params.id }, req);
        
        res.json({ message: 'Job cancelled successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/jobs/printer/:printerId
 * Get jobs for a specific printer
 */
router.get('/printer/:printerId', async (req, res, next) => {
    try {
        const { status, limit = 50 } = req.query;
        
        let sql = `
            SELECT pj.*, u.name as user_name
            FROM print_jobs pj
            LEFT JOIN users u ON pj.user_id = u.id
            WHERE pj.printer_id = ?
        `;
        const params = [req.params.printerId];
        
        if (status) {
            sql += ' AND pj.status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY pj.submitted_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const jobs = await db.query(sql, params);
        
        res.json({ jobs });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/jobs/stats/today
 * Get today's job statistics
 */
router.get('/stats/today', async (req, res, next) => {
    try {
        const stats = await db.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(CASE WHEN status IN ('pending', 'printing') THEN 1 ELSE 0 END) as in_progress,
                SUM(COALESCE(pages, 0)) as total_pages
            FROM print_jobs
            WHERE DATE(submitted_at) = CURDATE()
        `);
        
        res.json(stats);
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
