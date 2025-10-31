-- Create subcategories table for managing subcategory metadata
-- Each subcategory belongs to a department and has a name and display order

CREATE TABLE subcategories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  department_name NVARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 999,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE(),
  CONSTRAINT unique_subcategory_per_department UNIQUE (name, department_name)
);

-- Add index for fast lookups by department
CREATE INDEX idx_subcategories_department ON subcategories(department_name);

-- Add index for ordered listing
CREATE INDEX idx_subcategories_order ON subcategories(department_name, display_order);

-- Foreign key to departments table (optional - will allow orphaned subcategories if department is deleted)
ALTER TABLE subcategories
ADD CONSTRAINT fk_subcategories_department FOREIGN KEY (department_name) REFERENCES departments(name) ON DELETE CASCADE ON UPDATE CASCADE;
