// ===========================================
// Print Routes - Upload & Print Files
// ===========================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const cupsService = require('../services/cupsServiceV2');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = '/tmp/print_uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
        'application/pdf',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/postscript',
        'application/vnd.ms-word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.ps', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

router.use(authenticateToken);

/**
 * POST /api/print/file
 * Upload and print a file
 */
router.post('/file', requireRole(['admin', 'operator']), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { printer_id, copies = 1, duplex = false, color = true, paper_size = 'letter' } = req.body;
        
        if (!printer_id) {
            // Clean up file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Printer ID is required' });
        }
        
        // Get printer info
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [printer_id]);
        if (!printer) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        if (!printer.cups_name) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Printer not configured in CUPS' });
        }
        
        // Print the file
        const printResult = await cupsService.printFile(printer.cups_name, req.file.path, {
            copies: parseInt(copies),
            duplex: duplex === 'true' || duplex === true,
            color: color === 'true' || color === true,
            paperSize: paper_size
        });
        
        if (!printResult.success) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: printResult.error || 'Failed to print' });
        }
        
        // Save to database
        const jobId = await db.insert(`
            INSERT INTO print_jobs (printer_id, user_id, document_name, pages, copies, status, cups_job_id)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `, [printer_id, req.user.id, req.file.originalname, 1, parseInt(copies), printResult.jobId?.split('-').pop()]);
        
        // Log action
        await logAction(req, 'print', 'file_upload', {
            printer_id,
            file: req.file.originalname,
            size: req.file.size,
            job_id: jobId
        });
        
        // Schedule file cleanup after 5 minutes
        setTimeout(() => {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        }, 5 * 60 * 1000);
        
        res.json({
            success: true,
            message: 'Print job submitted successfully',
            job: {
                id: jobId,
                cupsJobId: printResult.jobId,
                documentName: req.file.originalname,
                printer: printer.name
            }
        });
        
    } catch (error) {
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        logger.error('Print file error:', error);
        next(error);
    }
});

/**
 * POST /api/print/text
 * Print plain text
 */
router.post('/text', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { printer_id, text, title = 'Text Document', copies = 1 } = req.body;
        
        if (!printer_id || !text) {
            return res.status(400).json({ error: 'Printer ID and text are required' });
        }
        
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [printer_id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured' });
        }
        
        const printResult = await cupsService.printText(printer.cups_name, text, title);
        
        if (!printResult.success) {
            return res.status(500).json({ error: printResult.error || 'Failed to print' });
        }
        
        // Save to database
        const jobId = await db.insert(`
            INSERT INTO print_jobs (printer_id, user_id, document_name, pages, copies, status, cups_job_id)
            VALUES (?, ?, ?, 1, ?, 'pending', ?)
        `, [printer_id, req.user.id, title, parseInt(copies), printResult.jobId?.split('-').pop()]);
        
        res.json({
            success: true,
            message: 'Print job submitted',
            job: {
                id: jobId,
                cupsJobId: printResult.jobId
            }
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/print/test
 * Print a test page
 */
router.post('/test', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { printer_id } = req.body;
        
        if (!printer_id) {
            return res.status(400).json({ error: 'Printer ID is required' });
        }
        
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [printer_id]);
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found or not configured' });
        }
        
        const printResult = await cupsService.printTestPage(printer.cups_name);
        
        // Log action
        await logAction(req, 'print', 'test_page', { printer_id, printer_name: printer.name });
        
        res.json({
            success: printResult.success,
            message: printResult.success ? 'Test page sent to printer' : 'Failed to send test page',
            cupsJobId: printResult.jobId
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/print/queue
 * Get current print queue from CUPS combined with DB info
 */
router.get('/queue', async (req, res, next) => {
    try {
        const { printer } = req.query;
        
        const pendingJobs = await cupsService.getJobs(printer, 'not-completed');
        const completedJobs = await cupsService.getJobs(printer, 'completed');
        
        // Enrich with document names from our database
        const enrichJobs = async (jobs) => {
            const enriched = [];
            for (const job of jobs) {
                const dbJob = await db.queryOne(
                    'SELECT document_name FROM print_jobs WHERE cups_job_id = ?',
                    [job.jobId]
                );
                enriched.push({
                    ...job,
                    name: dbJob?.document_name || job.name || `Document #${job.jobId}`
                });
            }
            return enriched;
        };
        
        res.json({
            pending: await enrichJobs(pendingJobs),
            completed: (await enrichJobs(completedJobs.slice(0, 20)))
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/print/queue/:jobId
 * Cancel a job in CUPS queue
 */
router.delete('/queue/:jobId', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { jobId } = req.params;
        
        const result = await cupsService.cancelJob(jobId);
        
        if (result.success) {
            await logAction(req, 'cancel', 'print_job', { cups_job_id: jobId });
        }
        
        res.json(result);
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/print/options
 * Get available print options for a printer
 */
router.get('/options/:printerId', async (req, res, next) => {
    try {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.printerId]);
        
        if (!printer || !printer.cups_name) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Get printer options from CUPS
        const { execCommand } = require('../utils/shellExec');
        const result = await execCommand(`lpoptions -p "${printer.cups_name}" -l 2>/dev/null`);
        
        const options = [];
        if (result.success && result.stdout) {
            const lines = result.stdout.split('\n');
            for (const line of lines) {
                const match = line.match(/^(\S+)\/([^:]+):\s*(.+)$/);
                if (match) {
                    const [_, name, label, valuesStr] = match;
                    const values = valuesStr.split(/\s+/).map(v => {
                        const isDefault = v.startsWith('*');
                        return {
                            value: v.replace('*', ''),
                            isDefault
                        };
                    });
                    options.push({ name, label, values });
                }
            }
        }
        
        // Standard options that are always available
        const standardOptions = [
            {
                name: 'copies',
                label: 'Copies',
                type: 'number',
                min: 1,
                max: 100,
                default: 1
            },
            {
                name: 'orientation',
                label: 'Orientation',
                values: [
                    { value: 'portrait', isDefault: true },
                    { value: 'landscape', isDefault: false }
                ]
            },
            {
                name: 'sides',
                label: 'Two-Sided',
                values: [
                    { value: 'one-sided', isDefault: true },
                    { value: 'two-sided-long-edge', isDefault: false },
                    { value: 'two-sided-short-edge', isDefault: false }
                ]
            }
        ];
        
        res.json({
            printer: printer.name,
            cupsOptions: options,
            standardOptions
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
