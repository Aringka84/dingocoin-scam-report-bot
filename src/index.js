const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { testConnection, initializeDatabase } = require('./config/database');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Initialize commands collection
client.commands = new Collection();

// Load commands
const loadCommands = () => {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
        return;
    }

    const commandFolders = fs.readdirSync(commandsPath);
    
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`);
            }
        }
    }
};

// Load events
const loadEvents = () => {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`✅ Loaded event: ${event.name}`);
    }
};

// Initialize bot
const initializeBot = async () => {
    console.log('🚀 Starting Dingocoin Scam Report Bot...');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ Cannot start bot without database connection');
        process.exit(1);
    }
    
    // Initialize database tables
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.error('❌ Failed to initialize database tables');
        process.exit(1);
    }
    
    // Load commands and events
    loadCommands();
    loadEvents();
    
    // Login to Discord
    try {
        await client.login(config.discord.token);
    } catch (error) {
        console.error('❌ Failed to login to Discord:', error.message);
        process.exit(1);
    }
};

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('👋 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

// Start the bot
initializeBot();
