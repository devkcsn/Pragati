const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspectDatabase() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('Connected to database successfully!');
    
    // Get all tables in the database
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\nTables in the database:');
    tables.forEach((table) => {
      const tableName = Object.values(table)[0];
      console.log(`- ${tableName}`);
    });

    // For each table, get its structure
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      
      console.log(`\nStructure of table '${tableName}':`);
      columns.forEach((col) => {
        console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key}`);
      });
    }

    await connection.end();
  } catch (error) {
    console.error('Error inspecting database:', error);
  }
}

inspectDatabase();