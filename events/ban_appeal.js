const { Events, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        if (!interaction.customId) return;
        if (interaction.customId === 'appeal_request') {
            const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);
            const bans = await guild.bans.fetch();
            const isBanned = bans.some(ban => ban.user.id === interaction.user.id);
            if (!isBanned) return interaction.reply({ content: "You are not banned.", ephemeral: true })
            const { appeal } = await prisma.actions.findFirst({
                where: { userid: interaction.user.id, action: 'ban' },
                orderBy: { timestamp: 'desc' }
            }) ?? false;
            if (appeal) return interaction.reply({ content: "You already have a pending appeal.", ephemeral: true });

            const modal = new ModalBuilder()
                .setCustomId('appeal_modal')
                .setTitle('Appeal');
            const reason = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel("Reason")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(4000)
                .setRequired(true);
            const firstModal = new ActionRowBuilder().addComponents(reason);
            modal.addComponents(firstModal);

            await interaction.showModal(modal);
        } else if (interaction.customId === 'appeal_modal') {
            const maxLines = 10;
            const reason = interaction.fields.getTextInputValue('reason');
            const reason_cleaned = 
                reason.split('\n')
                    .slice(0, maxLines - 1)
                    .concat(reason.split('\n')
                    .slice(maxLines - 1)
                    .join(' '))
                    .join('\n');
            const channel = interaction.client.channels.cache.get(process.env.APPEALS_CHANNEL_ID);

            let { id, reason: ban_reason, staffid } = await prisma.actions.findFirst({
                where: { userid: interaction.user.id, action: 'ban' },
                orderBy: { timestamp: 'desc' }
            }) ?? false;
            if (!id) {
                const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);
                const bans = await guild.bans.fetch();
                const ban = bans.find(ban => ban.user.id === interaction.user.id);
                if (!ban) return;
                const action = await prisma.actions.create({
                    data: { 
                        userid: interaction.user.id,
                        action: 'ban',
                        reason: ban.reason
                    }
                });
                id = action.id;
                ban_reason = action.reason;
            }
            if (!id) return;

            const embed = new EmbedBuilder()
                .setTitle('**Appeal Review**')
                .setColor(0x2F3136)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '🆔 ID', value: `#${id}`, inline: true },
                    { name: "👤 User", value: `<@${interaction.user.id}>`, inline: true },
                    { name: '👮 Staff', value: `${staffid ? `<@${staffid}>` : `Unknown`}`, inline: true },
                    { name: "📜 Ban Reason", value: `${ban_reason ?? 'None'}`, inline: false },
                    { name: "📜 Appeal Reason", value: `${reason_cleaned}`, inline: false },
                )
                .setFooter({ text: `Appeal received` })
                .setTimestamp();

            const appeal = await channel.send({ embeds: [embed] })
            await interaction.reply({ content: 'Sent', ephemeral: true })

            await prisma.actions.update({
                where: { id: id },
                data: { appeal: appeal.id }
            });
        }
    }
}