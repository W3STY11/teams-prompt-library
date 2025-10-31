#!/usr/bin/env node
/**
 * Run department and subcategory table migrations
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  user: process.env.SQL_USER || 'sqladmin',
  password: process.env.SQL_PASSWORD || 'NewSecure2026!',
  server: process.env.SQL_SERVER || 'promptlib-sql-111.database.windows.net',
  database: process.env.SQL_DATABASE || 'promptlibrary',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function runMigrations() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to Azure SQL Database\n');

    // Read SQL files
    const departmentsSQL = fs.readFileSync(
      path.join(__dirname, 'create-departments-table.sql'),
      'utf8'
    );

    const subcategoriesSQL = fs.readFileSync(
      path.join(__dirname, 'create-subcategories-table.sql'),
      'utf8'
    );

    // Run departments migration
    console.log('Creating departments table...');
    const deptStatements = departmentsSQL.split(';\n').filter(s => s.trim());
    for (const statement of deptStatements) {
      if (statement.trim()) {
        await pool.request().query(statement);
      }
    }
    console.log('✅ Departments table created\n');

    // Run subcategories migration
    console.log('Creating subcategories table...');
    const subcatStatements = subcategoriesSQL.split(';\n').filter(s => s.trim());
    for (const statement of subcatStatements) {
      if (statement.trim()) {
        await pool.request().query(statement);
      }
    }
    console.log('✅ Subcategories table created\n');

    // Verify tables exist
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
      AND TABLE_NAME IN ('departments', 'subcategories')
      ORDER BY TABLE_NAME
    `);

    console.log('Tables created:');
    result.recordset.forEach(row => {
      console.log(`  - ${row.TABLE_NAME}`);
    });

    // Show department data
    const depts = await pool.request().query('SELECT * FROM departments ORDER BY display_order');
    console.log(`\n✅ ${depts.recordset.length} departments inserted:`);
    depts.recordset.forEach(d => {
      console.log(`  ${d.icon} ${d.name} (order: ${d.display_order})`);
    });

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

runMigrations();
