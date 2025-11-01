-- Create prompt_categories table (similar to departments table structure)
CREATE TABLE prompt_categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 999,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Create works_in table (similar to departments table structure)
CREATE TABLE works_in (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 999,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- Add prompt_category column to prompts table (NULL-able, optional field)
ALTER TABLE prompts
ADD prompt_category_id INT NULL,
    FOREIGN KEY (prompt_category_id) REFERENCES prompt_categories(id) ON DELETE SET NULL;

-- Add works_in_json column to prompts table (stores JSON array of works_in IDs, NULL-able)
ALTER TABLE prompts
ADD works_in_json NVARCHAR(MAX) NULL;

-- Insert default prompt categories
INSERT INTO prompt_categories (name, display_order) VALUES
('Understand', 1),
('Create', 2),
('Catch up', 3),
('Ask', 4),
('Edit', 5),
('Learn', 6),
('Design', 7),
('Code', 8),
('Analyze', 9),
('Manage', 10);

-- Insert default works_in platforms
INSERT INTO works_in (name, display_order) VALUES
('Business Chat (work)', 1),
('Copilot chat (web)', 2),
('ChatGPT', 3),
('GitHub Copilot', 4),
('Teams', 5),
('Outlook', 6),
('Word', 7),
('Excel', 8),
('PowerPoint', 9),
('OneNote', 10),
('Loop', 11),
('Whiteboard', 12),
('SharePoint', 13),
('OneDrive', 14),
('Planner', 15),
('Stream', 16),
('Forms', 17),
('Viva Engage', 18);

-- Show the new tables
SELECT * FROM prompt_categories ORDER BY display_order;
SELECT * FROM works_in ORDER BY display_order;

-- Show updated prompts schema
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'prompts'
ORDER BY ORDINAL_POSITION;
