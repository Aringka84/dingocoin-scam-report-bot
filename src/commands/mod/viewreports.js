const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { hasGuardianRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewreports')
        .setDescription('View scam reports (Moderator only)')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Filter by report status')
                .setRequired(false)
                .addChoices(
                    { name: 'Pending', value: 'pending' },
                    { name: 'Reviewed', value: 'reviewed' },
                    { name: 'Resolved', value: 'resolved' },
                    { name: 'Dismissed', value: 'dismissed' }
                )
        )
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search by offender name or report ID')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of reports to show (default: 10, max: 25)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)
        ),

    async execute(interaction) {
        // Check permissions
        if (!hasGuardianRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Guardian role or higher to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const status = interaction.options.getString('status');
            const search = interaction.options.getString('search');
            const limit = interaction.options.getInteger('limit') || 10;

            let conn;
            try {
                conn = await pool.getConnection();
                
                // Build query
                let query = 'SELECT * FROM reports';
                let params = [];
                let conditions = [];

                if (status) {
                    conditions.push('status = ?');
                    params.push(status);
                }

                if (search) {
                    conditions.push('(offender_display_name LIKE ? OR id LIKE ?)');
                    params.push(`%${search}%`, `%${search}%`);
                }

                if (conditions.length > 0) {
                    query += ' WHERE ' + conditions.join(' AND ');
                }

                query += ' ORDER BY created_at DESC LIMIT ?';
                params.push(limit);

                const reports = await conn.query(query, params);

                if (reports.length === 0) {
                    return await interaction.editReply({
                        content: '📭 No reports found matching your criteria.'
                    });
                }

                // Create embed with reports list
                const embed = new EmbedBuilder()
                    .setTitle('🚨 Scam Reports')
                    .setColor(0x3498DB)
                    .setDescription(`Showing ${reports.length} report(s)`)
                    .setTimestamp();

                // Add fields for each report
                for (let i = 0; i < Math.min(reports.length, 10); i++) {
                    const report = reports[i];
                    const statusEmoji = {
                        'pending': '🔍',
                        'reviewed': '👀',
                        'resolved': '✅',
                        'dismissed': '❌'
                    };

                    embed.addFields({
                        name: `${statusEmoji[report.status]} Report ${report.id.substring(0, 8)}`,
                        value: `**Offender:** ${report.offender_display_name}\n` +
                               `**Reporter:** <@${report.reporter_id}>\n` +
                               `**Status:** ${report.status}\n` +
                               `**Date:** ${moment(report.created_at).format('MMM DD, YYYY HH:mm')}`,
                        inline: true
                    });
                }

                // Create buttons for actions
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('refresh_reports')
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔄'),
                        new ButtonBuilder()
                            .setCustomId('export_reports')
                            .setLabel('Export CSV')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📊')
                    );

                await interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });

            } catch (error) {
                console.error('Database error:', error);
                await interaction.editReply({
                    content: '❌ Failed to retrieve reports from database.'
                });
            } finally {
                if (conn) conn.release();
            }

        } catch (error) {
            console.error('View reports error:', error);
            await interaction.editReply({
                content: '❌ An unexpected error occurred while retrieving reports.'
            });
        }
    }
};
