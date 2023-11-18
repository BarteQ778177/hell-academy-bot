const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { checkPermissions, serverIcon } = require('@classes/utility')
const { logAction } = require('@classes/moderation')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (ex. 1h, 1d, 1w)')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!(await checkPermissions(interaction))) return;
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const durationStr = interaction.options.getString('duration');
        const amount = parseFloat(durationStr);
        const unit = durationStr.slice(-1);
        await interaction.deferReply({ ephemeral: true });
        if (isNaN(amount)) return await interaction.editReply({ content: 'Invalid format.', ephemeral: true });
        const conversion = { 'h': 1, 'd': 24, 'w': 24 * 7 };
        if (!conversion[unit]) return await interaction.editReply({ content: 'Invalid unit.', ephemeral: true });
        const duration = amount * conversion[unit];

        const unixTimestamp = Math.floor(new Date().getTime() / 1000) + duration * 3600;

        const done = await timeoutMember(interaction, target, reason, duration, unixTimestamp);
        if (!done) return await interaction.editReply({ content: `Failed to timeout user <@${target.id}>`, ephemeral: true });
        const embed = new EmbedBuilder()
            .setColor(0xFF7C00) 
            .setTitle('Moderation Action')
            .setAuthor({ 
                name: interaction.user.displayName, 
                iconURL: interaction.user.avatarURL(),
            })
            .setDescription(`You have successfully timed out ${target.displayName}.`)
            .setThumbnail(target.avatarURL())
            .addFields(
                { name: 'User', value: `<@${target.id}>` },
                { name: 'Duration', value: `${duration} hours, until <t:${unixTimestamp}>` },
                { name: 'Reason', value: reason },
            )
            .setFooter({ 
                text: `Moderation action recorded | ${new Date().toLocaleString()}`, 
                iconURL: interaction.client.user.avatarURL()
            });

        await interaction.editReply({ embeds: [embed], ephemeral: true });
    },
};

const timeoutMember = async (interaction, target, reason, duration, timestamp) => {
    try {
        const member = await interaction.guild.members.fetch(target.id);
        await member.timeout(duration*3600*1000);
        try { await sendTimeout(interaction, member, reason, duration, timestamp) } catch (e) { console.log(e) }
        const action = await prisma.actions.create({
            data: { 
                staffid: interaction.user.id,
                userid: target.id,
                action: 'timeout',
                reason: reason,
                duration: duration
            }
        });
        logAction(interaction, action.id, target, action.action, action.reason, action.duration)
        return true;
    } catch (e) {
        console.error(e);
    }
    return false;
}

const sendTimeout = async (interaction, member, reason, duration, timestamp) => {
    const embed = new EmbedBuilder()
        .setColor(0xFF7C00)
        .setThumbnail(await serverIcon(interaction))
        .setTitle('Timeout Notification from Hell Academy ⏳')
        .addFields(
            { name: 'You have been timed out for the following reason:', value: reason, inline: false },
            { name: '** **', value: '** **' },
            { name: 'Duration:', value: `${duration} hours, until <t:${timestamp}>` },
            { name: 'Rules:', value: `https://discord.com/channels/993327417504583751/1133795170891075665` },
            { name: 'What this means:', value: 'During this timeout, you won\'t be able to send messages or interact in channels.' },
            { name: 'How to proceed:', value: 'Reflect on the reason and ensure to follow our community guidelines upon your return.' },
        )
        .setFooter({ text: 'Your cooperation helps maintain a positive environment.' });

    await member.send({ embeds: [embed] })
    return true;
}