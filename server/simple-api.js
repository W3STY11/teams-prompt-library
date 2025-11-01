/**
 * SIMPLIFIED API - Direct SQL queries, no stored procedures
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 3001;

// Database config
const dbConfig = {
  user: process.env.SQL_USER || 'promptlib-admin',
  password: process.env.SQL_PASSWORD || '@PromptLib2024!',
  server: process.env.SQL_SERVER || 'promptlib-sql.database.windows.net',
  database: process.env.SQL_DATABASE || 'promptlib-db',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

let pool;

// Initialize database connection
async function initDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to Azure SQL Database');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Get all prompts (NO AUTH REQUIRED FOR NOW)
app.get('/api/prompts', async (req, res) => {
  try {
    const { department, search, limit = 10000 } = req.query;

    let query = `
      SELECT TOP (@limit)
        p.*,
        pc.name as prompt_category
      FROM prompts p
      LEFT JOIN prompt_categories pc ON p.prompt_category_id = pc.id
      WHERE 1=1
    `;
    const request = pool.request();
    request.input('limit', sql.Int, parseInt(limit));

    if (department) {
      query += ' AND p.department = @department';
      request.input('department', sql.NVarChar, department);
    }

    if (search) {
      query += ' AND (p.title LIKE @search OR p.description LIKE @search OR p.content LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await request.query(query);

    // Parse JSON fields for all prompts
    const prompts = result.recordset.map(prompt => {
      if (prompt.tags && typeof prompt.tags === 'string') {
        prompt.tags = JSON.parse(prompt.tags);
      }
      if (prompt.tips && typeof prompt.tips === 'string') {
        prompt.tips = JSON.parse(prompt.tips);
      }
      if (prompt.images && typeof prompt.images === 'string') {
        prompt.images = JSON.parse(prompt.images);
      }
      if (prompt.additional_tips && typeof prompt.additional_tips === 'string') {
        try {
          prompt.additional_tips = JSON.parse(prompt.additional_tips);
        } catch (e) {
          prompt.additional_tips = [];
        }
      }

      // Parse metadata JSON and extract fields to top level
      if (prompt.metadata && typeof prompt.metadata === 'string') {
        try {
          const metadata = JSON.parse(prompt.metadata);
          prompt.metadata = metadata;
          // Extract metadata fields to top level for easier access
          prompt.what_it_does = metadata.whatItDoes || metadata.what_it_does || null;
          prompt.how_to_use = metadata.howToUse || metadata.how_to_use || null;
          prompt.example_input = metadata.exampleInput || metadata.example_input || null;
        } catch (e) {
          prompt.metadata = null;
        }
      }

      return prompt;
    });

    // Get departments from departments table (includes departments with 0 prompts)
    const deptResult = await pool.request().query(`
      SELECT
        d.name,
        d.icon,
        d.display_order,
        COUNT(p.id) as prompt_count
      FROM departments d
      LEFT JOIN prompts p ON d.name = p.department
      GROUP BY d.name, d.icon, d.display_order
      ORDER BY d.display_order, d.name
    `);

    const departments = deptResult.recordset.map(d => ({
      name: d.name,
      icon: d.icon || '📁',
      prompt_count: d.prompt_count
    }));

    res.json({
      prompts,
      count: prompts.length,
      departments
    });
    
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts', details: error.message });
  }
});

// Get single prompt by ID
app.get('/api/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.request()
      .input('id', sql.NVarChar, id)
      .query(`
        SELECT
          p.*,
          pc.name as prompt_category
        FROM prompts p
        LEFT JOIN prompt_categories pc ON p.prompt_category_id = pc.id
        WHERE p.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Parse JSON fields
    const prompt = result.recordset[0];
    if (prompt.tags && typeof prompt.tags === 'string') {
      prompt.tags = JSON.parse(prompt.tags);
    }
    if (prompt.tips && typeof prompt.tips === 'string') {
      prompt.tips = JSON.parse(prompt.tips);
    }
    if (prompt.images && typeof prompt.images === 'string') {
      prompt.images = JSON.parse(prompt.images);
    }
    if (prompt.additional_tips && typeof prompt.additional_tips === 'string') {
      try {
        prompt.additional_tips = JSON.parse(prompt.additional_tips);
      } catch (e) {
        prompt.additional_tips = [];
      }
    }

    // Parse metadata JSON and extract fields to top level
    if (prompt.metadata && typeof prompt.metadata === 'string') {
      try {
        const metadata = JSON.parse(prompt.metadata);
        prompt.metadata = metadata;
        // Extract metadata fields to top level for easier access
        prompt.what_it_does = metadata.whatItDoes || metadata.what_it_does || null;
        prompt.how_to_use = metadata.howToUse || metadata.how_to_use || null;
        prompt.example_input = metadata.exampleInput || metadata.example_input || null;
      } catch (e) {
        prompt.metadata = null;
      }
    }

    res.json({ prompt });

  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt', details: error.message });
  }
});

// Get departments (derive from prompts table)
app.get('/api/departments', async (req, res) => {
  try {
    // Query departments table with LEFT JOIN to count prompts (includes departments with 0 prompts)
    const result = await pool.request().query(`
      SELECT
        d.name,
        d.icon,
        d.display_order,
        COUNT(p.id) as prompt_count
      FROM departments d
      LEFT JOIN prompts p ON d.name = p.department
      GROUP BY d.name, d.icon, d.display_order
      ORDER BY d.display_order, d.name
    `);

    const departments = result.recordset.map(d => ({
      name: d.name,
      icon: d.icon || '📁',
      prompt_count: d.prompt_count
    }));

    res.json(departments);

  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

// =============================================================================
// FAVORITES ENDPOINTS (SQL-BASED)
// =============================================================================

// Get user's favorites from SQL database
app.get('/api/favorites', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';

    const result = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query('SELECT prompt_id FROM favorites WHERE user_id = @user_id');

    const favorites = result.recordset.map(row => row.prompt_id);
    res.json({ favorites });

  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites', details: error.message });
  }
});

// Add prompt to favorites
app.post('/api/favorites/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;

    // Insert if not exists (MERGE ensures no duplicates)
    await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .input('prompt_id', sql.NVarChar, id)
      .query(`
        MERGE INTO favorites AS target
        USING (VALUES (@user_id, @prompt_id)) AS source (user_id, prompt_id)
        ON target.user_id = source.user_id AND target.prompt_id = source.prompt_id
        WHEN NOT MATCHED THEN
          INSERT (user_id, prompt_id) VALUES (source.user_id, source.prompt_id);
      `);

    res.json({ success: true });

  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite', details: error.message });
  }
});

// Remove prompt from favorites
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;

    await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .input('prompt_id', sql.NVarChar, id)
      .query('DELETE FROM favorites WHERE user_id = @user_id AND prompt_id = @prompt_id');

    res.json({ success: true });

  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite', details: error.message });
  }
});

// =============================================================================
// DEPARTMENT & SUBCATEGORY ADMIN ENDPOINTS (NO AUTH FOR NOW)
// =============================================================================

// Get all departments with metadata from departments table
app.get('/api/admin/departments', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT id, name, icon, display_order, created_at, updated_at
      FROM departments
      ORDER BY display_order, name
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

// Create new department
app.post('/api/admin/departments', async (req, res) => {
  try {
    const { name, icon, display_order } = req.body;

    if (!name || !icon) {
      return res.status(400).json({ error: 'Name and icon are required' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('icon', sql.NVarChar, icon)
      .input('display_order', sql.Int, display_order || 999)
      .query(`
        INSERT INTO departments (name, icon, display_order)
        VALUES (@name, @icon, @display_order);
        SELECT id, name, icon, display_order, created_at, updated_at
        FROM departments
        WHERE id = SCOPE_IDENTITY();
      `);

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department', details: error.message });
  }
});

// Update department
app.put('/api/admin/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, display_order } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('icon', sql.NVarChar, icon)
      .input('display_order', sql.Int, display_order)
      .query(`
        UPDATE departments
        SET name = @name, icon = @icon, display_order = @display_order, updated_at = GETDATE()
        WHERE id = @id
      `);

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM departments WHERE id = @id');

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department', details: error.message });
  }
});

// Delete department
app.delete('/api/admin/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM departments WHERE id = @id');

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department', details: error.message });
  }
});

// Get all subcategories (optionally filtered by department)
app.get('/api/admin/subcategories', async (req, res) => {
  try {
    const { department } = req.query;

    let query = `
      SELECT id, name, department_name, display_order, created_at, updated_at
      FROM subcategories
    `;

    if (department) {
      query += ' WHERE department_name = @department';
    }

    query += ' ORDER BY department_name, display_order, name';

    const request = pool.request();
    if (department) {
      request.input('department', sql.NVarChar, department);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories', details: error.message });
  }
});

// Create new subcategory
app.post('/api/admin/subcategories', async (req, res) => {
  try {
    const { name, department_name, display_order } = req.body;

    if (!name || !department_name) {
      return res.status(400).json({ error: 'Name and department_name are required' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('department_name', sql.NVarChar, department_name)
      .input('display_order', sql.Int, display_order || 999)
      .query(`
        INSERT INTO subcategories (name, department_name, display_order)
        VALUES (@name, @department_name, @display_order);
        SELECT id, name, department_name, display_order, created_at, updated_at
        FROM subcategories
        WHERE id = SCOPE_IDENTITY();
      `);

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory', details: error.message });
  }
});

// Update subcategory
app.put('/api/admin/subcategories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department_name, display_order } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('department_name', sql.NVarChar, department_name)
      .input('display_order', sql.Int, display_order)
      .query(`
        UPDATE subcategories
        SET name = @name, department_name = @department_name, display_order = @display_order, updated_at = GETDATE()
        WHERE id = @id
      `);

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM subcategories WHERE id = @id');

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ error: 'Failed to update subcategory', details: error.message });
  }
});

// Delete subcategory
app.delete('/api/admin/subcategories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM subcategories WHERE id = @id');

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory', details: error.message });
  }
});

// =============================================================================
// ADMIN ENDPOINTS (NO AUTH FOR NOW)
// =============================================================================

// CREATE new prompt
app.post('/api/admin/prompts', async (req, res) => {
  try {
    const {
      title, department, subcategory, description, content,
      tags, tips, additional_tips, images, icon, complexity, word_count, metadata,
      prompt_category, works_in_json
    } = req.body;

    // Generate unique ID
    const id = 'prompt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Calculate word count if not provided
    const finalWordCount = word_count || (content ? content.split(/\s+/).length : 0);

    // Look up prompt_category_id if prompt_category name is provided
    let promptCategoryId = null;
    if (prompt_category) {
      const categoryResult = await pool.request()
        .input('name', sql.NVarChar, prompt_category)
        .query('SELECT id FROM prompt_categories WHERE name = @name');
      if (categoryResult.recordset.length > 0) {
        promptCategoryId = categoryResult.recordset[0].id;
      }
    }

    const result = await pool.request()
      .input('id', sql.NVarChar, id)
      .input('title', sql.NVarChar, title)
      .input('department', sql.NVarChar, department)
      .input('subcategory', sql.NVarChar, subcategory || null)
      .input('description', sql.NVarChar, description || '')
      .input('content', sql.NVarChar(sql.MAX), content || '')
      .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(tags || []))
      .input('tips', sql.NVarChar(sql.MAX), JSON.stringify(tips || []))
      .input('additional_tips', sql.NVarChar(sql.MAX), JSON.stringify(additional_tips || []))
      .input('images', sql.NVarChar(sql.MAX), JSON.stringify(images || []))
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .input('icon', sql.NVarChar, icon || '📝')
      .input('complexity', sql.NVarChar, complexity || 'intermediate')
      .input('word_count', sql.Int, finalWordCount)
      .input('prompt_category_id', sql.Int, promptCategoryId)
      .input('works_in_json', sql.NVarChar(sql.MAX), works_in_json || null)
      .input('tenant_id', sql.NVarChar, '1350831b-3d20-4491-af55-49b3d67b492f')
      .input('is_shared', sql.Bit, 1)
      .input('visibility', sql.NVarChar, 'tenant')
      .input('created_by', sql.NVarChar, 'admin')
      .query(`
        INSERT INTO prompts (
          id, title, department, subcategory, description, content,
          tags, tips, additional_tips, images, metadata, icon, complexity, word_count,
          prompt_category_id, works_in_json,
          tenant_id, is_shared, visibility, created_at, updated_at,
          created_by, view_count, favorite_count, copy_count, version
        ) VALUES (
          @id, @title, @department, @subcategory, @description, @content,
          @tags, @tips, @additional_tips, @images, @metadata, @icon, @complexity, @word_count,
          @prompt_category_id, @works_in_json,
          @tenant_id, @is_shared, @visibility, GETDATE(), GETDATE(),
          @created_by, 0, 0, 0, 1
        )
      `);

    res.json({
      success: true,
      id,
      message: 'Prompt created successfully'
    });

  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt', details: error.message });
  }
});

// UPDATE existing prompt
app.put('/api/admin/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, department, subcategory, description, content,
      tags, tips, images, icon, complexity, word_count, metadata
    } = req.body;

    // Calculate word count if not provided
    const finalWordCount = word_count || (content ? content.split(/\s+/).length : 0);

    const result = await pool.request()
      .input('id', sql.NVarChar, id)
      .input('title', sql.NVarChar, title)
      .input('department', sql.NVarChar, department)
      .input('subcategory', sql.NVarChar, subcategory || null)
      .input('description', sql.NVarChar, description)
      .input('content', sql.NVarChar(sql.MAX), content)
      .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(tags || []))
      .input('tips', sql.NVarChar(sql.MAX), JSON.stringify(tips || []))
      .input('images', sql.NVarChar(sql.MAX), JSON.stringify(images || []))
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .input('icon', sql.NVarChar, icon)
      .input('complexity', sql.NVarChar, complexity)
      .input('word_count', sql.Int, finalWordCount)
      .input('updated_by', sql.NVarChar, 'admin')
      .query(`
        UPDATE prompts
        SET
          title = @title,
          department = @department,
          subcategory = @subcategory,
          description = @description,
          content = @content,
          tags = @tags,
          tips = @tips,
          images = @images,
          metadata = @metadata,
          icon = @icon,
          complexity = @complexity,
          word_count = @word_count,
          updated_at = GETDATE(),
          updated_by = @updated_by
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      message: 'Prompt updated successfully'
    });

  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt', details: error.message });
  }
});

// DELETE prompt
app.delete('/api/admin/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('DELETE FROM prompts WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt', details: error.message });
  }
});

// Get all subcategories (distinct from prompts table)
app.get('/api/admin/subcategories', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT DISTINCT
        subcategory,
        department,
        COUNT(*) as prompt_count
      FROM prompts
      WHERE subcategory IS NOT NULL
      GROUP BY subcategory, department
      ORDER BY department, subcategory
    `);

    res.json({ subcategories: result.recordset });

  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories', details: error.message });
  }
});

// Bulk create prompts (for importing)
app.post('/api/admin/prompts/bulk', async (req, res) => {
  try {
    const { prompts } = req.body;

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: 'Invalid prompts array' });
    }

    let successCount = 0;
    let errors = [];

    for (const prompt of prompts) {
      try {
        const id = 'prompt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const wordCount = prompt.word_count || (prompt.content ? prompt.content.split(/\s+/).length : 0);

        await pool.request()
          .input('id', sql.NVarChar, id)
          .input('title', sql.NVarChar, prompt.title)
          .input('department', sql.NVarChar, prompt.department)
          .input('subcategory', sql.NVarChar, prompt.subcategory || null)
          .input('description', sql.NVarChar, prompt.description || '')
          .input('content', sql.NVarChar(sql.MAX), prompt.content || '')
          .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(prompt.tags || []))
          .input('tips', sql.NVarChar(sql.MAX), JSON.stringify(prompt.tips || []))
          .input('images', sql.NVarChar(sql.MAX), JSON.stringify(prompt.images || []))
          .input('metadata', sql.NVarChar(sql.MAX), prompt.metadata ? JSON.stringify(prompt.metadata) : null)
          .input('icon', sql.NVarChar, prompt.icon || '📝')
          .input('complexity', sql.NVarChar, prompt.complexity || 'intermediate')
          .input('word_count', sql.Int, wordCount)
          .input('tenant_id', sql.NVarChar, '1350831b-3d20-4491-af55-49b3d67b492f')
          .input('is_shared', sql.Bit, 1)
          .input('visibility', sql.NVarChar, 'tenant')
          .input('created_by', sql.NVarChar, 'admin')
          .query(`
            INSERT INTO prompts (
              id, title, department, subcategory, description, content,
              tags, tips, images, metadata, icon, complexity, word_count,
              tenant_id, is_shared, visibility, created_at, updated_at,
              created_by, view_count, favorite_count, copy_count, version
            ) VALUES (
              @id, @title, @department, @subcategory, @description, @content,
              @tags, @tips, @images, @metadata, @icon, @complexity, @word_count,
              @tenant_id, @is_shared, @visibility, GETDATE(), GETDATE(),
              @created_by, 0, 0, 0, 1
            )
          `);

        successCount++;
      } catch (err) {
        errors.push({
          title: prompt.title,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      imported: successCount,
      total: prompts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error bulk creating prompts:', error);
    res.status(500).json({ error: 'Failed to bulk create prompts', details: error.message });
  }
});

// ============================================================================
// PROMPT CATEGORIES ENDPOINTS
// ============================================================================

// Get all prompt categories
app.get('/api/admin/prompt-categories', async (req, res) => {
  try {
    const result = await pool.request().query(
      'SELECT * FROM prompt_categories ORDER BY display_order'
    );
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching prompt categories:', error);
    res.status(500).json({ error: 'Failed to fetch prompt categories' });
  }
});

// Create new prompt category
app.post('/api/admin/prompt-categories', async (req, res) => {
  try {
    const { name, display_order = 999 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('displayOrder', sql.Int, display_order)
      .query(`
        INSERT INTO prompt_categories (name, display_order)
        VALUES (@name, @displayOrder)
      `);

    res.status(201).json({ success: true, message: 'Prompt category created successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    console.error('Error creating prompt category:', error);
    res.status(500).json({ error: 'Failed to create prompt category' });
  }
});

// Update prompt category
app.put('/api/admin/prompt-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_order } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('displayOrder', sql.Int, display_order)
      .query(`
        UPDATE prompt_categories
        SET name = @name,
            display_order = @displayOrder,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({ success: true, message: 'Prompt category updated successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    console.error('Error updating prompt category:', error);
    res.status(500).json({ error: 'Failed to update prompt category' });
  }
});

// Delete prompt category
app.delete('/api/admin/prompt-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM prompt_categories WHERE id = @id');

    res.json({ success: true, message: 'Prompt category deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt category:', error);
    res.status(500).json({ error: 'Failed to delete prompt category' });
  }
});

// ============================================================================
// WORKS IN ENDPOINTS
// ============================================================================

// Get all works-in platforms
app.get('/api/admin/works-in', async (req, res) => {
  try {
    const result = await pool.request().query(
      'SELECT * FROM works_in ORDER BY display_order'
    );
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching works-in platforms:', error);
    res.status(500).json({ error: 'Failed to fetch works-in platforms' });
  }
});

// Create new works-in platform
app.post('/api/admin/works-in', async (req, res) => {
  try {
    const { name, display_order = 999 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('displayOrder', sql.Int, display_order)
      .query(`
        INSERT INTO works_in (name, display_order)
        VALUES (@name, @displayOrder)
      `);

    res.status(201).json({ success: true, message: 'Works-in platform created successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A platform with this name already exists' });
    }
    console.error('Error creating works-in platform:', error);
    res.status(500).json({ error: 'Failed to create works-in platform' });
  }
});

// Update works-in platform
app.put('/api/admin/works-in/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_order } = req.body;

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('displayOrder', sql.Int, display_order)
      .query(`
        UPDATE works_in
        SET name = @name,
            display_order = @displayOrder,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({ success: true, message: 'Works-in platform updated successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A platform with this name already exists' });
    }
    console.error('Error updating works-in platform:', error);
    res.status(500).json({ error: 'Failed to update works-in platform' });
  }
});

// Delete works-in platform
app.delete('/api/admin/works-in/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM works_in WHERE id = @id');

    res.json({ success: true, message: 'Works-in platform deleted successfully' });
  } catch (error) {
    console.error('Error deleting works-in platform:', error);
    res.status(500).json({ error: 'Failed to delete works-in platform' });
  }
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Simplified API running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

