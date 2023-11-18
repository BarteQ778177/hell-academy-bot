const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { checkPermissions, serverIcon } = require('@classes/utility')
const { logAction } = require('@classes/moderation')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Edit moderaction action')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('remove')
                .setDescription('Delete action?')
                .setRequired(false)
        ),
    async execute(interaction) {
        return await edit(interaction);
    }
};

const edit = async (interaction) => {
    if (!(await checkPermissions(interaction))) return;
    const id = interaction.options.getInteger('id');
    const remove = interaction.options.getBoolean('remove');
    const { staffid, userid, action, reason, duration, timestamp } = await prisma.actions.findUnique({
        where: { id: id },
    }) ?? false;
    if (!action) return await interaction.reply({ content: `Invalid ID`, ephemeral: true });
    const target = await interaction.client.users.fetch(userid);
    if (remove) {
        const removed = await prisma.actions.delete({
            where: { id: id },
        });
        await interaction.reply({ 
            content: removed ?
                `You have successfully deleted action (#${id})`:
                `Failed to delete action (#${id})`,
            ephemeral: true
        })
        if (!removed) return;
        revertAction(interaction, userid, action)
        logAction(interaction, id, target, removed.action, removed.reason, removed.duration, false, false, true, true)
        return;
    }

    const { submit, reason_new, duration_new } = await editAction(interaction, id, action, reason, duration, userid, timestamp) ?? false;
    if (!submit) return;
    const embed = new EmbedBuilder()
        .setColor(0x808080) 
        .setTitle('Moderation Action')
        .setAuthor({ 
            name: interaction.user.displayName, 
            iconURL: interaction.user.avatarURL(),
        })
        .setDescription(`You have successfully edited action (#${id}).`)
        .setThumbnail(target.avatarURL())
        .addFields(
            { name: 'User', value: `<@${target.id}>` },
            { name: 'Reason', value: reason_new },
        )
        .setFooter({ 
            text: `Moderation action recorded | ${new Date().toLocaleString()}`, 
            iconURL: interaction.client.user.avatarURL()
        });

    if (duration) embed.addFields({ name: 'Duration', value: `${duration_new} hours` })
    await submit.reply({ embeds: [embed], ephemeral: true });
}

const revertAction = async (interaction, userid, action) => {
    try {
        if (action === "ban") await interaction.guild.bans.remove(userid)
        if (action === "timeout") {
            const member = await interaction.guild.members.fetch(userid);
            await member.timeout(null)
        }

        const member = await interaction.client.users.fetch(userid)
        const iconURL = await serverIcon(interaction)
        const appealEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`Case Review`)
            .setDescription(`Your case has been reviewed and your punishment has been reverted.${action === "ban" ? "\nYou\'ve been invited to [rejoin Hell Academy](https://discord.gg/hellacademy)." : ""}`)
            .setThumbnail(iconURL)
            .setFooter({ text: "Thank you for your patience.", iconURL: iconURL});
         
        await member.send({ embeds: [appealEmbed] })
    } catch (e) {
        console.error(e);
    }
}

const editAction = async (interaction, id, action, reason, duration, userid, timestamp) => {
    const modal = new ModalBuilder()
        .setCustomId('action_edit')
        .setTitle('Edit Action');
    const reasoninput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel("Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(reason)
        .setRequired(true);
    const durationinput = duration ? new TextInputBuilder()
        .setCustomId('duration')
        .setLabel("Duration (in hours, ex. 1.5)")
        .setStyle(TextInputStyle.Short)
        .setValue(duration.toString())
        .setRequired(true) : false;
        
    const firstModal = new ActionRowBuilder().addComponents(reasoninput);
    const secondModal = durationinput ? new ActionRowBuilder().addComponents(durationinput) : false;
    modal.addComponents([firstModal, secondModal].filter(Boolean));

    await interaction.showModal(modal);

    const submit = await interaction.awaitModalSubmit({ time: 120_000 })
    if (!submit) return;
    const reason_new = submit.fields.getTextInputValue('reason')
    const duration_new = durationinput ? Number(submit.fields.getTextInputValue('duration')) : false
    if (!reason_new || durationinput && !duration_new) return false
    if ((duration && duration == duration_new) && reason === reason_new) return await submit.reply({ content: "Nothing was changed.", ephemeral: true });
    const edited = await prisma.actions.update({
        where: { id: id },
        data: { reason: reason_new, duration: duration_new ? duration_new : null }
    }) ?? false;
    if (!edited) return false

    if (action === "timeout" && duration != duration_new) {
        try {
            const newDurationMilliseconds = duration_new  * 60 * 60 * 1000;
            const timeElapsed = Date.now() - new Date(timestamp).getTime();
            const remainingDuration = newDurationMilliseconds - timeElapsed;
            const member = await interaction.guild.members.fetch(userid);
            if (remainingDuration > 0) await member.timeout(remainingDuration);
            if (remainingDuration <= 0) await member.timeout(null);
        } catch (e) {
            console.error(e)
        }
    }
    const target = await interaction.client.users.fetch(userid);
    logAction(interaction, edited.id, target, edited.action, edited.reason, edited.duration, reason, duration, true)
    return { submit, reason_new, duration_new }
}