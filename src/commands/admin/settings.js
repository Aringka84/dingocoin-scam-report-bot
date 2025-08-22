const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('View or modify bot settings (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current bot settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('roles')
                .setDescription('View role configuration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('database')
                .setDescription('View database statistics')
        ),

    async execute(interaction) {
        // Check permissions
        if (!hasAdminRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Admin role or higher to use this command.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply({ ephemeral: true });

        try {
            if (subcommand === 'view') {
                await this.handleViewSettings(interaction);
            } else if (subcommand === 'roles') {
                await this.handleViewRoles(interaction);
            } else if (subcommand === 'database') {
                await this.handleDatabaseStats(interaction);
            }
        } catch (error) {
            console.error('Settings command error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing the settings command.'
            });
        }
    },

    async handleViewSettings(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Bot Settings')
            .setColor(0x3498DB)
            .addFields(
                { 
                    name: '🔐 Security', 
                    value: `**Max File Size:** ${Math.round(config.security.maxFileSize / 1024 / 1024)}MB\n` +
                           `**Allowed Types:** ${config.security.allowedFileTypes.join(', ')}\n` +
                           `**VPN Detection:** ${config.features.vpnDetection ? '✅ Enabled' : '❌ Disabled'}\n` +
                           `**VirusTotal:** ${config.security.virusTotalApiKey ? '✅ Configured' : '❌ Not configured'}`,
                    inline: false 
                },
                { 
                    name: '🗄️ Database', 
                    value: `**Host:** ${config.database.host}:${config.database.port}\n` +
                           `**Database:** ${config.database.name}\n` +
                           `**User:** ${config.database.user}`,
                    inline: false 
                },
                { 
                    name: '📊 Logging', 
                    value: `**Log Channel:** ${config.features.logChannelId ? `<#${config.features.logChannelId}>` : 'Not configured'}`,
                    inline: false 
                }
            )
            .setFooter({ text: 'Bot configuration overview' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleViewRoles(interaction) {
        const guild = interaction.guild;
        
        // Get role objects
        const verifiedRole = config.roles.verified ? await guild.roles.fetch(config.roles.verified).catch(() => null) : null;
        const guardianRole = config.roles.guardian ? await guild.roles.fetch(config.roles.guardian).catch(() => null) : null;
        const adminRole = config.roles.admin ? await guild.roles.fetch(config.roles.admin).catch(() => null) : null;

        const embed = new EmbedBuilder()
            .setTitle('👥 Role Configuration')
            .setColor(0x9B59B6)
            .addFields(
                { 
                    name: '✅ Verified Role', 
                    value: verifiedRole ? `${verifiedRole} (${verifiedRole.members.size} members)` : '❌ Not configured',
                    inline: true 
                },
                { 
                    name: '🛡️ Guardian Role', 
                    value: guardianRole ? `${guardianRole} (${guardianRole.members.size} members)` : '❌ Not configured',
                    inline: true 
                },
                { 
                    name: '⭐ Admin Role', 
                    value: adminRole ? `${adminRole} (${adminRole.members.size} members)` : '❌ Not configured',
                    inline: true 
                }
            )
            .setFooter({ text: 'Role permissions and member counts' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleDatabaseStats(interaction) {
        const { pool } = require('../../config/database');
        
        let conn;
        try {
            conn = await pool.getConnection();
            
            // Get report statistics
            const reportStats = await conn.query(`
                SELECT 
                    COUNT(*) as total_reports,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
                    COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_reports,
                    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
                    COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_reports,
                    COUNT(CASE WHEN is_vpn = true THEN 1 END) as vpn_reports
                FROM reports
            `);

            const adminActionStats = await conn.query(`
                SELECT 
                    COUNT(*) as total_actions,
                    COUNT(CASE WHEN action_type = 'timeout' THEN 1 END) as timeouts,
                    COUNT(CASE WHEN action_type = 'kick' THEN 1 END) as kicks,
                    COUNT(CASE WHEN action_type = 'ban' THEN 1 END) as bans
                FROM admin_actions
            `);

            const stats = reportStats[0];
            const actionStats = adminActionStats[0];

            const embed = new EmbedBuilder()
                .setTitle('📊 Database Statistics')
                .setColor(0xE67E22)
                .addFields(
                    { 
                        name: '📋 Reports', 
                        value: `**Total:** ${stats.total_reports}\n` +
                               `**Pending:** ${stats.pending_reports}\n` +
                               `**Reviewed:** ${stats.reviewed_reports}\n` +
                               `**Resolved:** ${stats.resolved_reports}\n` +
                               `**Dismissed:** ${stats.dismissed_reports}\n` +
                               `**VPN Reports:** ${stats.vpn_reports}`,
                        inline: true 
                    },
                    { 
                        name: '🔨 Moderation Actions', 
                        value: `**Total Actions:** ${actionStats.total_actions}\n` +
                               `**Timeouts:** ${actionStats.timeouts}\n` +
                               `**Kicks:** ${actionStats.kicks}\n` +
                               `**Bans:** ${actionStats.bans}`,
                        inline: true 
                    }
                )
                .setFooter({ text: 'Database statistics and activity overview' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Database stats error:', error);
            await interaction.editReply({
                content: '❌ Failed to retrieve database statistics.'
            });
        } finally {
            if (conn) conn.release();
        }
    }
};
