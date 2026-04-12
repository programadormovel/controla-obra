const { Pool } = require('pg');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    await pool.query('SELECT 1');
    await pool.end();
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.end(JSON.stringify({ error: e.message }));
  }
};
