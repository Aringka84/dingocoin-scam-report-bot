const { testConnection, initializeDatabase } = require('../config/database');
const config = require('../config/config');

async function setupDatabase() {
    console.log('🚀 Setting up database...');
    
    // Test connection
    console.log('📡 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
        console.error('❌ Database connection failed. Please check your configuration.');
        process.exit(1);
    }
    
    // Initialize tables
    console.log('🔧 Initializing database tables...');
    const initialized = await initializeDatabase();
    
    if (!initialized) {
        console.error('❌ Database initialization failed.');
        process.exit(1);
    }
    
    console.log('✅ Database setup complete!');
    console.log('');
    console.log('Database configuration:');
    console.log(`  Host: ${config.database.host}:${config.database.port}`);
    console.log(`  Database: ${config.database.name}`);
    console.log(`  User: ${config.database.user}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Configure your Discord bot token in .env');
    console.log('2. Set up role IDs in .env');
    console.log('3. Run "npm start" to start the bot');
    
    process.exit(0);
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };
