const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { checkPermissions, serverIcon } = require('@classes/utility')
const { logAction } = require('@classes/moderation')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn user')
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
        if (!(await checkPermissions(interaction))) return;
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const done = await warnMember(interaction, target, reason)
        if (!done) return await interaction.reply({ content: `Failed to warn user <@${target.id}>`, ephemeral: true });
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('Moderation Action')
            .setAuthor({ 
                name: interaction.user.displayName, 
                iconURL: interaction.user.avatarURL(),
            })
            .setDescription(`You have successfully warned ${target.displayName}.`)
            .setThumbnail(target.avatarURL())
            .addFields(
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Reason', value: reason }
            )
            .setFooter({ 
                text: `Moderation action recorded | ${new Date().toLocaleString()}`, 
                iconURL: interaction.client.user.avatarURL()
            });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

const warnMember = async (interaction, target, reason) => {
    try {
        const member = await interaction.guild.members.fetch(target.id);
        try { await sendWarn(interaction, member, reason) } catch (e) { console.log(e) }
        const action = await prisma.actions.create({
            data: { 
                staffid: interaction.user.id,
                userid: target.id,
                action: 'warn',
                reason: reason
            }
        });
        logAction(interaction, action.id, target, action.action, action.reason, action.duration)
        return true;
    } catch (e) {
        console.error(e);
    }
    return false;
}

const sendWarn = async (interaction, member, reason) => {
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setThumbnail(await serverIcon(interaction))
        .setTitle('Warn Notification from Hell Academy ⚠️')
        .addFields(
            { name: 'You have been warned for the following reason:', value: reason, inline: false },
            { name: '** **', value: '** **' },
            { name: 'Rules:', value: `https://discord.com/channels/993327417504583751/1133795170891075665` },
            { name: 'What this means:', value: 'Continued violations might result in further actions, including timeouts or bans.' },
            { name: 'Need clarification?', value: 'Contact a moderator or read our community guidelines.' }        
        )
        .setFooter({ text: 'Take this warning seriously to ensure a healthy community.' });

    await member.send({ embeds: [embed] })
    return true;
}