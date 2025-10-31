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
    const { department, search, limit = 1000 } = req.query;
    
    let query = 'SELECT TOP (@limit) * FROM prompts WHERE 1=1';
    const request = pool.request();
    request.input('limit', sql.Int, parseInt(limit));
    
    if (department) {
      query += ' AND department = @department';
      request.input('department', sql.NVarChar, department);
    }
    
    if (search) {
      query += ' AND (title LIKE @search OR description LIKE @search OR content LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC';

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
      if (prompt.metadata && typeof prompt.metadata === 'string') {
        prompt.metadata = JSON.parse(prompt.metadata);
      }
      return prompt;
    });

    res.json({
      prompts,
      count: prompts.length
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
      .query('SELECT * FROM prompts WHERE id = @id');

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
    if (prompt.metadata && typeof prompt.metadata === 'string') {
      prompt.metadata = JSON.parse(prompt.metadata);
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
    const result = await pool.request().query(`
      SELECT 
        department as name,
        COUNT(*) as prompt_count
      FROM prompts
      GROUP BY department
      ORDER BY department
    `);
    
    // Add icons based on department name
    const icons = {
      'Business': '💼',
      'Marketing': '📢',
      'Sales': '💰',
      'SEO': '🔍',
      'Finance': '💵',
      'Education': '📚',
      'Writing': '✍️',
      'Productivity': '⚡',
      'Solopreneurs': '🚀'
    };
    
    const departments = result.recordset.map(d => ({
      name: d.name,
      icon: icons[d.name] || '📁',
      prompt_count: d.prompt_count
    }));
    
    res.json(departments);
    
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

// Favorites endpoints (NO AUTH - use in-memory for now)
const favorites = new Map(); // user_id -> Set of prompt_ids

app.get('/api/favorites', (req, res) => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const userFavorites = favorites.get(userId) || new Set();
  res.json({ favorites: Array.from(userFavorites) });
});

app.post('/api/favorites/:id', (req, res) => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const { id } = req.params;

  if (!favorites.has(userId)) {
    favorites.set(userId, new Set());
  }

  favorites.get(userId).add(id);
  res.json({ success: true });
});

app.delete('/api/favorites/:id', (req, res) => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const { id } = req.params;

  if (favorites.has(userId)) {
    favorites.get(userId).delete(id);
  }

  res.json({ success: true });
});

// =============================================================================
// ADMIN ENDPOINTS (NO AUTH FOR NOW)
// =============================================================================

// CREATE new prompt
app.post('/api/admin/prompts', async (req, res) => {
  try {
    const {
      title, department, subcategory, description, content,
      tags, tips, images, icon, complexity, word_count, metadata
    } = req.body;

    // Generate unique ID
    const id = 'prompt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Calculate word count if not provided
    const finalWordCount = word_count || (content ? content.split(/\s+/).length : 0);

    const result = await pool.request()
      .input('id', sql.NVarChar, id)
      .input('title', sql.NVarChar, title)
      .input('department', sql.NVarChar, department)
      .input('subcategory', sql.NVarChar, subcategory || null)
      .input('description', sql.NVarChar, description || '')
      .input('content', sql.NVarChar(sql.MAX), content || '')
      .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(tags || []))
      .input('tips', sql.NVarChar(sql.MAX), JSON.stringify(tips || []))
      .input('images', sql.NVarChar(sql.MAX), JSON.stringify(images || []))
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .input('icon', sql.NVarChar, icon || '📝')
      .input('complexity', sql.NVarChar, complexity || 'intermediate')
      .input('word_count', sql.Int, finalWordCount)
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

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Simplified API running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

