// Test database connection
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
    console.log('\n🔍 Testing Database Connection...\n');
    console.log('Configuration:');
    console.log('  Host:', process.env.DB_HOST || 'NOT SET');
    console.log('  User:', process.env.DB_USER || 'NOT SET');
    console.log('  Database:', process.env.DB_NAME || 'NOT SET');
    console.log('  Port:', process.env.DB_PORT || '3306');
    console.log('  Password:', process.env.DB_PASSWORD ? '****' + process.env.DB_PASSWORD.slice(-4) : 'NOT SET');
    console.log('\n---\n');

    try {
        // Create connection
        console.log('⏳ Connecting to database...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            connectTimeout: 10000
        });
        
        console.log('✅ Database connected successfully!\n');
        
        // Test query
        console.log('⏳ Running test query...');
        const [rows] = await connection.execute('SELECT 1 + 1 AS result, NOW() as server_time');
        console.log('✅ Test query successful!');
        console.log('   Result:', rows[0].result);
        console.log('   Server Time:', rows[0].server_time);
        console.log('');
        
        // Check database version
        const [version] = await connection.execute('SELECT VERSION() as version');
        console.log('📊 MySQL Version:', version[0].version);
        console.log('');
        
        // List tables
        console.log('⏳ Checking tables...');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`✅ Found ${tables.length} table(s) in database:`);
        
        if (tables.length > 0) {
            const tableKey = Object.keys(tables[0])[0];
            tables.forEach((table, index) => {
                console.log(`   ${index + 1}. ${table[tableKey]}`);
            });
        } else {
            console.log('   ⚠️  No tables found! Run database-schema.sql to create tables.');
        }
        console.log('');
        
        // Check required tables
        const requiredTables = ['students', 'coordinators', 'quizzes', 'questions', 'quiz_attempts', 'monitoring_sessions'];
        const existingTables = tables.map(t => t[Object.keys(t)[0]]);
        
        console.log('🔍 Checking required tables...');
        let missingTables = [];
        requiredTables.forEach(table => {
            if (existingTables.includes(table)) {
                console.log(`   ✅ ${table}`);
            } else {
                console.log(`   ❌ ${table} - MISSING`);
                missingTables.push(table);
            }
        });
        console.log('');
        
        if (missingTables.length > 0) {
            console.log('⚠️  WARNING: Missing tables detected!');
            console.log('   Import database-schema.sql to create missing tables:');
            console.log('   mysql -h HOST -u USER -p DATABASE < database-schema.sql');
            console.log('');
        } else {
            console.log('🎉 All required tables are present!');
            console.log('');
        }
        
        await connection.end();
        console.log('✅ Database test completed successfully!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Database connection failed!\n');
        console.error('Error:', error.message);
        console.error('');
        console.error('Common issues:');
        console.error('  1. Check .env file exists with correct credentials');
        console.error('  2. Verify database server is running and accessible');
        console.error('  3. Ensure firewall allows connection to database port');
        console.error('  4. Check username/password are correct');
        console.error('  5. Verify database name exists');
        console.error('');
        process.exit(1);
    }
}

// Run test
testDatabaseConnection();
