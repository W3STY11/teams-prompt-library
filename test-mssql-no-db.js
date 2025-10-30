const sql = require('mssql');

const config = {
  server: 'promptlib-sql-111.database.windows.net',
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

console.log('Testing without database specified...');
const pool = new sql.ConnectionPool(config);

pool.connect()
  .then(() => {
    console.log('✅ Connected!');
    return pool.request().query('SELECT DB_NAME() AS currentDB');
  })
  .then(result => {
    console.log('✅ Query result:', result.recordset);
    console.log('Now switching to promptlibrary database...');
    return pool.request().query('USE promptlibrary; SELECT DB_NAME() AS currentDB');
  })
  .then(result => {
    console.log('✅ After USE:', result.recordset);
    return pool.close();
  })
  .catch(err => {
    console.error('❌ Failed:', err.message);
    console.error('Code:', err.code);
  })
  .finally(() => {
    process.exit(0);
  });
