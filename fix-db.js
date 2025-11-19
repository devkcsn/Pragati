const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database successfully!');
    
    // Drop existing tables if they exist
    await connection.query('DROP TABLE IF EXISTS students');
    await connection.query('DROP TABLE IF EXISTS coordinators');
    console.log('Dropped existing tables');
    
    // Create students table with correct column names
    await connection.query(`
      CREATE TABLE students (
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(255) PRIMARY KEY,
        password VARCHAR(255) NOT NULL
      )
    `);
    console.log('Created students table');
    
    // Create coordinators table with correct column names
    await connection.query(`
      CREATE TABLE coordinators (
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(255) PRIMARY KEY,
        password VARCHAR(255) NOT NULL
      )
    `);
    console.log('Created coordinators table');

    // Verify the tables were created correctly
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\nTables in the database:');
    tables.forEach((table) => {
      const tableName = Object.values(table)[0];
      console.log(`- ${tableName}`);
    });

    // Show the structure of each table
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      
      console.log(`\nStructure of table '${tableName}':`);
      columns.forEach((col) => {
        console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key}`);
      });
    }

    await connection.end();
    console.log('\nDatabase tables fixed successfully!');
  } catch (error) {
    console.error('Error fixing database:', error);
  }
}

fixDatabase();