const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasVerifiedRole } = require('../../utils/permissions');
const { validateFile, sanitizeInput, extractLinks, getUserIP, checkVPN, scanFile } = require('../../utils/security');
const { processImages, validateImage } = require('../../utils/imageProcessor');
const { pool } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report a scammer with evidence')
        .addStringOption(option =>
            option.setName('offender_name')
                .setDescription('Display name of the offender')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('offender_id')
                .setDescription('Discord ID of the offender (if known)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('email')
                .setDescription('Verified email of the offender (if known)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the scam incident')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option.setName('screenshot1')
                .setDescription('Screenshot evidence (required)')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('screenshot2')
                .setDescription('Additional screenshot evidence')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option.setName('screenshot3')
                .setDescription('Additional screenshot evidence')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Check if user has verified role
        if (!hasVerifiedRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need to have the verified role to submit reports.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get command options
            const offenderName = sanitizeInput(interaction.options.getString('offender_name'));
            const offenderId = sanitizeInput(interaction.options.getString('offender_id'));
            const offenderEmail = sanitizeInput(interaction.options.getString('email'));
            const description = sanitizeInput(interaction.options.getString('description'));

            // Collect attachments
            const attachments = [];
            for (let i = 1; i <= 3; i++) {
                const attachment = interaction.options.getAttachment(`screenshot${i}`);
                if (attachment) attachments.push(attachment);
            }

            if (attachments.length === 0) {
                return await interaction.editReply({
                    content: '❌ At least one screenshot is required for the report.'
                });
            }

            // Validate all attachments
            const validationResults = [];
            for (const attachment of attachments) {
                const fileValidation = validateFile(attachment);
                if (!fileValidation.valid) {
                    return await interaction.editReply({
                        content: `❌ ${attachment.name}: ${fileValidation.reason}`
                    });
                }

                const imageValidation = await validateImage(attachment);
                if (!imageValidation.valid) {
                    return await interaction.editReply({
                        content: `❌ ${attachment.name}: ${imageValidation.reason}`
                    });
                }

                validationResults.push(imageValidation);
            }

            // Generate report ID
            const reportId = uuidv4();

            // Get user IP and check VPN (placeholder implementation)
            const userIP = getUserIP(interaction);
            const vpnCheck = await checkVPN(userIP);

            // Process images
            await interaction.editReply({ content: '🔄 Processing images...' });
            const imageResults = await processImages(attachments, reportId);
            
            // Check for image processing failures
            const failedImages = imageResults.filter(result => !result.success);
            if (failedImages.length > 0) {
                return await interaction.editReply({
                    content: `❌ Failed to process images: ${failedImages.map(f => f.error).join(', ')}`
                });
            }

            // Scan images for malware
            await interaction.editReply({ content: '🔍 Scanning for malware...' });
            const malwareResults = [];
            for (const attachment of attachments) {
                const response = await fetch(attachment.url);
                const buffer = await response.arrayBuffer();
                const scanResult = await scanFile(Buffer.from(buffer), attachment.name);
                malwareResults.push(scanResult);
                
                if (!scanResult.isSafe) {
                    return await interaction.editReply({
                        content: `❌ Malware detected in ${attachment.name}. Report submission cancelled.`
                    });
                }
            }

            // Extract links from description
            const links = description ? extractLinks(description) : [];

            // Try to find Discord user by ID
            let foundUser = null;
            if (offenderId) {
                try {
                    foundUser = await interaction.client.users.fetch(offenderId);
                } catch (error) {
                    // User not found or invalid ID
                }
            }

            // Save to database
            let conn;
            try {
                conn = await pool.getConnection();
                
                await conn.query(`
                    INSERT INTO reports (
                        id, reporter_id, reporter_username, offender_display_name,
                        offender_discord_id, offender_email, description, links,
                        screenshot_paths, reporter_ip, is_vpn, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    reportId,
                    interaction.user.id,
                    interaction.user.username,
                    offenderName,
                    offenderId,
                    offenderEmail,
                    description,
                    JSON.stringify(links),
                    JSON.stringify(imageResults.map(img => img.path)),
                    userIP,
                    vpnCheck.isVPN
                ]);

                console.log(`✅ Report ${reportId} saved to database`);
            } catch (error) {
                console.error('Database error:', error);
                return await interaction.editReply({
                    content: '❌ Failed to save report to database. Please try again.'
                });
            } finally {
                if (conn) conn.release();
            }

            // Create confirmation embed
            const embed = new EmbedBuilder()
                .setTitle('🚨 Scam Report Submitted')
                .setColor(0xFF6B6B)
                .addFields(
                    { name: 'Report ID', value: `\`${reportId}\``, inline: true },
                    { name: 'Offender', value: offenderName, inline: true },
                    { name: 'Reporter', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Submitted', value: moment().format('YYYY-MM-DD HH:mm:ss UTC'), inline: true },
                    { name: 'Screenshots', value: `${attachments.length} file(s) processed`, inline: true },
                    { name: 'Status', value: '🔍 Under Review', inline: true }
                )
                .setFooter({ text: 'Your report has been submitted for review by moderators.' })
                .setTimestamp();

            if (description) {
                embed.addFields({ name: 'Description', value: description.substring(0, 1024) });
            }

            if (foundUser) {
                embed.addFields({ name: 'Found User', value: `${foundUser.tag} (${foundUser.id})` });
            }

            if (links.length > 0) {
                embed.addFields({ name: 'Links Found', value: links.slice(0, 5).join('\n') });
            }

            if (vpnCheck.isVPN) {
                embed.addFields({ name: '⚠️ VPN Detected', value: `Confidence: ${vpnCheck.confidence}%` });
            }

            // Create action buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`view_report_${reportId}`)
                        .setLabel('View Report')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👁️'),
                );

            await interaction.editReply({
                content: '✅ **Report submitted successfully!**',
                embeds: [embed],
                components: [row]
            });

            // Log to admin channel if configured
            const logChannelId = process.env.LOG_CHANNEL_ID;
            if (logChannelId) {
                try {
                    const logChannel = await interaction.client.channels.fetch(logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📋 New Scam Report')
                            .setColor(0xFFA500)
                            .addFields(
                                { name: 'Report ID', value: `\`${reportId}\``, inline: true },
                                { name: 'Reporter', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Offender', value: offenderName, inline: true }
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error('Failed to send log message:', error);
                }
            }

        } catch (error) {
            console.error('Report submission error:', error);
            await interaction.editReply({
                content: '❌ An unexpected error occurred while processing your report. Please try again.'
            });
        }
    }
};
