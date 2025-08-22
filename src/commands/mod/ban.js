const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for ban')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Days of messages to delete (0-7)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(7)
        ),

    async execute(interaction) {
        // Check permissions
        if (!hasAdminRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You need Admin role or higher to use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if user is already banned
            const bans = await interaction.guild.bans.fetch();
            if (bans.has(targetUser.id)) {
                return await interaction.editReply({
                    content: '❌ This user is already banned.'
                });
            }

            // Check if user is trying to ban themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: '❌ You cannot ban yourself.'
                });
            }

            // Check if target user is in the server
            let targetMember = null;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch (error) {
                // User not in server, but we can still ban by ID
            }

            // If user is in server, do additional checks
            if (targetMember) {
                // Check if target user has higher or equal role
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    return await interaction.editReply({
                        content: '❌ You cannot ban a user with equal or higher role than you.'
                    });
                }

                // Check if target user is an admin
                if (targetMember.permissions.has('ADMINISTRATOR')) {
                    return await interaction.editReply({
                        content: '❌ You cannot ban an administrator.'
                    });
                }

                // Try to DM the user before banning
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🔨 You have been banned')
                        .setColor(0x8B0000)
                        .addFields(
                            { name: 'Server', value: interaction.guild.name, inline: true },
                            { name: 'Reason', value: reason, inline: false }
                        )
                        .setFooter({ text: 'If you believe this was a mistake, please contact the moderation team.' })
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (error) {
                    // User has DMs disabled or blocked the bot
                    console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
                }
            }

            // Ban the user
            await interaction.guild.members.ban(targetUser.id, {
                reason: reason,
                deleteMessageDays: deleteDays
            });

            // Log to database
            let conn;
            try {
                conn = await pool.getConnection();
                
                await conn.query(`
                    INSERT INTO admin_actions (admin_id, admin_username, action_type, target_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    interaction.user.id,
                    interaction.user.username,
                    'ban',
                    targetUser.id,
                    `User: ${targetUser.tag}, Reason: ${reason}, Delete Days: ${deleteDays}`
                ]);

            } catch (error) {
                console.error('Database logging error:', error);
                // Continue even if logging fails
            } finally {
                if (conn) conn.release();
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('🔨 User Banned')
                .setColor(0x8B0000)
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            // Log to admin channel if configured
            const logChannelId = process.env.LOG_CHANNEL_ID;
            if (logChannelId) {
                try {
                    const logChannel = await interaction.client.channels.fetch(logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🔨 User Banned')
                            .setColor(0x8B0000)
                            .addFields(
                                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                                { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
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
            console.error('Ban command error:', error);
            
            let errorMessage = '❌ Failed to ban user.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to ban this user.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = '❌ I don\'t have the required permissions to ban users.';
            } else if (error.code === 10007) {
                errorMessage = '❌ Unknown user - they may have already left the server.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};
