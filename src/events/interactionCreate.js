module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                
                const errorMessage = 'There was an error while executing this command!';
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        }
        
        // Handle button interactions
        else if (interaction.isButton()) {
            // Handle button interactions for report confirmation, etc.
            const customId = interaction.customId;
            
            if (customId.startsWith('confirm_report_')) {
                const reportId = customId.split('_')[2];
                // Handle report confirmation
                await interaction.reply({ content: 'Report confirmed!', ephemeral: true });
            }
            
            if (customId.startsWith('cancel_report_')) {
                const reportId = customId.split('_')[2];
                // Handle report cancellation
                await interaction.reply({ content: 'Report cancelled.', ephemeral: true });
            }
        }
        
        // Handle modal submissions
        else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('report_modal_')) {
                const reportCommand = interaction.client.commands.get('report');
                if (reportCommand && reportCommand.handleModalSubmit) {
                    await reportCommand.handleModalSubmit(interaction);
                }
            }
        }
    },
};
