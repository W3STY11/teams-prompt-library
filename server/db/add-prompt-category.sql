-- Add prompt_category column to prompts table (optional field)
-- Choices: Understand, Create, Catch up, Ask, Edit, Learn, Design, Code, Analyze, Manage
ALTER TABLE prompts
ADD prompt_category NVARCHAR(50) NULL;

-- Add works_in column to prompts table (optional field, allows multiple selections)
-- Store as JSON array of choices: Business Chat (work), Copilot chat (web), ChatGPT, GitHub Copilot,
-- Teams, Outlook, Word, Excel, PowerPoint, OneNote, Loop, Whiteboard, SharePoint, OneDrive,
-- Planner, Stream, Forms, Viva Engage
ALTER TABLE prompts
ADD works_in NVARCHAR(MAX) NULL;

-- Show updated schema
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'prompts'
ORDER BY ORDINAL_POSITION;
