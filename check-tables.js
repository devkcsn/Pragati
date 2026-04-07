const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function run() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: 'avnadmin',
            password: process.env.DB_PASSWORD,
            database: 'defaultdb',
            port: parseInt(process.env.DB_PORT) || 25479,
            ssl: { rejectUnauthorized: false }
        });
        const [rows] = await pool.query('SHOW TABLES');
        fs.writeFileSync('aiven_tables.txt', JSON.stringify(rows));
        console.log("Wrote tables.");
        pool.end();
    } catch (e) {
        fs.writeFileSync('aiven_tables_error.txt', e.message);
    }
}
run();
