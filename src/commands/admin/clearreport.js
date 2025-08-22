const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');
const { deleteImages } = require('../../utils/imageProcessor');
const fs = require('fs').promises;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearreport')
        .setDescription('Clear a specific report or entire database (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('single')
                .setDescription('Clear a single report by ID')
                .addStringOption(option =>
                    option.setName('report_id')
                        .setDescription('Report ID to clear')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('database')
                .setDescription('Clear entire reports database (DANGEROUS)')
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

        if (subcommand === 'single') {
            await this.handleSingleReport(interaction);
        } else if (subcommand === 'database') {
            await this.handleDatabaseClear(interaction);
        }
    },

    async handleSingleReport(interaction) {
        const reportId = interaction.options.getString('report_id');

        await interaction.deferReply({ ephemeral: true });

        let conn;
        try {
            conn = await pool.getConnection();
            
            // Check if report exists
            const reports = await conn.query('SELECT * FROM reports WHERE id = ?', [reportId]);
            
            if (reports.length === 0) {
                return await interaction.editReply({
                    content: '❌ Report not found with that ID.'
                });
            }

            const report = reports[0];

            // Create confirmation embed
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Confirm Report Deletion')
                .setColor(0xFF6B6B)
                .addFields(
                    { name: 'Report ID', value: `\`${report.id}\``, inline: true },
                    { name: 'Offender', value: report.offender_display_name, inline: true },
                    { name: 'Reporter', value: `<@${report.reporter_id}>`, inline: true },
                    { name: 'Status', value: report.status, inline: true },
                    { name: 'Created', value: new Date(report.created_at).toLocaleString(), inline: true }
                )
                .setDescription('**This action cannot be undone!**\nThis will permanently delete the report and all associated files.')
                .setTimestamp();

            // Create confirmation buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_delete_${reportId}`)
                        .setLabel('Confirm Delete')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️'),
                    new ButtonBuilder()
                        .setCustomId(`cancel_delete_${reportId}`)
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Wait for button interaction
            try {
                const buttonInteraction = await response.awaitMessageComponent({ 
                    time: 30000 // 30 seconds
                });

                if (buttonInteraction.customId === `confirm_delete_${reportId}`) {
                    await buttonInteraction.deferUpdate();
                    
                    // Delete associated files
                    if (report.screenshot_paths) {
                        try {
                            const imagePaths = JSON.parse(report.screenshot_paths);
                            await deleteImages(imagePaths);
                        } catch (error) {
                            console.error('Error deleting images:', error);
                        }
                    }

                    // Delete from database
                    await conn.query('DELETE FROM reports WHERE id = ?', [reportId]);

                    // Log the action
                    await conn.query(`
                        INSERT INTO admin_actions (admin_id, admin_username, action_type, target_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, NOW())
                    `, [
                        interaction.user.id,
                        interaction.user.username,
                        'clear_report',
                        reportId,
                        `Deleted report for offender: ${report.offender_display_name}`
                    ]);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Report Deleted')
                        .setColor(0x00FF00)
                        .setDescription(`Report \`${reportId}\` has been permanently deleted.`)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                } else {
                    await buttonInteraction.deferUpdate();
                    
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ Deletion Cancelled')
                        .setColor(0x95A5A6)
                        .setDescription('Report deletion has been cancelled.')
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }

            } catch (error) {
                // Timeout
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Confirmation Timeout')
                    .setColor(0x95A5A6)
                    .setDescription('Confirmation timed out. Report was not deleted.')
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            }

        } catch (error) {
            console.error('Clear report error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing the report deletion.'
            });
        } finally {
            if (conn) conn.release();
        }
    },

    async handleDatabaseClear(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Create warning embed
        const embed = new EmbedBuilder()
            .setTitle('🚨 DANGER: Database Clear Confirmation')
            .setColor(0x8B0000)
            .setDescription('**⚠️ THIS WILL DELETE ALL REPORTS AND ASSOCIATED FILES!**\n\n' +
                          'This action will:\n' +
                          '• Delete all scam reports\n' +
                          '• Delete all screenshot files\n' +
                          '• Clear all report history\n' +
                          '• **CANNOT BE UNDONE!**\n\n' +
                          '**Type "DELETE ALL REPORTS" to confirm this action.**')
            .setTimestamp();

        // Create confirmation buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_database_clear')
                    .setLabel('I UNDERSTAND - DELETE ALL')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('💥'),
                new ButtonBuilder()
                    .setCustomId('cancel_database_clear')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        const response = await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

        // Wait for button interaction
        try {
            const buttonInteraction = await response.awaitMessageComponent({ 
                time: 60000 // 60 seconds for this critical action
            });

            if (buttonInteraction.customId === 'confirm_database_clear') {
                await buttonInteraction.deferUpdate();
                
                let conn;
                try {
                    conn = await pool.getConnection();
                    
                    // Get all reports to delete files
                    const reports = await conn.query('SELECT screenshot_paths FROM reports WHERE screenshot_paths IS NOT NULL');
                    
                    // Delete all associated files
                    for (const report of reports) {
                        if (report.screenshot_paths) {
                            try {
                                const imagePaths = JSON.parse(report.screenshot_paths);
                                await deleteImages(imagePaths);
                            } catch (error) {
                                console.error('Error deleting images for report:', error);
                            }
                        }
                    }

                    // Delete all uploads directory contents
                    try {
                        const uploadsDir = require('path').join(__dirname, '../../../uploads');
                        const files = await fs.readdir(uploadsDir);
                        for (const file of files) {
                            await fs.unlink(require('path').join(uploadsDir, file));
                        }
                    } catch (error) {
                        console.error('Error clearing uploads directory:', error);
                    }

                    // Clear database tables
                    await conn.query('DELETE FROM reports');
                    await conn.query('DELETE FROM user_timeouts');
                    // Keep admin_actions for audit trail

                    // Log the action
                    await conn.query(`
                        INSERT INTO admin_actions (admin_id, admin_username, action_type, target_id, details, created_at)
                        VALUES (?, ?, ?, ?, ?, NOW())
                    `, [
                        interaction.user.id,
                        interaction.user.username,
                        'clear_database',
                        null,
                        'Cleared entire reports database'
                    ]);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('💥 Database Cleared')
                        .setColor(0x8B0000)
                        .setDescription('**All reports and files have been permanently deleted.**\n\n' +
                                      'The database has been reset to a clean state.')
                        .addFields(
                            { name: 'Action Performed By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Timestamp', value: new Date().toISOString(), inline: false }
                        )
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                } catch (error) {
                    console.error('Database clear error:', error);
                    await interaction.editReply({
                        content: '❌ An error occurred while clearing the database.',
                        components: []
                    });
                } finally {
                    if (conn) conn.release();
                }

            } else {
                await buttonInteraction.deferUpdate();
                
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Database Clear Cancelled')
                    .setColor(0x00FF00)
                    .setDescription('Database clear operation has been cancelled. All data remains intact.')
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [cancelEmbed],
                    components: []
                });
            }

        } catch (error) {
            // Timeout
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ Confirmation Timeout')
                .setColor(0x95A5A6)
                .setDescription('Confirmation timed out. Database was not cleared.')
                .setTimestamp();

            await interaction.editReply({
                embeds: [timeoutEmbed],
                components: []
            });
        }
    }
};
