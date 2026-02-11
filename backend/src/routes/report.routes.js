// ===========================================
// Report Routes
// ===========================================

const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/reports/summary
 * Get general summary statistics
 */
router.get('/summary', async (req, res, next) => {
    try {
        // Printer counts
        const printerStats = await db.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(CASE WHEN status = 'printing' THEN 1 ELSE 0 END) as printing
            FROM printers
        `);
        
        // Today's jobs
        const todayJobs = await db.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(COALESCE(pages, 0)) as total_pages
            FROM print_jobs
            WHERE DATE(submitted_at) = CURDATE()
        `);
        
        // This week's jobs
        const weekJobs = await db.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(COALESCE(pages, 0)) as total_pages
            FROM print_jobs
            WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);
        
        // Top printers today
        const topPrinters = await db.query(`
            SELECT p.name, COUNT(pj.id) as job_count, SUM(COALESCE(pj.pages, 0)) as pages
            FROM printers p
            LEFT JOIN print_jobs pj ON p.id = pj.printer_id AND DATE(pj.submitted_at) = CURDATE()
            GROUP BY p.id
            ORDER BY job_count DESC
            LIMIT 5
        `);
        
        res.json({
            printers: printerStats,
            today: todayJobs,
            week: weekJobs,
            topPrinters
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reports/printer/:id
 * Get detailed report for a specific printer
 */
router.get('/printer/:id', async (req, res, next) => {
    try {
        const { period = '7d' } = req.query;
        
        // Calculate date range
        let days = 7;
        if (period === '30d') days = 30;
        if (period === '90d') days = 90;
        
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [req.params.id]);
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }
        
        // Aggregated stats
        const stats = await db.queryOne(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(COALESCE(pages, 0)) as total_pages,
                AVG(TIMESTAMPDIFF(SECOND, submitted_at, completed_at)) as avg_duration_seconds
            FROM print_jobs
            WHERE printer_id = ?
            AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [req.params.id, days]);
        
        // Daily breakdown
        const dailyStats = await db.query(`
            SELECT 
                DATE(submitted_at) as date,
                COUNT(*) as jobs,
                SUM(COALESCE(pages, 0)) as pages,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM print_jobs
            WHERE printer_id = ?
            AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(submitted_at)
            ORDER BY date
        `, [req.params.id, days]);
        
        // Hourly distribution (for peak usage)
        const hourlyDistribution = await db.query(`
            SELECT 
                HOUR(submitted_at) as hour,
                COUNT(*) as jobs
            FROM print_jobs
            WHERE printer_id = ?
            AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY HOUR(submitted_at)
            ORDER BY hour
        `, [req.params.id, days]);
        
        res.json({
            printer,
            period: { days, label: period },
            stats,
            dailyStats,
            hourlyDistribution,
            errorRate: stats.total_jobs > 0 
                ? ((stats.failed / stats.total_jobs) * 100).toFixed(2) 
                : 0
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reports/usage
 * Get usage report by date range
 */
router.get('/usage', async (req, res, next) => {
    try {
        const { 
            date_from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            date_to = new Date().toISOString().split('T')[0],
            group_by = 'day' // day, week, month
        } = req.query;
        
        let dateFormat, groupClause;
        switch (group_by) {
            case 'week':
                dateFormat = '%Y-W%u';
                groupClause = 'YEARWEEK(submitted_at)';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                groupClause = 'DATE_FORMAT(submitted_at, "%Y-%m")';
                break;
            default:
                dateFormat = '%Y-%m-%d';
                groupClause = 'DATE(submitted_at)';
        }
        
        const usage = await db.query(`
            SELECT 
                ${groupClause} as period,
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(COALESCE(pages, 0)) as pages,
                COUNT(DISTINCT printer_id) as printers_used
            FROM print_jobs
            WHERE DATE(submitted_at) BETWEEN ? AND ?
            GROUP BY ${groupClause}
            ORDER BY period
        `, [date_from, date_to]);
        
        // By printer
        const byPrinter = await db.query(`
            SELECT 
                p.name,
                p.id as printer_id,
                COUNT(pj.id) as jobs,
                SUM(COALESCE(pj.pages, 0)) as pages
            FROM printers p
            LEFT JOIN print_jobs pj ON p.id = pj.printer_id 
                AND DATE(pj.submitted_at) BETWEEN ? AND ?
            GROUP BY p.id, p.name
            ORDER BY jobs DESC
        `, [date_from, date_to]);
        
        res.json({
            period: { from: date_from, to: date_to, groupBy: group_by },
            usage,
            byPrinter
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reports/export
 * Export report as CSV
 */
router.get('/export', requireRole(['admin', 'operator']), async (req, res, next) => {
    try {
        const { 
            type = 'jobs', // jobs, printers, usage
            date_from,
            date_to,
            format = 'csv'
        } = req.query;
        
        let data, headers;
        
        switch (type) {
            case 'jobs':
                data = await db.query(`
                    SELECT 
                        pj.id, p.name as printer, pj.document_name, pj.pages, pj.copies,
                        pj.status, pj.submitted_at, pj.completed_at, u.name as user
                    FROM print_jobs pj
                    LEFT JOIN printers p ON pj.printer_id = p.id
                    LEFT JOIN users u ON pj.user_id = u.id
                    WHERE 1=1
                    ${date_from ? 'AND DATE(pj.submitted_at) >= ?' : ''}
                    ${date_to ? 'AND DATE(pj.submitted_at) <= ?' : ''}
                    ORDER BY pj.submitted_at DESC
                `, [date_from, date_to].filter(Boolean));
                headers = ['ID', 'Printer', 'Document', 'Pages', 'Copies', 'Status', 'Submitted', 'Completed', 'User'];
                break;
                
            case 'printers':
                data = await db.query(`
                    SELECT 
                        p.id, p.name, p.ip_address, p.location, p.status,
                        p.manufacturer, p.model, p.last_check,
                        COUNT(pj.id) as total_jobs
                    FROM printers p
                    LEFT JOIN print_jobs pj ON p.id = pj.printer_id
                    GROUP BY p.id
                    ORDER BY p.name
                `);
                headers = ['ID', 'Name', 'IP', 'Location', 'Status', 'Manufacturer', 'Model', 'Last Check', 'Total Jobs'];
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }
        
        if (format === 'csv') {
            // Generate CSV
            const csvRows = [headers.join(',')];
            for (const row of data) {
                const values = Object.values(row).map(v => {
                    if (v === null) return '';
                    if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
                    return v;
                });
                csvRows.push(values.join(','));
            }
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csvRows.join('\n'));
        } else if (format === 'excel' || format === 'xlsx') {
            // Generate Excel
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Print Management System';
            workbook.created = new Date();
            
            const worksheet = workbook.addWorksheet(type === 'jobs' ? 'Print Jobs' : 'Printers');
            
            // Add headers with styling
            worksheet.columns = headers.map((h, i) => ({
                header: h,
                key: Object.keys(data[0] || {})[i] || `col${i}`,
                width: Math.max(h.length + 5, 15)
            }));
            
            // Style header row
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3B82F6' }
            };
            worksheet.getRow(1).alignment = { horizontal: 'center' };
            
            // Add data rows
            data.forEach((row, index) => {
                const rowData = worksheet.addRow(Object.values(row));
                // Alternate row colors
                if (index % 2 === 0) {
                    rowData.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF3F4F6' }
                    };
                }
            });
            
            // Add borders
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });
            
            // Auto-fit columns (approximate)
            worksheet.columns.forEach(column => {
                let maxLength = column.header ? column.header.length : 10;
                column.eachCell({ includeEmpty: true }, cell => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = Math.min(maxLength + 2, 50);
            });
            
            // Send Excel file
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
        } else if (format === 'pdf') {
            // Generate PDF report
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${type}_report_${new Date().toISOString().split('T')[0]}.pdf`);
            
            doc.pipe(res);
            
            // Title
            doc.fontSize(20).font('Helvetica-Bold')
               .text(`${type === 'jobs' ? 'Print Jobs' : 'Printers'} Report`, { align: 'center' });
            doc.moveDown(0.5);
            
            // Date range
            doc.fontSize(10).font('Helvetica')
               .fillColor('#666666')
               .text(`Generated: ${new Date().toLocaleString()}${date_from ? ` | From: ${date_from}` : ''}${date_to ? ` To: ${date_to}` : ''}`, { align: 'center' });
            doc.moveDown(1);
            
            // Table settings
            const tableTop = doc.y;
            const colWidths = type === 'jobs' 
              ? [40, 100, 150, 45, 45, 60, 100, 100, 80]  // Jobs columns
              : [40, 120, 100, 100, 60, 80, 80, 100, 60]; // Printers columns
            
            // Draw header
            doc.fillColor('#3B82F6').rect(50, tableTop, 720, 20).fill();
            let xPos = 55;
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
            headers.forEach((h, i) => {
              doc.text(h, xPos, tableTop + 5, { width: colWidths[i] - 5, align: 'left' });
              xPos += colWidths[i];
            });
            
            // Draw rows
            let yPos = tableTop + 25;
            doc.font('Helvetica').fontSize(8).fillColor('#000000');
            
            const maxRows = 25; // Max rows per page
            let rowCount = 0;
            
            for (const row of data) {
              if (rowCount >= maxRows) {
                doc.addPage();
                yPos = 50;
                rowCount = 0;
                
                // Repeat header
                doc.fillColor('#3B82F6').rect(50, yPos, 720, 20).fill();
                xPos = 55;
                doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
                headers.forEach((h, i) => {
                  doc.text(h, xPos, yPos + 5, { width: colWidths[i] - 5, align: 'left' });
                  xPos += colWidths[i];
                });
                yPos += 25;
                doc.font('Helvetica').fontSize(8).fillColor('#000000');
              }
              
              // Alternate row background
              if (rowCount % 2 === 0) {
                doc.fillColor('#F9FAFB').rect(50, yPos - 3, 720, 18).fill();
              }
              
              xPos = 55;
              doc.fillColor('#000000');
              Object.values(row).forEach((val, i) => {
                const text = val === null ? '-' : String(val).substring(0, 25);
                doc.text(text, xPos, yPos, { width: colWidths[i] - 5, align: 'left' });
                xPos += colWidths[i];
              });
              
              yPos += 18;
              rowCount++;
            }
            
            // Footer
            doc.fontSize(8).fillColor('#999999')
               .text(`Total records: ${data.length}`, 50, doc.page.height - 50);
            
            doc.end();
        } else {
            res.json({ data, headers });
        }
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
