const { Pool } = require('pg');
require('dotenv').config();

const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
});

// Wrapper para mantener la misma API que mysql2
// mysql2 retorna [rows, fields], pg retorna { rows }
const query = async (sql, params) => {
    // Convierte ? placeholders (MySQL) a $1,$2 (PostgreSQL)
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await pool.query(pgSql, params);
    return [result.rows, result.fields];
};

module.exports = { query, pool };

