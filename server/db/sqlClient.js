/**
 * Azure SQL Database Client
 * Uses tedious driver for Azure SQL connectivity
 * Connection pooling and error handling included
 */

const { Connection, Request, TYPES } = require('tedious');
const { ConnectionPool } = require('tedious-connection-pool');

// SQL Connection Configuration
const config = {
  server: process.env.SQL_SERVER,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD
    }
  },
  options: {
    database: process.env.SQL_DATABASE,
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    connectTimeout: 30000,
    requestTimeout: 30000,
    rowCollectionOnDone: true,
    rowCollectionOnRequestCompletion: true
  }
};

// Connection Pool Configuration
const poolConfig = {
  min: 2,
  max: 10,
  idleTimeout: 30000,
  retryDelay: 5000,
  acquireTimeout: 30000
};

// Create connection pool
const pool = new ConnectionPool(poolConfig, config);

pool.on('error', (err) => {
  console.error('SQL Pool Error:', err);
});

/**
 * Execute SQL query with parameters
 * @param {string} query - SQL query string
 * @param {object} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
function executeQuery(query, params = {}) {
  return new Promise((resolve, reject) => {
    pool.acquire((err, connection) => {
      if (err) {
        return reject(err);
      }

      const request = new Request(query, (err, rowCount, rows) => {
        connection.release();

        if (err) {
          return reject(err);
        }

        // Transform rows to objects
        const results = rows.map(row => {
          const obj = {};
          row.forEach(column => {
            obj[column.metadata.colName] = column.value;
          });
          return obj;
        });

        resolve(results);
      });

      // Add parameters
      Object.keys(params).forEach(key => {
        const value = params[key];
        const type = inferSQLType(value);
        request.addParameter(key, type, value);
      });

      connection.execSql(request);
    });
  });
}

/**
 * Execute stored procedure
 * @param {string} procedureName - Name of stored procedure
 * @param {object} params - Procedure parameters
 * @returns {Promise<Array>} Procedure results
 */
function executeStoredProcedure(procedureName, params = {}) {
  return new Promise((resolve, reject) => {
    pool.acquire((err, connection) => {
      if (err) {
        return reject(err);
      }

      const request = new Request(procedureName, (err, rowCount, rows) => {
        connection.release();

        if (err) {
          return reject(err);
        }

        const results = rows.map(row => {
          const obj = {};
          row.forEach(column => {
            obj[column.metadata.colName] = column.value;
          });
          return obj;
        });

        resolve(results);
      });

      // Add parameters
      Object.keys(params).forEach(key => {
        const value = params[key];
        const type = inferSQLType(value);
        request.addParameter(key, type, value);
      });

      connection.callProcedure(request);
    });
  });
}

/**
 * Infer SQL type from JavaScript value
 * @param {*} value - JavaScript value
 * @returns {object} Tedious type constant
 */
function inferSQLType(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TYPES.Int : TYPES.Float;
  }
  if (typeof value === 'boolean') {
    return TYPES.Bit;
  }
  if (value instanceof Date) {
    return TYPES.DateTime2;
  }
  if (value === null || value === undefined) {
    return TYPES.NVarChar;
  }
  return TYPES.NVarChar;
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const results = await executeQuery('SELECT 1 as test');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Close all database connections
 */
function closePool() {
  return new Promise((resolve) => {
    pool.drain(() => {
      console.log('Database connection pool closed');
      resolve();
    });
  });
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
  executeQuery,
  executeStoredProcedure,
  testConnection,
  closePool,
  TYPES
};
