const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clears')
		.setDescription('Shows your raid clears')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User whose clears u want to view')),
	async execute(interaction) {
		const user = interaction.options.getUser('user');
        try {
			const member = user ? user : interaction.user;
			const memberId = member.id;
			const avatarURL = member.avatarURL();
			const memberName = member.displayName;

            const clear = await prisma.clears.findUnique({
                where: {
                    member_id: memberId,
                },
            });

            if (!clear) {
                await interaction.reply({ content: 'This user doesn\'t have clear history.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`Clear Data`)
				.setAuthor({ name: memberName, iconURL: avatarURL })
                .setColor(0xD3D3D3)
                .setFields({ name: '** **', value:
                    `
                    Valtan: ${clear.valtan || 0}
                    Vykas: ${clear.vykas || 0}
                    Kakul: ${clear.kakul || 0}
                    Valtan DL: ${clear.valtan_dl || 0}
                    Vykas DL: ${clear.vykas_dl || 0}
                    Kakul DL: ${clear.kakul_dl || 0}
                    Total: ${clear.total || 0}
                    `
				});

			await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (e) {
            console.error('Error fetching data:', e);
			await interaction.reply({ content: 'An error occurred while fetching data.', ephemeral: true });
        }
	},
};