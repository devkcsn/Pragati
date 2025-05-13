/**
 * MySQL Database Connection Pool
 * 
 * Creates a connection pool for MySQL database access using environment variables.
 * Connection pooling improves performance by reusing connections.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,        // Database host from environment variables
    user: process.env.DB_USER,        // Database username
    password: process.env.DB_PASSWORD, // Database password
    database: process.env.DB_NAME,    // Database name
    port: process.env.DB_PORT || 3306, // Database port (default: 3306)
});

module.exports = pool; 