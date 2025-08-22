const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    acquireTimeout: 30000,
    timeout: 30000
});

// Test database connection
async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('✅ Database connection successful');
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

// Initialize database tables
async function initializeDatabase() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        // Create reports table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id VARCHAR(36) PRIMARY KEY,
                reporter_id VARCHAR(20) NOT NULL,
                reporter_username VARCHAR(32) NOT NULL,
                offender_display_name VARCHAR(100) NOT NULL,
                offender_discord_id VARCHAR(20),
                offender_email VARCHAR(255),
                description TEXT,
                links TEXT,
                screenshot_paths TEXT,
                reporter_ip VARCHAR(45),
                is_vpn BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending'
            )
        `);

        // Create admin_actions table for logging
        await conn.query(`
            CREATE TABLE IF NOT EXISTS admin_actions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id VARCHAR(20) NOT NULL,
                admin_username VARCHAR(32) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(36),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_timeouts table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_timeouts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                moderator_id VARCHAR(20) NOT NULL,
                duration_minutes INT NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    pool,
    testConnection,
    initializeDatabase
};
