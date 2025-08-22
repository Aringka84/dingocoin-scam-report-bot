const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasGuardianRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user (Moderator only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080) // 7 days max
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Check permissions
        if (!hasGuardianRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Guardian role or higher to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember) {
                return await interaction.editReply({
                    content: '❌ User not found in this server.'
                });
            }

            // Check if user is trying to timeout themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: '❌ You cannot timeout yourself.'
                });
            }

            // Check if target user has higher or equal role
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.editReply({
                    content: '❌ You cannot timeout a user with equal or higher role than you.'
                });
            }

            // Check if target user is an admin
            if (targetMember.permissions.has('ADMINISTRATOR')) {
                return await interaction.editReply({
                    content: '❌ You cannot timeout an administrator.'
                });
            }

            // Apply timeout
            const timeoutDuration = duration * 60 * 1000; // Convert minutes to milliseconds
            const timeoutUntil = new Date(Date.now() + timeoutDuration);

            await targetMember.timeout(timeoutDuration, reason);

            // Log to database
            let conn;
            try {
                conn = await pool.getConnection();
                
                await conn.query(`
                    INSERT INTO user_timeouts (user_id, moderator_id, duration_minutes, reason, created_at)
                    VALUES (?, ?, ?, ?, NOW())
                `, [targetUser.id, interaction.user.id, duration, reason]);

                // Also log as admin action
                await conn.query(`
                    INSERT INTO admin_actions (admin_id, admin_username, action_type, target_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    interaction.user.id,
                    interaction.user.username,
                    'timeout',
                    targetUser.id,
                    `Duration: ${duration} minutes, Reason: ${reason}`
                ]);

            } catch (error) {
                console.error('Database logging error:', error);
                // Continue even if logging fails
            } finally {
                if (conn) conn.release();
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('⏰ User Timed Out')
                .setColor(0xF39C12)
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Until', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: false },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            // Try to DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⏰ You have been timed out')
                    .setColor(0xF39C12)
                    .addFields(
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Duration', value: `${duration} minutes`, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Timeout Expires', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'If you believe this was a mistake, please contact the moderation team.' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                // User has DMs disabled or blocked the bot
                console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
            }

            // Log to admin channel if configured
            const logChannelId = process.env.LOG_CHANNEL_ID;
            if (logChannelId) {
                try {
                    const logChannel = await interaction.client.channels.fetch(logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('⏰ User Timeout')
                            .setColor(0xF39C12)
                            .addFields(
                                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                                { name: 'Duration', value: `${duration} minutes`, inline: true },
                                { name: 'Reason', value: reason, inline: false }
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error('Failed to send log message:', error);
                }
            }

        } catch (error) {
            console.error('Timeout command error:', error);
            
            let errorMessage = '❌ Failed to timeout user.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to timeout this user.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = '❌ I don\'t have the required permissions to timeout users.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};
