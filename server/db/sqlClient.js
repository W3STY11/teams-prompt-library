/**
 * Azure SQL Database Client using mssql driver
 */

const sql = require('mssql');

// Log config for debugging (redact password)
console.log('🔍 SQL Config:', {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD ? `[${process.env.SQL_PASSWORD.length} chars]` : 'MISSING',
  passwordFirstChar: process.env.SQL_PASSWORD ? process.env.SQL_PASSWORD[0] : 'N/A',
  passwordLastChar: process.env.SQL_PASSWORD ? process.env.SQL_PASSWORD[process.env.SQL_PASSWORD.length - 1] : 'N/A'
});

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// Log connection attempts
poolConnect
  .then(() => {
    console.log('✅ Database connection pool established');
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('Full error:', err);
  });

/**
 * Execute SQL query with parameters
 */
async function executeQuery(query, params = {}) {
  try {
    await poolConnect;
    const request = pool.request();
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Query execution error:', error.message);
    throw error;
  }
}

/**
 * Execute stored procedure
 */
async function executeStoredProcedure(procedureName, params = {}) {
  try {
    await poolConnect;
    const request = pool.request();
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    const result = await request.execute(procedureName);
    return result.recordset;
  } catch (error) {
    console.error('Stored procedure execution error:', error.message);
    throw error;
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    await poolConnect;
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Close all database connections
 */
async function closePool() {
  try {
    await pool.close();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing pool:', error.message);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

module.exports = {
  sql,
  pool,
  poolConnect,
  executeQuery,
  executeStoredProcedure,
  testConnection,
  closePool
};
