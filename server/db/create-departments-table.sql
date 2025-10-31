-- Create departments table for managing department metadata
-- Each department has a name, icon, and display order

CREATE TABLE departments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL UNIQUE,
  icon NVARCHAR(10) NOT NULL DEFAULT '📁',
  display_order INT NOT NULL DEFAULT 999,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);

-- Add index for fast lookups by name
CREATE INDEX idx_departments_name ON departments(name);

-- Add index for ordered listing
CREATE INDEX idx_departments_order ON departments(display_order);

-- Insert default departments with icons
INSERT INTO departments (name, icon, display_order) VALUES
  ('Business', '💼', 1),
  ('Marketing', '📢', 2),
  ('Sales', '💰', 3),
  ('SEO', '🔍', 4),
  ('Finance', '💵', 5),
  ('Education', '📚', 6),
  ('Writing', '✍️', 7),
  ('Productivity', '⚡', 8),
  ('Solopreneurs', '🚀', 9);
