const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateDatabase() {
    console.log("🚀 Starting database migration to Aiven...");
    
    // Create connection (using same credentials as server.js)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }, // Required for Aiven
        multipleStatements: true
    });

    try {
        console.log("✅ Successfully connected to Aiven database.");
        
        // Read the schema file
        const schemaPath = path.join(__dirname, 'database-schema.sql');
        let sql = fs.readFileSync(schemaPath, 'utf8');

        // Remove problematic CREATE DATABASE and USE statements 
        // because Aiven locks permissions to the default DB it provides you
        sql = sql.replace(/CREATE DATABASE IF NOT EXISTS [\w_]+;/gi, '');
        sql = sql.replace(/USE [\w_]+;/gi, '');

        console.log("📝 Importing tables...");
        
        // Execute the SQL file
        await connection.query(sql);

        console.log("🎉 SUCCESS! All tables have been created on your Aiven database.");
        console.log("You can now safely log in or register from your Vercel website!");

    } catch (error) {
        console.error("❌ Migration failed!");
        console.error(error);
    } finally {
        await connection.end();
    }
}

migrateDatabase();
