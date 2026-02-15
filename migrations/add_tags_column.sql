-- Add tags column to printers table
ALTER TABLE printers ADD COLUMN tags VARCHAR(500) NULL AFTER description;

-- Add index for faster tag searches
CREATE INDEX idx_tags ON printers(tags);
