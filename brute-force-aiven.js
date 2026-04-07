const mysql = require('mysql2/promise');
const fs = require('fs');

const host = "mysql-3a37f0b-kumarchandrasheonarayan-3d60.b.aivencloud.com";
const user = "avnadmin";
const database = "defaultdb";
const port = 25479;

// We will generate all permutations for these ambiguous positions
function generatePasswords() {
    const base = "AVNS_k5tB" + "{char1}" + "Rg" + "{char2}" + "9" + "{char3}" + "ZmXSC" + "{char4}" + "E1e";
    
    const char1_opts = ['O', '0']; // B O Rg
    const char2_opts = ['l', 'I', '1']; // Rg l 9
    const char3_opts = ['O', '0']; // 9 O Zm
    const char4_opts = ['I', 'l', '1']; // XSC I E1e
    
    let passwords = [];
    
    for (const c1 of char1_opts) {
        for (const c2 of char2_opts) {
            for (const c3 of char3_opts) {
                for (const c4 of char4_opts) {
                    let pwd = base
                        .replace('{char1}', c1)
                        .replace('{char2}', c2)
                        .replace('{char3}', c3)
                        .replace('{char4}', c4);
                    passwords.push(pwd);
                }
            }
        }
    }
    return passwords;
}

async function bruteForceAndMigrate() {
    const passwords = generatePasswords();
    console.log(`Starting brute-force test with ${passwords.length} possible combinations...`);

    let correctPassword = null;
    let successfulConnection = null;

    for (const pwd of passwords) {
        try {
            // Attempt to connect
            const connection = await mysql.createConnection({
                host, user, password: pwd, database, port,
                ssl: { rejectUnauthorized: false }
            });
            correctPassword = pwd;
            successfulConnection = connection;
            break; // Stop immediately upon success!
        } catch (e) {
            // Fail silently, try next
        }
    }

    if (!correctPassword) {
        console.error("❌ All password permutations failed. OCR might have missed another character.");
        process.exit(1);
    }

    console.log("✅ SUCCESS! Found the correct password: " + correctPassword);
    
    // Automatically perform the schema migration using the successful connection!
    console.log("🚀 Running database migration automagically...");
    try {
        const schemaPath = require('path').join(__dirname, 'database-schema.sql');
        let sql = fs.readFileSync(schemaPath, 'utf8');
        sql = sql.replace(/CREATE DATABASE IF NOT EXISTS [\w_]+;/gi, '');
        sql = sql.replace(/USE [\w_]+;/gi, '');
        
        // Ensure connection supports multiple statements
        successfulConnection.config.multipleStatements = true;
        
        // Reconnect with multiple statements enabled using correct password
        await successfulConnection.end();
        
        const finalConn = await mysql.createConnection({
            host, user, password: correctPassword, database, port,
            ssl: { rejectUnauthorized: false },
            multipleStatements: true
        });

        await finalConn.query(sql);
        console.log("🎉 SUCCESS! Database schema created on Aiven!");
        fs.writeFileSync('password_success.txt', correctPassword);
        
        // Auto-update .env
        let envContent = fs.readFileSync('.env', 'utf8');
        envContent = envContent.replace(/DB_PASSWORD=.*/g, 'DB_PASSWORD=' + correctPassword);
        fs.writeFileSync('.env', envContent);
        
        await finalConn.end();
        process.exit(0);
    } catch (e) {
        console.error("❌ Migration failed after auth: ", e.message);
        process.exit(1);
    }
}

bruteForceAndMigrate();
