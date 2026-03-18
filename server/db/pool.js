const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('connect', () => console.log('✓ Database connected'));
pool.on('error', (err) => console.error('Database pool error:', err.message));

module.exports = pool;
