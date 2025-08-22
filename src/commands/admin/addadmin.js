const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminRole } = require('../../utils/permissions');
const { pool } = require('../../config/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addadmin')
        .setDescription('Add admin role to a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to give admin role')
                .setRequired(true)
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

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            
            if (!targetMember) {
                return await interaction.editReply({
                    content: '❌ User not found in this server.'
                });
            }

            // Check if user is trying to add admin to themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: '❌ You cannot add admin role to yourself.'
                });
            }

            // Get admin role
            const adminRoleId = config.roles.admin;
            if (!adminRoleId) {
                return await interaction.editReply({
                    content: '❌ Admin role is not configured. Please set ADMIN_ROLE_ID in your environment variables.'
                });
            }

            const adminRole = await interaction.guild.roles.fetch(adminRoleId);
            if (!adminRole) {
                return await interaction.editReply({
                    content: '❌ Admin role not found. Please check your role configuration.'
                });
            }

            // Check if user already has admin role
            if (targetMember.roles.cache.has(adminRoleId)) {
                return await interaction.editReply({
                    content: '❌ User already has admin role.'
                });
            }

            // Add admin role
            await targetMember.roles.add(adminRole);

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
                    'add_admin',
                    targetUser.id,
                    `Added admin role to ${targetUser.tag}`
                ]);

            } catch (error) {
                console.error('Database logging error:', error);
                // Continue even if logging fails
            } finally {
                if (conn) conn.release();
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('⭐ Admin Role Added')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Added by', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Role', value: adminRole.name, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

            // Try to DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⭐ You have been promoted to Admin')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Role', value: adminRole.name, inline: true },
                        { name: 'Promoted by', value: interaction.user.tag, inline: true }
                    )
                    .setDescription('You now have access to admin commands. Use them responsibly!')
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
                            .setTitle('⭐ Admin Role Added')
                            .setColor(0x00FF00)
                            .addFields(
                                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: 'Added by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                                { name: 'Role', value: adminRole.name, inline: true }
                            )
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error('Failed to send log message:', error);
                }
            }

        } catch (error) {
            console.error('Add admin command error:', error);
            
            let errorMessage = '❌ Failed to add admin role.';
            if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to manage roles.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = '❌ I don\'t have the required permissions to manage roles.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};
