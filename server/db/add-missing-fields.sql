-- Migration script to add missing prompt fields
-- Based on Notion HTML structure analysis

-- Add missing columns to prompts table
ALTER TABLE prompts
ADD
    additional_tips NVARCHAR(MAX) NULL,
    example_output NVARCHAR(MAX) NULL,
    what_it_does NVARCHAR(MAX) NULL;

-- Verify columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'prompts'
AND COLUMN_NAME IN ('additional_tips', 'example_output', 'what_it_does');
