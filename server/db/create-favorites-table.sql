-- Create favorites table for storing user favorites in SQL database
-- Replaces localStorage implementation

CREATE TABLE favorites (
  user_id NVARCHAR(255) NOT NULL,
  prompt_id NVARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  PRIMARY KEY (user_id, prompt_id)
);

-- Add index for fast user lookups
CREATE INDEX idx_favorites_user ON favorites(user_id);

-- Add index for fast prompt lookups
CREATE INDEX idx_favorites_prompt ON favorites(prompt_id);

-- Add foreign key constraint to prompts table (optional, will not block if prompt is deleted)
-- ALTER TABLE favorites
-- ADD CONSTRAINT fk_favorites_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
