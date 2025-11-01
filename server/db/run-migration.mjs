#!/usr/bin/env node

/**
 * Run SQL migration to add missing columns
 * Usage: SQL_PASSWORD="your-password" node run-migration.mjs
 */

import fs from 'fs';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQL Configuration
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

async function runMigration() {
  if (!SQL_CONFIG.password) {
    console.error('❌ SQL_PASSWORD environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Connecting to Azure SQL...');
  console.log(`   Server: ${SQL_CONFIG.server}`);
  console.log(`   Database: ${SQL_CONFIG.database}`);
  console.log(`   User: ${SQL_CONFIG.user}\n`);

  try {
    const pool = await sql.connect(SQL_CONFIG);
    console.log('✅ Connected to SQL\n');

    // Read migration script
    const migrationPath = path.join(__dirname, 'create-prompt-categories-and-works-in.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration script:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log('');

    // Execute migration
    console.log('🚀 Executing migration...\n');
    const result = await pool.request().query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    if (result.recordsets && result.recordsets.length > 0) {
      console.log('📋 Verification results:');
      console.log(JSON.stringify(result.recordsets[0], null, 2));
    }

    await pool.close();
    console.log('\n✨ Migration complete - columns added successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();
