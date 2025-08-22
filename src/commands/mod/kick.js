const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kick')
                .setRequired(false)
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

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember) {
                return await interaction.editReply({
                    content: '❌ User not found in this server.'
                });
            }

            // Check if user is trying to kick themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: '❌ You cannot kick yourself.'
                });
            }

            // Check if target user has higher or equal role
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.editReply({
                    content: '❌ You cannot kick a user with equal or higher role than you.'
                });
            }

            // Check if target user is an admin
            if (targetMember.permissions.has('ADMINISTRATOR')) {
                return await interaction.editReply({
                    content: '❌ You cannot kick an administrator.'
                });
            }

            // Try to DM the user before kicking
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('👢 You have been kicked')
                    .setColor(0xE74C3C)
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

            // Kick the user
            await targetMember.kick(reason);

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
                    'kick',
                    targetUser.id,
                    `User: ${targetUser.tag}, Reason: ${reason}`
                ]);

            } catch (error) {
                console.error('Database logging error:', error);
                // Continue even if logging fails
            } finally {
                if (conn) conn.release();
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('👢 User Kicked')
                .setColor(0xE74C3C)
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
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
                            .setTitle('👢 User Kicked')
                            .setColor(0xE74C3C)
                            .addFields(
                                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
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
            console.error('Kick command error:', error);
            
            let errorMessage = '❌ Failed to kick user.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to kick this user.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = '❌ I don\'t have the required permissions to kick users.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};
