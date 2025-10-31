/**
 * Express API Server for Teams Prompt Library
 * Multi-tenant, scalable API with Azure SQL backend
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { pool, poolConnect, executeQuery, executeStoredProcedure, testConnection } = require('./db/sqlClient');
const { validateToken, optionalAuth, extractTenant } = require('./middleware/auth');
const { requireRole, auditLog } = require('./middleware/rbac');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "*.teams.microsoft.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "*.azurewebsites.net", "*.azurestaticapps.net"],
      connectSrc: ["'self'", "*.teams.microsoft.com", "*.azure.com"],
      frameSrc: ["'self'", "*.teams.microsoft.com"]
    }
  }
}));

// CORS - Allow Teams clients
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://teams.microsoft.com',
    '*.azurestaticapps.net',
    '*.teams.microsoft.com'
  ],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.query);
    next();
  });
}

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

// DB-independent health check
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// Database connectivity check
app.get('/db-ping', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query('SELECT 1 AS ok');
    res.json({ ok: true, result: result.recordset });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// ============================================================================
// PROMPTS ENDPOINTS
// ============================================================================

/**
 * GET /api/prompts
 * Get all prompts for the authenticated user's tenant (including shared prompts)
 * Query params: department, search, offset, limit
 */
app.get('/api/prompts', validateToken, extractTenant, auditLog('prompt_list'), async (req, res) => {
  try {
    const { department, search, offset = 0, limit = 50 } = req.query;
    const { tenantId } = req;

    // Use stored procedure for optimized query
    const prompts = await executeStoredProcedure('sp_GetPromptsForTenant', {
      tenantId,
      department: department || null,
      searchTerm: search || null,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    res.json({
      prompts,
      count: prompts.length,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch prompts'
    });
  }
});

/**
 * GET /api/prompts/:id
 * Get a specific prompt by ID
 */
app.get('/api/prompts/:id', validateToken, extractTenant, auditLog('prompt_view'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req;

    const results = await executeQuery(
      `SELECT * FROM prompts
       WHERE id = @id AND (tenant_id = @tenantId OR is_shared = 1)`,
      { id, tenantId }
    );

    if (results.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Prompt not found'
      });
    }

    // Record analytics event
    await executeStoredProcedure('sp_RecordAnalyticsEvent', {
      eventType: 'prompt_view',
      userId: req.user.id,
      promptId: id,
      tenantId
    });

    res.json(results[0]);

  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch prompt'
    });
  }
});

/**
 * POST /api/prompts
 * Create a new prompt (requires Contributor role)
 */
app.post('/api/prompts', validateToken, extractTenant, requireRole('contributor'), auditLog('prompt_create'), async (req, res) => {
  try {
    const {
      title,
      department,
      subcategory,
      description,
      content,
      tags,
      complexity,
      icon,
      tips,
      additional_tips,
      what_it_does,
      example_output,
      visibility = 'tenant'
    } = req.body;

    const { tenantId, user } = req;

    // Generate prompt ID
    const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate word count
    const wordCount = content.split(/\s+/).length;

    await executeQuery(
      `INSERT INTO prompts
       (id, title, department, subcategory, description, content, tags, word_count, complexity, icon, tips, additional_tips, what_it_does, example_output, tenant_id, visibility, created_by)
       VALUES (@id, @title, @department, @subcategory, @description, @content, @tags, @wordCount, @complexity, @icon, @tips, @additionalTips, @whatItDoes, @exampleOutput, @tenantId, @visibility, @createdBy)`,
      {
        id: promptId,
        title,
        department,
        subcategory: subcategory || null,
        description: description || null,
        content,
        tags: JSON.stringify(tags || []),
        wordCount,
        complexity: complexity || 'Intermediate',
        icon: icon || '📝',
        tips: JSON.stringify(tips || []),
        additionalTips: JSON.stringify(additional_tips || []),
        whatItDoes: what_it_does || null,
        exampleOutput: example_output || null,
        tenantId,
        visibility,
        createdBy: user.id
      }
    );

    res.status(201).json({
      success: true,
      promptId,
      message: 'Prompt created successfully'
    });

  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to create prompt'
    });
  }
});

/**
 * PUT /api/prompts/:id
 * Update an existing prompt (requires Admin role or ownership)
 */
app.put('/api/prompts/:id', validateToken, extractTenant, requireRole('contributor'), auditLog('prompt_update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, tags, complexity, visibility, tips, additional_tips, what_it_does, example_output } = req.body;
    const { tenantId, user } = req;

    // Check ownership or admin rights
    const existing = await executeQuery(
      'SELECT created_by FROM prompts WHERE id = @id AND tenant_id = @tenantId',
      { id, tenantId }
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Prompt not found'
      });
    }

    // Only allow update if user is owner or admin
    if (existing[0].created_by !== user.id && user.role !== 'admin') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to edit this prompt'
      });
    }

    // Update prompt
    const wordCount = content ? content.split(/\s+/).length : null;

    await executeQuery(
      `UPDATE prompts
       SET
         title = COALESCE(@title, title),
         description = COALESCE(@description, description),
         content = COALESCE(@content, content),
         tags = COALESCE(@tags, tags),
         word_count = COALESCE(@wordCount, word_count),
         complexity = COALESCE(@complexity, complexity),
         visibility = COALESCE(@visibility, visibility),
         tips = COALESCE(@tips, tips),
         additional_tips = COALESCE(@additionalTips, additional_tips),
         what_it_does = COALESCE(@whatItDoes, what_it_does),
         example_output = COALESCE(@exampleOutput, example_output),
         updated_by = @updatedBy,
         version = version + 1
       WHERE id = @id AND tenant_id = @tenantId`,
      {
        id,
        tenantId,
        title: title || null,
        description: description || null,
        content: content || null,
        tags: tags ? JSON.stringify(tags) : null,
        wordCount: wordCount || null,
        complexity: complexity || null,
        visibility: visibility || null,
        tips: tips ? JSON.stringify(tips) : null,
        additionalTips: additional_tips ? JSON.stringify(additional_tips) : null,
        whatItDoes: what_it_does || null,
        exampleOutput: example_output || null,
        updatedBy: user.id
      }
    );

    res.json({
      success: true,
      message: 'Prompt updated successfully'
    });

  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to update prompt'
    });
  }
});

/**
 * DELETE /api/prompts/:id
 * Delete a prompt (requires Admin role)
 */
app.delete('/api/prompts/:id', validateToken, extractTenant, requireRole('admin'), auditLog('prompt_delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req;

    const result = await executeQuery(
      'DELETE FROM prompts WHERE id = @id AND tenant_id = @tenantId',
      { id, tenantId }
    );

    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to delete prompt'
    });
  }
});

/**
 * DELETE /api/admin/prompts/:id
 * Admin delete endpoint (alias for /api/prompts/:id)
 */
app.delete('/api/admin/prompts/:id', validateToken, extractTenant, requireRole('admin'), auditLog('prompt_delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req;

    const result = await executeQuery(
      'DELETE FROM prompts WHERE id = @id AND tenant_id = @tenantId',
      { id, tenantId }
    );

    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to delete prompt'
    });
  }
});

// ============================================================================
// FAVORITES ENDPOINTS
// ============================================================================

/**
 * GET /api/favorites
 * Get user's favorite prompts
 */
app.get('/api/favorites', validateToken, extractTenant, async (req, res) => {
  try {
    const { user, tenantId } = req;

    const favorites = await executeQuery(
      `SELECT p.*
       FROM prompts p
       INNER JOIN favorites f ON p.id = f.prompt_id
       WHERE f.user_id = @userId AND f.tenant_id = @tenantId
       ORDER BY f.created_at DESC`,
      { userId: user.id, tenantId }
    );

    res.json({ favorites });

  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch favorites'
    });
  }
});

/**
 * POST /api/favorites/:promptId
 * Add prompt to favorites
 */
app.post('/api/favorites/:promptId', validateToken, extractTenant, auditLog('favorite_add'), async (req, res) => {
  try {
    const { promptId } = req.params;
    const { user, tenantId } = req;

    await executeQuery(
      `INSERT INTO favorites (user_id, prompt_id, tenant_id)
       VALUES (@userId, @promptId, @tenantId)`,
      { userId: user.id, promptId, tenantId }
    );

    // Update prompt favorite count
    await executeQuery(
      'UPDATE prompts SET favorite_count = favorite_count + 1 WHERE id = @promptId',
      { promptId }
    );

    res.json({
      success: true,
      message: 'Added to favorites'
    });

  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({
        error: 'already_exists',
        message: 'Prompt already in favorites'
      });
    }

    console.error('Error adding favorite:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to add favorite'
    });
  }
});

/**
 * DELETE /api/favorites/:promptId
 * Remove prompt from favorites
 */
app.delete('/api/favorites/:promptId', validateToken, extractTenant, auditLog('favorite_remove'), async (req, res) => {
  try {
    const { promptId } = req.params;
    const { user, tenantId } = req;

    await executeQuery(
      'DELETE FROM favorites WHERE user_id = @userId AND prompt_id = @promptId AND tenant_id = @tenantId',
      { userId: user.id, promptId, tenantId }
    );

    // Update prompt favorite count
    await executeQuery(
      'UPDATE prompts SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = @promptId',
      { promptId }
    );

    res.json({
      success: true,
      message: 'Removed from favorites'
    });

  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to remove favorite'
    });
  }
});

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * POST /api/search
 * Full-text search across prompts
 */
app.post('/api/search', validateToken, extractTenant, auditLog('search'), async (req, res) => {
  try {
    const { query, department, limit = 50 } = req.body;
    const { tenantId, user } = req;

    // Record search analytics
    await executeStoredProcedure('sp_RecordAnalyticsEvent', {
      eventType: 'search',
      userId: user.id,
      promptId: null,
      tenantId,
      searchQuery: query,
      department: department || null
    });

    // Full-text search
    const results = await executeQuery(
      `SELECT TOP(@limit) *
       FROM prompts
       WHERE (tenant_id = @tenantId OR is_shared = 1)
         AND (@department IS NULL OR department = @department)
         AND CONTAINS((title, description, content), @query)
       ORDER BY view_count DESC, created_at DESC`,
      {
        tenantId,
        department: department || null,
        query,
        limit: parseInt(limit)
      }
    );

    res.json({
      results,
      count: results.length,
      query
    });

  } catch (error) {
    console.error('Error searching prompts:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Search failed'
    });
  }
});

// ============================================================================
// DEPARTMENTS ENDPOINT
// ============================================================================

/**
 * GET /api/departments
 * Get all departments (public endpoint)
 */
app.get('/api/departments', optionalAuth, async (req, res) => {
  try {
    const departments = await executeQuery(
      'SELECT * FROM departments WHERE is_active = 1 ORDER BY display_order'
    );

    res.json({ departments });

  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch departments'
    });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS (Admin only)
// ============================================================================

/**
 * GET /api/admin/analytics
 * Get usage analytics (Admin only)
 */
app.get('/api/admin/analytics', validateToken, extractTenant, requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req;
    const { range = 30 } = req.query;  // days

    const analytics = await executeQuery(
      `SELECT
         event_type,
         COUNT(*) as count,
         COUNT(DISTINCT user_id) as unique_users
       FROM analytics_events
       WHERE tenant_id = @tenantId
         AND timestamp >= DATEADD(day, -@range, GETDATE())
       GROUP BY event_type`,
      { tenantId, range: parseInt(range) }
    );

    const topPrompts = await executeQuery(
      `SELECT TOP 10
         p.id, p.title, p.department,
         p.view_count, p.copy_count, p.favorite_count
       FROM prompts p
       WHERE p.tenant_id = @tenantId
       ORDER BY (p.view_count + p.copy_count * 2 + p.favorite_count * 3) DESC`,
      { tenantId }
    );

    res.json({
      analytics,
      topPrompts,
      range: parseInt(range)
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch analytics'
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'server_error',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log('Server listening on', port);
});

module.exports = app;
