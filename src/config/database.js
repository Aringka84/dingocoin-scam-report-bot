const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 15,
    acquireTimeout: 60000,
    timeout: 60000,
    idleTimeout: 600000,
    minimumIdle: 2,
    // MariaDB 11.4+ optimizations
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    supportBigNumbers: true,
    bigNumberStrings: false,
    compress: true,
    // Connection options for better performance
    connectAttributes: {
        program_name: 'scam-report-bot',
        _server_host: process.env.DB_HOST || 'localhost'
    }
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
        
        // Create reports table with MariaDB 11.4+ optimizations
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id VARCHAR(36) PRIMARY KEY,
                reporter_id VARCHAR(20) NOT NULL,
                reporter_username VARCHAR(32) NOT NULL,
                offender_display_name VARCHAR(100) NOT NULL,
                offender_discord_id VARCHAR(20),
                offender_email VARCHAR(255),
                description TEXT,
                links JSON,
                screenshot_paths JSON,
                reporter_ip VARCHAR(45),
                is_vpn BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
                
                INDEX idx_reporter_id (reporter_id),
                INDEX idx_offender_discord_id (offender_discord_id),
                INDEX idx_status_created (status, created_at),
                INDEX idx_created_at (created_at DESC),
                FULLTEXT INDEX idx_description (description),
                FULLTEXT INDEX idx_offender_name (offender_display_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_admin_id (admin_id),
                INDEX idx_action_type (action_type),
                INDEX idx_created_at (created_at DESC),
                INDEX idx_target_id (target_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create user_timeouts table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_timeouts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(20) NOT NULL,
                moderator_id VARCHAR(20) NOT NULL,
                duration_minutes INT NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_user_id (user_id),
                INDEX idx_moderator_id (moderator_id),
                INDEX idx_created_at (created_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
