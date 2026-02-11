-- Add printer_type column to printers table
ALTER TABLE printers 
ADD COLUMN IF NOT EXISTS printer_type ENUM('network', 'thermal', 'unknown') DEFAULT 'network' AFTER protocol;

ALTER TABLE printers 
ADD COLUMN IF NOT EXISTS snmp_enabled BOOLEAN DEFAULT TRUE AFTER toner_level;

ALTER TABLE printers 
ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NULL AFTER snmp_enabled;

ALTER TABLE printers 
ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 0 AFTER error_message;

ALTER TABLE printers 
ADD COLUMN IF NOT EXISTS last_status_check DATETIME NULL AFTER page_count;
