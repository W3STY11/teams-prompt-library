#!/usr/bin/env node

/**
 * Import ALL prompts from Notion HTML files into Azure SQL
 * This script extracts COMPLETE metadata from HTML files:
 * - Tips, Additional Tips
 * - What It Does, How To Use
 * - Example Input, Example Output
 * - Tags, Complexity, Department, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import sql from 'mssql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQL Configuration from environment variables
const SQL_CONFIG = {
  server: process.env.SQL_SERVER || 'promptlib-sql-111.database.windows.net',
  database: process.env.SQL_DATABASE || 'promptlibrary',
  user: process.env.SQL_USER || 'sqladmin',
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Source directory - Notion export HTML files
const SOURCE_ROOT = '/home/aiwithnick/spark-ai-prompt-library/Prompts';

// Department configuration
const DEPARTMENTS = {
  'AI Prompts for Business': { name: 'Business', icon: '💼' },
  'AI Prompts for Marketing': { name: 'Marketing', icon: '📢' },
  'AI Prompts for Sales': { name: 'Sales', icon: '💰' },
  'AI Prompts for SEO': { name: 'SEO', icon: '🔍' },
  'AI Prompts for Finance': { name: 'Finance', icon: '💵' },
  'AI Prompts for Education': { name: 'Education', icon: '📚' },
  'AI Prompts for Writing': { name: 'Writing', icon: '✍️' },
  'AI Prompts for Productivity': { name: 'Productivity', icon: '⚡' },
  'AI Prompts for Solopreneurs': { name: 'Solopreneurs', icon: '🚀' }
};

/**
 * Generate unique ID from file path (MD5 hash)
 */
function generatePromptId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

/**
 * Extract tags from HTML (from class attributes or data attributes)
 */
function extractTags($) {
  const tags = [];

  // Look for tag elements in various possible locations
  $('[class*="tag"], [data-tag], .notion-property-multi_select-item').each((i, el) => {
    const tag = $(el).text().trim();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  });

  return tags;
}

/**
 * Parse HTML file and extract ALL metadata
 */
function parsePromptHTML(htmlPath, deptFolder) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(htmlContent);

  // Get department from folder name
  const deptConfig = DEPARTMENTS[deptFolder];
  if (!deptConfig) {
    console.warn(`Unknown department: ${deptFolder}`);
    return null;
  }

  // Extract title
  const title = $('h1.page-title, h1').first().text().trim();
  if (!title) {
    console.warn(`No title found in ${htmlPath}`);
    return null;
  }

  // Extract date
  const dateMatch = htmlContent.match(/(\w+ \d{1,2}, \d{4})/);
  const date = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Extract description (usually in yellow callout with 💡)
  let description = '';
  $('.callout').each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes('💡') || $(el).find('.icon').text().includes('💡')) {
      description = text.replace(/💡/g, '').trim();
    }
  });

  // If no description found, use first paragraph
  if (!description) {
    description = $('p').first().text().trim();
  }

  // Extract subcategory (usually below title)
  let subcategory = '';
  $('h2, h3').each((i, el) => {
    const text = $(el).text().trim();
    if (text && !text.includes('What') && !text.includes('Prompt') && !text.includes('How') && !text.includes('Example') && !text.includes('Tips')) {
      if (!subcategory) subcategory = text;
    }
  });

  // Extract "What This Mega-Prompt Does" section
  let whatItDoes = '';
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('What') && heading.includes('Does')) {
      let content = '';
      $(el).nextUntil('h1, h2, h3, pre, .code').each((j, nextEl) => {
        content += $(nextEl).text().trim() + '\n';
      });
      whatItDoes = content.trim();
    }
  });

  // Extract Tips section
  let tips = [];
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('💡') && heading.includes('Tips') && !heading.includes('Additional')) {
      $(el).nextUntil('h1, h2, h3, pre, .code').find('li, p').each((j, tipEl) => {
        const tip = $(tipEl).text().trim();
        if (tip && tip.length > 10) {
          tips.push(tip);
        }
      });
    }
  });

  // Extract the actual prompt content (in code block or pre)
  let content = '';
  $('pre, code, .code').each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 100 && (text.includes('#CONTEXT') || text.includes('#GOAL') || text.includes('#RESPONSE'))) {
      content = text;
    }
  });

  // If no code block found, try to extract from page
  if (!content) {
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 100) {
        content += text + '\n\n';
      }
    });
  }

  // Extract "How To Use" section
  let howToUse = '';
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('How') && heading.includes('Use')) {
      let content = '';
      $(el).nextUntil('h1, h2, h3, pre, .code').each((j, nextEl) => {
        content += $(nextEl).text().trim() + '\n';
      });
      howToUse = content.trim();
    }
  });

  // Extract "Example Input" section
  let exampleInput = '';
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('Example') && heading.includes('Input')) {
      let content = '';
      $(el).nextUntil('h1, h2, h3, img').each((j, nextEl) => {
        content += $(nextEl).text().trim() + '\n';
      });
      exampleInput = content.trim();
    }
  });

  // Extract "Example Output" section (text or image filename)
  let exampleOutput = '';
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('Example') && heading.includes('Output')) {
      // Look for image after this heading
      const img = $(el).nextAll('img, figure').first();
      if (img.length) {
        const imgSrc = img.find('img').attr('src') || img.attr('src') || '';
        if (imgSrc) {
          exampleOutput = path.basename(imgSrc);
        }
      }

      // Also get text content
      let content = '';
      $(el).nextUntil('h1, h2, h3, img, figure').each((j, nextEl) => {
        content += $(nextEl).text().trim() + '\n';
      });
      if (content.trim()) {
        exampleOutput = (exampleOutput ? exampleOutput + '\n\n' : '') + content.trim();
      }
    }
  });

  // Extract "Additional Tips" section
  let additionalTips = [];
  $('h1, h2, h3').each((i, el) => {
    const heading = $(el).text().trim();
    if (heading.includes('Additional') && heading.includes('Tips')) {
      $(el).nextUntil('h1, h2, h3').find('li, p').each((j, tipEl) => {
        const tip = $(tipEl).text().trim();
        if (tip && tip.length > 10) {
          additionalTips.push(tip);
        }
      });
    }
  });

  // Extract tags
  const tags = extractTags($);

  // Calculate word count
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  // Determine complexity based on word count and content
  let complexity = 'Intermediate';
  if (wordCount < 200) complexity = 'Beginner';
  else if (wordCount > 500) complexity = 'Advanced';

  // Generate unique ID
  const id = generatePromptId(htmlPath);

  return {
    id,
    title,
    department: deptConfig.name,
    subcategory: subcategory || 'General',
    description: description || title,
    content: content || description,
    tags: tags.length > 0 ? tags : ['ai', 'prompt', deptConfig.name.toLowerCase()],
    tips: tips.length > 0 ? tips : [],
    additional_tips: additionalTips.length > 0 ? additionalTips : [],
    what_it_does: whatItDoes || '',
    how_to_use: howToUse || '',
    example_input: exampleInput || '',
    example_output: exampleOutput || '',
    word_count: wordCount,
    complexity,
    icon: deptConfig.icon,
    date,
    images: exampleOutput && exampleOutput.includes('.png') ? [exampleOutput.split('\n')[0]] : [],
    status: 'approved'
  };
}

/**
 * Insert or update prompt in SQL database
 */
async function upsertPrompt(pool, prompt, tenantId) {
  try {
    const request = pool.request();

    // Check if prompt exists by matching title + department (more reliable than ID)
    request.input('title', sql.NVarChar, prompt.title);
    request.input('department', sql.NVarChar, prompt.department);
    const existing = await request.query('SELECT id FROM prompts WHERE title = @title AND department = @department');

    if (existing.recordset.length > 0) {
      // UPDATE existing prompt (use the existing ID from database)
      const existingId = existing.recordset[0].id;
      const updateRequest = pool.request();
      updateRequest.input('id', sql.NVarChar, existingId);
      updateRequest.input('title', sql.NVarChar, prompt.title);
      updateRequest.input('department', sql.NVarChar, prompt.department);
      updateRequest.input('subcategory', sql.NVarChar, prompt.subcategory);
      updateRequest.input('description', sql.NVarChar, prompt.description);
      updateRequest.input('content', sql.NVarChar, prompt.content);
      updateRequest.input('tags', sql.NVarChar, JSON.stringify(prompt.tags));
      updateRequest.input('tips', sql.NVarChar, JSON.stringify(prompt.tips));
      updateRequest.input('additional_tips', sql.NVarChar, JSON.stringify(prompt.additional_tips));
      updateRequest.input('what_it_does', sql.NVarChar, prompt.what_it_does);
      updateRequest.input('example_output', sql.NVarChar, prompt.example_output);
      updateRequest.input('word_count', sql.Int, prompt.word_count);
      updateRequest.input('complexity', sql.NVarChar, prompt.complexity);
      updateRequest.input('icon', sql.NVarChar, prompt.icon);

      await updateRequest.query(`
        UPDATE prompts SET
          title = @title,
          department = @department,
          subcategory = @subcategory,
          description = @description,
          content = @content,
          tags = @tags,
          tips = @tips,
          additional_tips = @additional_tips,
          what_it_does = @what_it_does,
          example_output = @example_output,
          word_count = @word_count,
          complexity = @complexity,
          icon = @icon,
          updated_at = GETDATE()
        WHERE id = @id
      `);

      return 'updated';
    } else {
      // INSERT new prompt
      const insertRequest = pool.request();
      insertRequest.input('id', sql.NVarChar, prompt.id);
      insertRequest.input('title', sql.NVarChar, prompt.title);
      insertRequest.input('department', sql.NVarChar, prompt.department);
      insertRequest.input('subcategory', sql.NVarChar, prompt.subcategory);
      insertRequest.input('description', sql.NVarChar, prompt.description);
      insertRequest.input('content', sql.NVarChar, prompt.content);
      insertRequest.input('tags', sql.NVarChar, JSON.stringify(prompt.tags));
      insertRequest.input('tips', sql.NVarChar, JSON.stringify(prompt.tips));
      insertRequest.input('additional_tips', sql.NVarChar, JSON.stringify(prompt.additional_tips));
      insertRequest.input('what_it_does', sql.NVarChar, prompt.what_it_does);
      insertRequest.input('example_output', sql.NVarChar, prompt.example_output);
      insertRequest.input('word_count', sql.Int, prompt.word_count);
      insertRequest.input('complexity', sql.NVarChar, prompt.complexity);
      insertRequest.input('icon', sql.NVarChar, prompt.icon);
      insertRequest.input('tenant_id', sql.NVarChar, tenantId);
      insertRequest.input('visibility', sql.NVarChar, 'shared');
      insertRequest.input('is_shared', sql.Bit, 1);

      await insertRequest.query(`
        INSERT INTO prompts (
          id, title, department, subcategory, description, content,
          tags, tips, additional_tips, what_it_does, example_output,
          word_count, complexity, icon, tenant_id, visibility, is_shared
        ) VALUES (
          @id, @title, @department, @subcategory, @description, @content,
          @tags, @tips, @additional_tips, @what_it_does, @example_output,
          @word_count, @complexity, @icon, @tenant_id, @visibility, @is_shared
        )
      `);

      return 'inserted';
    }
  } catch (error) {
    console.error(`Error upserting prompt ${prompt.id}:`, error.message);
    throw error;
  }
}

/**
 * Main import function
 */
async function importAllPrompts() {
  console.log('🚀 Starting import from Notion HTML files...\n');
  console.log(`Source directory: ${SOURCE_ROOT}\n`);

  // Verify source directory exists
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(`❌ Source directory not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  // Connect to SQL
  console.log('📊 Connecting to Azure SQL...');
  const pool = await sql.connect(SQL_CONFIG);
  console.log('✅ Connected to SQL\n');

  const tenantId = 'default';
  const stats = {
    total: 0,
    inserted: 0,
    updated: 0,
    failed: 0
  };

  // Scan all department folders
  const departments = fs.readdirSync(SOURCE_ROOT).filter(f => {
    const fullPath = path.join(SOURCE_ROOT, f);
    return fs.statSync(fullPath).isDirectory() && DEPARTMENTS[f];
  });

  console.log(`📁 Found ${departments.length} department folders:\n`);
  departments.forEach(dept => console.log(`  - ${dept}`));
  console.log('');

  // Process each department
  for (const deptFolder of departments) {
    const deptPath = path.join(SOURCE_ROOT, deptFolder);
    const htmlFiles = fs.readdirSync(deptPath).filter(f => f.endsWith('.html'));

    console.log(`\n📂 Processing ${deptFolder} (${htmlFiles.length} files)...`);

    for (const htmlFile of htmlFiles) {
      const htmlPath = path.join(deptPath, htmlFile);
      stats.total++;

      try {
        // Parse HTML
        const prompt = parsePromptHTML(htmlPath, deptFolder);

        if (!prompt) {
          console.log(`  ⚠️  Skipped: ${htmlFile} (parsing failed)`);
          stats.failed++;
          continue;
        }

        // Insert/update in SQL
        const result = await upsertPrompt(pool, prompt, tenantId);

        if (result === 'inserted') {
          stats.inserted++;
          console.log(`  ✅ Inserted: ${prompt.title}`);
        } else {
          stats.updated++;
          console.log(`  🔄 Updated: ${prompt.title}`);
        }

      } catch (error) {
        console.error(`  ❌ Failed: ${htmlFile} - ${error.message}`);
        stats.failed++;
      }
    }
  }

  // Close SQL connection
  await pool.close();

  // Print summary
  console.log('\n\n📊 Import Summary:');
  console.log('═'.repeat(50));
  console.log(`Total HTML files: ${stats.total}`);
  console.log(`✅ Inserted: ${stats.inserted}`);
  console.log(`🔄 Updated: ${stats.updated}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log('═'.repeat(50));
  console.log('\n✨ Import complete!\n');
}

// Run import
importAllPrompts().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
