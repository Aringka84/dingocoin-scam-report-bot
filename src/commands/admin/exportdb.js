const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exportdb')
        .setDescription('Export database to CSV format (Admin only)')
        .addStringOption(option =>
            option.setName('table')
                .setDescription('Which table to export')
                .setRequired(false)
                .addChoices(
                    { name: 'Reports', value: 'reports' },
                    { name: 'Admin Actions', value: 'admin_actions' },
                    { name: 'User Timeouts', value: 'user_timeouts' },
                    { name: 'All Tables', value: 'all' }
                )
        ),

    async execute(interaction) {
        // Check permissions
        if (!hasAdminRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Admin role or higher to use this command.',
                ephemeral: true
            });
        }

        const tableOption = interaction.options.getString('table') || 'reports';

        await interaction.deferReply({ ephemeral: true });

        try {
            const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
            const exportDir = path.join(__dirname, '../../../exports');
            
            // Create exports directory if it doesn't exist
            await fs.mkdir(exportDir, { recursive: true });

            let files = [];

            if (tableOption === 'all') {
                files = await this.exportAllTables(exportDir, timestamp);
            } else {
                const file = await this.exportTable(tableOption, exportDir, timestamp);
                if (file) files.push(file);
            }

            if (files.length === 0) {
                return await interaction.editReply({
                    content: '❌ No data found to export.'
                });
            }

            // Create attachments
            const attachments = [];
            for (const file of files) {
                const attachment = new AttachmentBuilder(file.path, { name: file.name });
                attachments.push(attachment);
            }

            // Create summary embed
            const embed = new EmbedBuilder()
                .setTitle('📊 Database Export Complete')
                .setColor(0x00FF00)
                .setDescription(`Successfully exported ${files.length} file(s)`)
                .addFields(
                    { name: 'Exported by', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Export time', value: moment().format('YYYY-MM-DD HH:mm:ss UTC'), inline: true },
                    { name: 'Files', value: files.map(f => `• ${f.name} (${f.records} records)`).join('\n'), inline: false }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: attachments
            });

            // Clean up files after sending
            setTimeout(async () => {
                for (const file of files) {
                    try {
                        await fs.unlink(file.path);
                    } catch (error) {
                        console.error(`Failed to clean up file ${file.path}:`, error);
                    }
                }
            }, 60000); // Clean up after 1 minute

            // Log the export action
            let conn;
            try {
                conn = await pool.getConnection();
                
                await conn.query(`
                    INSERT INTO admin_actions (admin_id, admin_username, action_type, target_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    interaction.user.id,
                    interaction.user.username,
                    'export_database',
                    null,
                    `Exported ${tableOption} table(s) - ${files.length} file(s), ${files.reduce((sum, f) => sum + f.records, 0)} total records`
                ]);

            } catch (error) {
                console.error('Database logging error:', error);
            } finally {
                if (conn) conn.release();
            }

        } catch (error) {
            console.error('Database export error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while exporting the database.'
            });
        }
    },

    async exportAllTables(exportDir, timestamp) {
        const files = [];
        
        const tables = ['reports', 'admin_actions', 'user_timeouts'];
        
        for (const table of tables) {
            const file = await this.exportTable(table, exportDir, timestamp);
            if (file) files.push(file);
        }
        
        return files;
    },

    async exportTable(tableName, exportDir, timestamp) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            // Get data from table
            const data = await conn.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
            
            if (data.length === 0) {
                console.log(`No data found in ${tableName} table`);
                return null;
            }

            // Define CSV headers based on table
            let headers;
            let filename;

            switch (tableName) {
                case 'reports':
                    headers = [
                        { id: 'id', title: 'Report ID' },
                        { id: 'reporter_id', title: 'Reporter ID' },
                        { id: 'reporter_username', title: 'Reporter Username' },
                        { id: 'offender_display_name', title: 'Offender Name' },
                        { id: 'offender_discord_id', title: 'Offender Discord ID' },
                        { id: 'offender_email', title: 'Offender Email' },
                        { id: 'description', title: 'Description' },
                        { id: 'links', title: 'Links' },
                        { id: 'reporter_ip', title: 'Reporter IP' },
                        { id: 'is_vpn', title: 'VPN Detected' },
                        { id: 'status', title: 'Status' },
                        { id: 'created_at', title: 'Created At' },
                        { id: 'updated_at', title: 'Updated At' }
                    ];
                    filename = `reports_export_${timestamp}.csv`;
                    break;
                    
                case 'admin_actions':
                    headers = [
                        { id: 'id', title: 'Action ID' },
                        { id: 'admin_id', title: 'Admin ID' },
                        { id: 'admin_username', title: 'Admin Username' },
                        { id: 'action_type', title: 'Action Type' },
                        { id: 'target_id', title: 'Target ID' },
                        { id: 'details', title: 'Details' },
                        { id: 'created_at', title: 'Created At' }
                    ];
                    filename = `admin_actions_export_${timestamp}.csv`;
                    break;
                    
                case 'user_timeouts':
                    headers = [
                        { id: 'id', title: 'Timeout ID' },
                        { id: 'user_id', title: 'User ID' },
                        { id: 'moderator_id', title: 'Moderator ID' },
                        { id: 'duration_minutes', title: 'Duration (Minutes)' },
                        { id: 'reason', title: 'Reason' },
                        { id: 'created_at', title: 'Created At' }
                    ];
                    filename = `user_timeouts_export_${timestamp}.csv`;
                    break;
                    
                default:
                    throw new Error(`Unknown table: ${tableName}`);
            }

            const filePath = path.join(exportDir, filename);

            // Create CSV writer
            const csvWriter = createCsvWriter({
                path: filePath,
                header: headers
            });

            // Process data for CSV
            const processedData = data.map(row => {
                const processedRow = { ...row };
                
                // Format dates
                if (processedRow.created_at) {
                    processedRow.created_at = moment(processedRow.created_at).format('YYYY-MM-DD HH:mm:ss UTC');
                }
                if (processedRow.updated_at) {
                    processedRow.updated_at = moment(processedRow.updated_at).format('YYYY-MM-DD HH:mm:ss UTC');
                }
                
                // Format boolean values
                if (typeof processedRow.is_vpn === 'boolean') {
                    processedRow.is_vpn = processedRow.is_vpn ? 'Yes' : 'No';
                }
                
                // Handle JSON fields
                if (processedRow.links && typeof processedRow.links === 'string') {
                    try {
                        const links = JSON.parse(processedRow.links);
                        processedRow.links = Array.isArray(links) ? links.join('; ') : processedRow.links;
                    } catch (e) {
                        // Keep original value if parsing fails
                    }
                }
                
                return processedRow;
            });

            // Write CSV file
            await csvWriter.writeRecords(processedData);

            console.log(`✅ Exported ${data.length} records from ${tableName} to ${filename}`);

            return {
                path: filePath,
                name: filename,
                records: data.length,
                table: tableName
            };

        } catch (error) {
            console.error(`Error exporting ${tableName}:`, error);
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }
};
