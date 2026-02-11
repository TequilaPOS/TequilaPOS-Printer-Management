const db = require('./src/config/database');

async function migrate() {
    try {
        // Check if columns exist first
        const [cols] = await db.pool.execute('SHOW COLUMNS FROM printers');
        const colNames = cols.map(c => c.Field);
        
        if (!colNames.includes('printer_type')) {
            await db.pool.execute("ALTER TABLE printers ADD COLUMN printer_type ENUM('network', 'thermal', 'unknown') DEFAULT 'network' AFTER protocol");
            console.log('✅ Added printer_type column');
        } else {
            console.log('printer_type already exists');
        }
        
        if (!colNames.includes('snmp_enabled')) {
            await db.pool.execute('ALTER TABLE printers ADD COLUMN snmp_enabled BOOLEAN DEFAULT TRUE AFTER toner_level');
            console.log('✅ Added snmp_enabled column');
        } else {
            console.log('snmp_enabled already exists');
        }
        
        if (!colNames.includes('error_message')) {
            await db.pool.execute('ALTER TABLE printers ADD COLUMN error_message VARCHAR(500) NULL AFTER snmp_enabled');
            console.log('✅ Added error_message column');
        } else {
            console.log('error_message already exists');
        }
        
        if (!colNames.includes('page_count')) {
            await db.pool.execute('ALTER TABLE printers ADD COLUMN page_count INT DEFAULT 0 AFTER error_message');
            console.log('✅ Added page_count column');
        } else {
            console.log('page_count already exists');
        }
        
        if (!colNames.includes('last_status_check')) {
            await db.pool.execute('ALTER TABLE printers ADD COLUMN last_status_check DATETIME NULL AFTER page_count');
            console.log('✅ Added last_status_check column');
        } else {
            console.log('last_status_check already exists');
        }
        
        console.log('✅ Migration complete');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

migrate();
