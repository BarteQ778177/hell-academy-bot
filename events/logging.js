const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        const now = new Date();
        const formattedTime = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
        console.log(`${formattedTime} Command: ${interaction.commandName} | User: ${interaction.user.displayName} (${interaction.id})`)
    }
}