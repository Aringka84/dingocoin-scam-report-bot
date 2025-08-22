require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID,
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME,
    },
    security: {
        virusTotalApiKey: process.env.VIRUS_TOTAL_API_KEY,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 8388608, // 8MB
        allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    },
    roles: {
        verified: process.env.VERIFIED_ROLE_ID,
        guardian: process.env.GUARDIAN_ROLE_ID,
        admin: process.env.ADMIN_ROLE_ID,
    },
    features: {
        vpnDetection: process.env.VPN_DETECTION_ENABLED === 'true',
        logChannelId: process.env.LOG_CHANNEL_ID,
    }
};
