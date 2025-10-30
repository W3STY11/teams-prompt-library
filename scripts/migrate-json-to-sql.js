/**
 * Data Migration Script: JSON to Azure SQL
 * Migrates existing prompts from prompts_index.json to SQL database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { executeQuery } = require('../server/db/sqlClient');

// Configuration
const JSON_FILE_PATH = process.argv[2] || './public/prompts_index.json';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

/**
 * Load JSON data
 */
function loadJSON(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    console.log(`📁 Loading JSON from: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log(`✅ Loaded ${data.prompts?.length || 0} prompts`);

    return data;

  } catch (error) {
    console.error('❌ Failed to load JSON:', error.message);
    throw error;
  }
}

/**
 * Migrate prompts to SQL
 */
async function migratePrompts(prompts) {
  console.log(`\n🔄 Starting migration of ${prompts.length} prompts...`);

  let successCount = 0;
  let errorCount = 0;

  for (const prompt of prompts) {
    try {
      // Ensure ID exists
      if (!prompt.id) {
        prompt.id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Insert prompt
      await executeQuery(
        `INSERT INTO prompts
         (id, title, department, subcategory, description, content, tags, word_count, complexity, icon, tips, images, tenant_id, is_shared, created_by)
         VALUES (@id, @title, @department, @subcategory, @description, @content, @tags, @wordCount, @complexity, @icon, @tips, @images, @tenantId, @isShared, @createdBy)`,
        {
          id: prompt.id,
          title: prompt.title || 'Untitled',
          department: prompt.department || 'General',
          subcategory: prompt.subcategory || null,
          description: prompt.description || null,
          content: prompt.content || '',
          tags: JSON.stringify(prompt.tags || []),
          wordCount: prompt.word_count || 0,
          complexity: prompt.complexity || 'Intermediate',
          icon: prompt.icon || '📝',
          tips: JSON.stringify(prompt.tips || []),
          images: JSON.stringify(prompt.images || []),
          tenantId: DEFAULT_TENANT_ID,
          isShared: 1,  // Mark all imported prompts as shared
          createdBy: 'system'
        }
      );

      successCount++;

      // Progress indicator
      if (successCount % 100 === 0) {
        console.log(`  ✅ Migrated ${successCount} prompts...`);
      }

    } catch (error) {
      errorCount++;
      console.error(`  ❌ Failed to migrate prompt "${prompt.title}": ${error.message}`);
    }
  }

  console.log(`\n📊 Migration Complete:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📈 Success Rate: ${((successCount / prompts.length) * 100).toFixed(2)}%`);

  return { successCount, errorCount };
}

/**
 * Create backup before migration
 */
async function createBackup() {
  try {
    console.log('\n💾 Creating backup of existing data...');

    const existingPrompts = await executeQuery('SELECT * FROM prompts');

    if (existingPrompts.length > 0) {
      const backupPath = path.resolve(`./backups/prompts_backup_${Date.now()}.json`);

      // Ensure backups directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      fs.writeFileSync(backupPath, JSON.stringify(existingPrompts, null, 2));
      console.log(`✅ Backup created: ${backupPath}`);

      return backupPath;
    } else {
      console.log('ℹ️  No existing data to backup');
      return null;
    }

  } catch (error) {
    console.error('⚠️  Backup failed:', error.message);
    return null;
  }
}

/**
 * Verify migration
 */
async function verifyMigration(expectedCount) {
  try {
    console.log('\n🔍 Verifying migration...');

    const count = await executeQuery('SELECT COUNT(*) as total FROM prompts');
    const total = count[0].total;

    const departments = await executeQuery(
      'SELECT department, COUNT(*) as count FROM prompts GROUP BY department ORDER BY count DESC'
    );

    console.log(`\n📊 Database Statistics:`);
    console.log(`  Total Prompts: ${total}`);
    console.log(`  Expected: ${expectedCount}`);
    console.log(`  Match: ${total === expectedCount ? '✅' : '❌'}`);

    console.log(`\n  Prompts by Department:`);
    departments.forEach(dept => {
      console.log(`    ${dept.department}: ${dept.count}`);
    });

    return total === expectedCount;

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Teams Prompt Library - Data Migration                   ║
║  JSON → Azure SQL Database                                ║
╚═══════════════════════════════════════════════════════════╝
  `);

  try {
    // Load JSON data
    const data = loadJSON(JSON_FILE_PATH);

    if (!data.prompts || data.prompts.length === 0) {
      throw new Error('No prompts found in JSON file');
    }

    // Create backup
    await createBackup();

    // Migrate prompts
    const { successCount, errorCount } = await migratePrompts(data.prompts);

    // Verify migration
    await verifyMigration(successCount);

    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  Migration completed with ${errorCount} errors`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  main();
}

module.exports = { migratePrompts, loadJSON };
