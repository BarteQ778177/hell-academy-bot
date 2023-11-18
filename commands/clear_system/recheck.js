const { SlashCommandBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dotenv = require("dotenv").config();

const { check } = require('../../events/graduation_rates')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('recheck')
        .setDescription('Force a message check')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Message ID')
                .setRequired(true)),
	async execute(interaction) {
        const staff = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'staff');
        const admin = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'admin');
        const roles = interaction.member.roles.cache;
        if (interaction.user.id !== '458571041787346956' && !roles.has(staff.id) && !roles.has(admin.id)) return interaction.reply({ content: 'Missing permissions.', ephemeral: true });
        const message_id = interaction.options.getString('id');
        if (!message_id) return;
        const channel = await interaction.client.channels.fetch(process.env.RAIDS_CHANNEL_ID);
        const originalMessage = await channel.messages.fetch(message_id);
        await interaction.reply({ content: 'Checking message...', ephemeral: true });
        await check(originalMessage, interaction.user.id);
        await interaction.editReply({ content: 'Message checked.', ephemeral: true });
	},
};