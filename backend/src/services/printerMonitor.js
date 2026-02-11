/**
 * Printer Monitor Service
 * Periodically polls printers for status updates via SNMP and CUPS
 * Emits real-time events via Socket.IO
 * Respects maintenance schedule for off-hours monitoring
 */

const { snmpMonitor } = require('./snmpMonitor');
const cupsService = require('./cupsServiceV2');
const db = require('../config/database');
const logger = require('../utils/logger');

class PrinterMonitorService {
    constructor() {
        
        this.io = null;
        this.pollInterval = null;
        this.jobSyncInterval = null;
        this.pollIntervalMs = 60000;
        this.jobSyncIntervalMs = 15000;
        this.isRunning = false;
        this.printerCache = new Map();
        this.maintenanceModeActive = false; // Track if we're in maintenance window
    }

    initialize(io) {
        this.io = io;
        logger.info('Printer Monitor Service initialized');
    }

    start(intervalMs = 60000) {
        if (this.isRunning) {
            logger.warn('Monitor already running');
            return;
        }

        this.pollIntervalMs = intervalMs;
        this.isRunning = true;
        
        this.pollAllPrinters();
        this.syncCupsJobs();
        
        this.pollInterval = setInterval(() => {
            this.pollAllPrinters();
        }, this.pollIntervalMs);
        
        this.jobSyncInterval = setInterval(() => {
            this.syncCupsJobs();
        }, this.jobSyncIntervalMs);
        
        logger.info(`Printer monitoring started (interval: ${intervalMs}ms)`);
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.jobSyncInterval) {
            clearInterval(this.jobSyncInterval);
            this.jobSyncInterval = null;
        }
        this.isRunning = false;
        logger.info('Printer monitoring stopped');
    }

    /**
     * Check if monitoring is active based on maintenance schedule
     */
    async isMonitoringActive() {
        try {
            const [rows] = await db.pool.execute(
                'SELECT * FROM maintenance_schedule WHERE is_active = TRUE LIMIT 1'
            );
            
            // If no active schedule, always monitor
            if (rows.length === 0) {
                this.maintenanceModeActive = false;
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
                this.maintenanceModeActive = true;
                return false;
            }

            // Check if current time is within active hours
            const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format
            const startTime = schedule.start_time;
            const endTime = schedule.end_time;

            let isActive;
            // Handle overnight schedules (e.g., 22:00 - 06:00)
            if (startTime > endTime) {
                isActive = currentTime >= startTime || currentTime <= endTime;
            } else {
                isActive = currentTime >= startTime && currentTime <= endTime;
            }

            this.maintenanceModeActive = !isActive;
            return isActive;
        } catch (error) {
            // Table might not exist yet, default to active
            logger.debug('Maintenance schedule check failed (table may not exist):', error.message);
            this.maintenanceModeActive = false;
            return true;
        }
    }

    async pollAllPrinters() {
        try {
            // Check if monitoring is active based on schedule
            const shouldMonitor = await this.isMonitoringActive();
            
            if (!shouldMonitor) {
                logger.debug('Monitoring paused - outside active hours (maintenance window)');
                
                // Emit maintenance mode status to frontend
                if (this.io) {
                    this.io.emit('maintenance-mode', { 
                        active: true, 
                        message: 'Monitoring paused - outside active hours'
                    });
                }
                return;
            }

            // Emit that we're actively monitoring
            if (this.io && this.maintenanceModeActive === false) {
                this.io.emit('maintenance-mode', { 
                    active: false, 
                    message: 'Monitoring active'
                });
            }

            const printers = await db.query('SELECT * FROM printers WHERE status != "deleted"');
            logger.debug(`Polling ${printers.length} printers...`);
            
            for (const printer of printers) {
                await this.pollPrinter(printer);
            }
        } catch (error) {
            logger.error('Error polling printers:', error);
        }
    }

    async pollPrinter(printer) {
        try {
            const snmpStatus = await snmpMonitor.getPrinterStatus(printer.ip_address);
            
            // If SNMP not available, check if printer responds to ping
            let pingOnline = false;
            if (!snmpStatus?.online) {
                pingOnline = await this.checkPing(printer.ip_address);
            }
            
            let cupsStatus = null;
            if (printer.cups_name) {
                cupsStatus = await cupsService.getPrinterStatus(printer.cups_name);
            }
            
            const status = this.mergeStatus(printer, snmpStatus, cupsStatus, pingOnline);
            
            const cached = this.printerCache.get(printer.id);
            if (!cached || this.hasStatusChanged(cached, status)) {
                await this.updatePrinterStatus(printer.id, status);
                this.printerCache.set(printer.id, status);
                
                if (this.io) {
                    this.io.emit('printer:status', {
                        printerId: printer.id,
                        printerName: printer.name,
                        ...status
                    });
                }
            }
            
            if (snmpStatus.supplies && snmpStatus.supplies.length > 0) {
                await this.updateSupplyLevels(printer.id, snmpStatus.supplies);
            }
        } catch (error) {
            logger.error(`Error polling printer ${printer.name}:`, error);
            await this.updatePrinterStatus(printer.id, { 
                status: 'offline',
                lastError: error.message
            });
        }
    }

    /**
     * Check if printer responds to ping
     */
    async checkPing(ip) {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            
            // Increased timeout: -W 5 (5 seconds) and command timeout 8000ms
            const { stdout } = await execAsync(`ping -c 2 -W 5 ${ip} 2>/dev/null`, { timeout: 8000 });
            return stdout.includes('1 received') || stdout.includes('2 received') || stdout.includes('packets received') || stdout.includes('time=');
        } catch (error) {
            return false;
        }
    }

    mergeStatus(printer, snmpStatus, cupsStatus, pingOnline = false) {
        const snmpAvailable = snmpStatus?.online && !snmpStatus.errors?.includes('SNMP not available');
        const isOnline = snmpStatus?.online || pingOnline;
        
        const status = {
            online: isOnline,
            status: 'unknown',
            printerState: snmpStatus?.printerState || null,
            pageCount: snmpStatus?.pageCount || null,
            errors: snmpStatus?.errors || [],
            snmpAvailable: snmpAvailable,
            lastChecked: new Date().toISOString()
        };
        
        if (!isOnline) {
            status.status = 'offline';
        } else if (!snmpAvailable && pingOnline) {
            // Printer responds to ping but SNMP not available
            status.status = 'online';
            status.snmpNote = 'SNMP not enabled - status via ping';
        } else if (snmpStatus?.errors && snmpStatus.errors.length > 0 && !snmpStatus.errors.includes('SNMP not available')) {
            status.status = 'error';
        } else if (snmpStatus?.printerState === 'printing') {
            status.status = 'printing';
        } else if (cupsStatus?.state === 'stopped') {
            status.status = 'paused';
        } else if (isOnline) {
            status.status = 'online';
        }
        
        if (cupsStatus) {
            status.cupsState = cupsStatus.state;
            status.cupsStateReasons = cupsStatus.stateReasons;
        }
        
        return status;
    }

    hasStatusChanged(cached, current) {
        return (
            cached.status !== current.status ||
            cached.pageCount !== current.pageCount ||
            JSON.stringify(cached.errors) !== JSON.stringify(current.errors)
        );
    }

    async updatePrinterStatus(printerId, status) {
        try {
            // Convert errors array to human-readable message
            const errorMessage = status.errors && status.errors.length > 0 
                ? status.errors.join(', ') 
                : null;
            
            await db.update(`
                UPDATE printers SET
                    status = ?,
                    error_message = ?,
                    page_count = COALESCE(?, page_count),
                    snmp_enabled = ?,
                    last_status_check = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            `, [status.status, errorMessage, status.pageCount, status.snmpAvailable ? 1 : 0, printerId]);
        } catch (error) {
            logger.error('Error updating printer status:', error);
        }
    }

    async updateSupplyLevels(printerId, supplies) {
        try {
            // Find main toner supply (first one that's not waste toner)
            const tonerSupply = supplies.find(s => 
                s.type === 'toner' && 
                s.percent >= 0 && 
                !s.name?.toLowerCase().includes('waste')
            );
            
            // Update toner_level in main printers table
            if (tonerSupply) {
                await db.update(`
                    UPDATE printers SET toner_level = ? WHERE id = ?
                `, [tonerSupply.percent, printerId]);
            }
            
            for (const supply of supplies) {
                // Skip invalid supplies (negative values are SNMP special codes)
                if (supply.percent < 0 || supply.maxCapacity < 0) {
                    continue;
                }
                
                await db.update(`
                    INSERT INTO printer_supplies 
                    (printer_id, name, supply_type, level_percent, max_capacity, color, color_hex, status, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        level_percent = VALUES(level_percent),
                        status = VALUES(status),
                        updated_at = NOW()
                `, [
                    printerId, supply.name, supply.type, supply.percent,
                    supply.maxCapacity || 0, supply.color, supply.colorHex, supply.status
                ]);
                
                if (supply.status === 'low' || supply.status === 'empty') {
                    await this.emitSupplyAlert(printerId, supply);
                }
            }
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                await this.createSuppliesTable();
            } else {
                logger.error('Error updating supply levels:', error);
            }
        }
    }

    async emitSupplyAlert(printerId, supply) {
        const printer = await db.queryOne('SELECT name FROM printers WHERE id = ?', [printerId]);
        
        const alert = {
            type: supply.status === 'empty' ? 'critical' : 'warning',
            printerId,
            printerName: printer?.name,
            supply: supply.name,
            level: supply.percent,
            message: supply.status === 'empty' 
                ? `${supply.name} is empty on ${printer?.name}!`
                : `${supply.name} is low (${supply.percent}%) on ${printer?.name}`
        };
        
        if (this.io) {
            this.io.emit('supply:alert', alert);
        }
    }

    async syncCupsJobs() {
        try {
            logger.info('Syncing CUPS jobs...');
            const printers = await db.query('SELECT id, cups_name FROM printers WHERE cups_name IS NOT NULL');
            
            for (const printer of printers) {
                // Get both pending and completed jobs
                const pendingJobs = await cupsService.getJobs(printer.cups_name, 'not-completed');
                const completedJobs = await cupsService.getJobs(printer.cups_name, 'completed');
                
                logger.debug(`Printer ${printer.cups_name}: ${pendingJobs.length} pending, ${completedJobs.length} completed`);
                
                // Mark pending jobs
                for (const job of pendingJobs) {
                    await this.syncJob(printer.id, { ...job, state: 'pending' });
                }
                
                // Mark completed jobs
                for (const job of completedJobs) {
                    await this.syncJob(printer.id, { ...job, state: 'completed' });
                }
            }
            logger.info('CUPS job sync completed');
        } catch (error) {
            logger.error('Error syncing CUPS jobs:', error);
        }
    }

    async syncJob(printerId, cupsJob) {
        try {
            // Use jobId (the number part, e.g., 5 from hp_m426fdw-5)
            const jobNumber = cupsJob.jobId || cupsJob.id;
            
            const existing = await db.queryOne(
                'SELECT id, status FROM print_jobs WHERE cups_job_id = ? AND printer_id = ?',
                [jobNumber, printerId]
            );
            
            const statusMap = {
                'pending': 'pending',
                'held': 'pending',
                'processing': 'printing',
                'completed': 'completed',
                'canceled': 'cancelled',
                'aborted': 'error'
            };
            const status = statusMap[cupsJob.state] || cupsJob.state || 'pending';
            
            if (existing) {
                if (existing.status !== status) {
                    logger.info(`Updating job ${existing.id} from ${existing.status} to ${status}`);
                    await db.update(`
                        UPDATE print_jobs SET status = ?, completed_at = IF(? = 'completed', NOW(), completed_at)
                        WHERE id = ?
                    `, [status, status, existing.id]);
                    
                    if (this.io) {
                        this.io.emit('job:updated', { jobId: existing.id, status });
                    }
                }
            } else {
                // Don't insert new jobs from CUPS sync to avoid duplicates
                // Jobs should be created when user submits them via API
                logger.debug(`Job ${jobNumber} not found in DB for printer ${printerId}, skipping`);
            }
        } catch (error) {
            logger.error(`Error syncing job ${cupsJob.jobId || cupsJob.id}:`, error);
        }
    }

    async createSuppliesTable() {
        try {
            await db.update(`
                CREATE TABLE IF NOT EXISTS printer_supplies (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    printer_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    supply_type VARCHAR(50),
                    level_percent INT DEFAULT -1,
                    max_capacity INT DEFAULT -1,
                    color VARCHAR(50) DEFAULT 'none',
                    color_hex VARCHAR(7) DEFAULT '#808080',
                    status ENUM('ok', 'almost-low', 'low', 'empty', 'unknown') DEFAULT 'unknown',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_printer_supply (printer_id, name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            logger.info('Created printer_supplies table');
        } catch (error) {
            logger.error('Error creating supplies table:', error);
        }
    }

    async forcePoll(printerId) {
        const printer = await db.queryOne('SELECT * FROM printers WHERE id = ?', [printerId]);
        if (printer) {
            await this.pollPrinter(printer);
            return this.printerCache.get(printerId);
        }
        return null;
    }
}

const printerMonitor = new PrinterMonitorService();

module.exports = { PrinterMonitorService, printerMonitor };
