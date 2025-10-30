const sql = require('mssql');

const config = {
  server: 'promptlib-sql-111.database.windows.net',
  database: 'promptlibrary',
  user: 'sqladmin',
  password: 'Ballern1!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

console.log('Testing mssql connection from local environment...');
const pool = new sql.ConnectionPool(config);

pool.connect()
  .then(() => {
    console.log('✅ SUCCESS: Connected to Azure SQL');
    return pool.request().query('SELECT 1 AS test');
  })
  .then(result => {
    console.log('✅ Query result:', result.recordset);
    return pool.close();
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    console.error('Code:', err.code);
  })
  .finally(() => {
    process.exit(0);
  });
