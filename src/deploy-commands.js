const { REST, Routes } = require('discord.js');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');

// Collect commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            loadCommands(itemPath);
        } else if (item.endsWith('.js')) {
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded command: ${command.data.name}`);
            }
        }
    }
}

async function deployCommands() {
    try {
        console.log('🚀 Starting deployment of application (/) commands...');
        
        if (!config.discord.token) {
            throw new Error('Discord token not found in environment variables');
        }
        
        if (!config.discord.clientId) {
            throw new Error('Client ID not found in environment variables');
        }
        
        // Load all commands
        loadCommands(commandsPath);
        
        console.log(`📝 Found ${commands.length} commands to deploy`);
        
        // Construct and prepare an instance of the REST module
        const rest = new REST().setToken(config.discord.token);
        
        // Deploy commands
        if (config.discord.guildId) {
            // Deploy to specific guild (for development)
            console.log(`🎯 Deploying to guild: ${config.discord.guildId}`);
            const data = await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
                { body: commands }
            );
            console.log(`✅ Successfully registered ${data.length} guild commands`);
        } else {
            // Deploy globally (for production)
            console.log('🌍 Deploying globally...');
            const data = await rest.put(
                Routes.applicationCommands(config.discord.clientId),
                { body: commands }
            );
            console.log(`✅ Successfully registered ${data.length} global commands`);
            console.log('⚠️  Note: Global commands may take up to 1 hour to update');
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
}

// Run deployment if called directly
if (require.main === module) {
    deployCommands();
}

module.exports = { deployCommands };
