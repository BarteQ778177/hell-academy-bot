const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const guild = await client.guilds.cache.get(process.env.GUILD_ID_APPEAL);
        if (!guild) return;
        const channel = await guild.channels.cache.get(process.env.APPEAL_INFO_CHANNEL);
        if (!channel) return;
    
        const embed = new EmbedBuilder()
            .setColor(0x009DFF)
            .setTitle('Ban Appeal Information')
            .setDescription('If you wish to appeal your ban, please follow the instructions provided below.')
            .addFields(
                { name: 'Appeal Steps:', value: '1. Review the community guidelines to ensure you understand the ban reasons.\n2. Press the "Appeal" button below this message.\n3. Fill out the appeal form carefully and submit it for review.', inline: false },
            )
            .setFooter({ text: 'Your appeal will be processed as soon as possible. Thank you for your patience.' });
        const appeal = new ButtonBuilder()
            .setCustomId('appeal_request')
            .setLabel('Appeal')
            .setStyle(ButtonStyle.Secondary);
        const rules = new ButtonBuilder()
            .setLabel('Rules')
            .setURL('https://drive.google.com/file/d/1RWSFYaDwDHNTNMF7yTTJtRN6dFmm3aCm/view')
            .setStyle(ButtonStyle.Link);
        const first = new ActionRowBuilder().addComponents(appeal, rules);

        try {
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();

            if (!lastMessage)
                await channel.send({ embeds: [embed], components: [first] });
        } catch (error) {
            console.error('Error handling the appeal message:', error);
        }
    }
}