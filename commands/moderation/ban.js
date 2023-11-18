const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { checkPermissions, serverIcon } = require('@classes/utility');
const { logAction } = require('@classes/moderation')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason')
                .setRequired(true)
        ),
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        await interaction.deferReply({ ephemeral: true });

        if (!target) return await interaction.editReply({ content: 'Invalid user.', ephemeral: true });
        
        const done = await banMember(interaction, target, reason)
        if (!done) return await interaction.editReply({ content: `Failed to ban user <@${target.id}>`, ephemeral: true });
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Moderation Action')
            .setAuthor({ 
                name: interaction.user.displayName, 
                iconURL: interaction.user.avatarURL(),
            })
            .setDescription(`You have successfully banned ${target.displayName}.`)
            .setThumbnail(target.avatarURL())
            .addFields(
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Reason', value: reason }
            )
            .setFooter({ 
                text: `Moderation action recorded`, 
                iconURL: interaction.client.user.avatarURL()
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });
    },
};

const banMember = async (interaction, target, reason) => {
    try {
        const member = await interaction.guild.members.fetch(target.id);

        const bans = await interaction.guild.bans.fetch();
        const alreadyBanned = bans.some(ban => ban.user.id === target.id);
        if (alreadyBanned) {
            console.log(`User ${target.id} is already banned.`);
            return false;
        }

        try { 
            await sendAppeal(interaction, member, reason);
        } catch (e) {
            console.error("Could not send an appeal message to the user.", e);
        }

        await member.ban({ reason: `Staff: ${interaction.user.globalName} (${interaction.user.id}) | Reason: ${reason}` });
        const action = await prisma.actions.create({
            data: { 
                staffid: interaction.user.id,
                userid: target.id,
                action: 'ban',
                reason: reason
            }
        });
        logAction(interaction, action.id, target, action.action, action.reason, action.duration);
        return true;
    } catch (e) {
        console.error("An error occurred while trying to ban the member:", e);
        return false;
    }
}

const sendAppeal = async (interaction, member, reason) => {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setThumbnail(await serverIcon(interaction))
        .setTitle('Ban Notification from Hell Academy 🚫')
        .addFields(
            { name: 'You have been banned for the following reason:', value: reason, inline: false },
            { name: '** **', value: '** **' },
            { name: 'To appeal this decision:', value: '1. Join the [**Hell Academy Ban Appeal**](https://discord.gg/yVgh8PNsza) server.\n2. Click the "Appeal" button once inside.\n3. Follow the on-screen instructions to submit your appeal.', inline: false },
        );

    await member.send({ embeds: [embed] })
    return true;
}