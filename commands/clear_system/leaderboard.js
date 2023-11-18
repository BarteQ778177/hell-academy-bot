const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
        .setDescription('Show raid clear leaderboard'),
	async execute(interaction) {
        const raidOptions = [
            { label: 'Valtan', value: 'valtan' },
            { label: 'Vykas', value: 'vykas' },
            { label: 'Kakul', value: 'kakul' },
            { label: 'Total', value: 'total' },
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('raidSelect')
            .setPlaceholder('Choose a raid')
            .addOptions(raidOptions);

        const prevButton = new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('<')
            .setStyle('Secondary');

        const nextButton = new ButtonBuilder()
            .setCustomId('next')
            .setLabel('>')
            .setStyle('Secondary');

        const first = new ActionRowBuilder()
            .addComponents(selectMenu);
        const second = new ActionRowBuilder()
            .addComponents(prevButton, nextButton);

        const embed = new EmbedBuilder()
            .setTitle('Raid Clear Leaderboard')
            .setDescription('Select a raid to display the leaderboard')
            .setColor(0x0099FF);

        await interaction.reply({ embeds: [embed], components: [first, second], ephemeral: true });

        const filter = i => i.user.id === interaction.user.id;

        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 1800000 });

        let page = 0;
        let selectedRaid = null;

        collector.on('collect', async i => {
            if (i.customId === 'raidSelect') {
                selectedRaid = i.values[0];
                page = 0;
            } else if (i.customId === 'prev') {
                page = Math.max(page - 1, 0);
            } else if (i.customId === 'next') {
                page++;
            }
        
            if (selectedRaid) {
                const totalEntries = await prisma.clears.count(); 
                const totalPages = Math.ceil(totalEntries / 10);
        
                const leaderboard = await prisma.clears.findMany({
                    skip: page * 10,
                    take: 10,
                    orderBy: {
                        [selectedRaid]: 'desc'
                    }
                });
        
                const members = await Promise.all(
                    leaderboard.map(async entry => {
                        return await i.client.users.fetch(entry.member_id);
                    })
                );
        
                const descriptionArray = leaderboard.map((entry, index) => {
                    const member = members[index];
                    if (!member) return null;
                    let totalClears = entry[selectedRaid];
                    if (selectedRaid !== 'total') totalClears += (entry[`${selectedRaid}_dl`] || 0);
                    return `${member.displayName} - ${totalClears}`;
                }).filter(Boolean);
        
                descriptionArray.sort((a, b) => {
                    const a_ = parseInt(a.split(' - ')[1], 10);
                    const b_ = parseInt(b.split(' - ')[1], 10);
                    return b_ - a_;
                });
        
                const description = descriptionArray.map((entry, index) => `${index + 1 + page * 10}. ${entry}`).join('\n');
                embed.setDescription(`Leaderboard for ${selectedRaid}\n\n${description}`)
                    .setFooter({ text: `Page ${page + 1}/${totalPages}` });
        
                await i.update({ embeds: [embed], ephemeral: true });
            }
        });            
	},
};