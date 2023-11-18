const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

const logAction = async (interaction, id, target, action, reason, duration, oldReason, oldDuration, edit, deleted) => {
    const actionConfig = {
        'ban': {
            channelId: process.env.LOG_BAN,
            color: 0xFF0000,
        },
        'timeout': {
            channelId: process.env.LOG_TIMEOUT,
            color: 0xFF7C00,
        },
        'warn': {
            channelId: process.env.LOG_WARN,
            color: 0xFFD700,
        },
        'edit': {
            channelId: process.env.LOG_EDIT,
            color: 0x808080,
        },
        'deletion': {
            channelId: process.env.LOG_DELETION,
            color: 0x8B0000,
        }
    };

    const config = deleted ? actionConfig['deletion'] : edit ? actionConfig['edit'] : actionConfig[action];
    const channel = interaction.client.channels.cache.get(config.channelId);
    const channel_copy = interaction.client.channels.cache.get(process.env.LOG_COPY);

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`Moderation Action: ${deleted ? "Deletion" : edit ? "Edit" : action.charAt(0).toUpperCase() + action.slice(1)}`)
        .setAuthor({ 
            name: interaction.user.displayName, 
            iconURL: interaction.user.avatarURL(),
        })
        .setThumbnail(target.avatarURL())
        .addFields(
            { name: '🆔 ID', value: `#${id}`, inline: true },
            { name: '👮 Staff', value: `<@${interaction.user.id}>`, inline: true },
            { name: '👤 User', value: `<@${target.id}>`, inline: true },
            { 
                name: '📜 Reason', 
                value: edit && oldReason && oldReason !== reason ? 
                    `~~${oldReason}~~\n${reason}` : 
                    deleted ? `~~${reason}~~` : reason,
                inline: false 
            }
        )
        .setFooter({ text: `Moderation action log` })
        .setTimestamp();
        if (duration) {
            embed.addFields({ 
                name: '⏳ Duration', 
                value: edit && oldDuration && (Number(oldDuration) !== Number(duration)) ? 
                    `~~${oldDuration} hours~~\n${duration} hours` : 
                    deleted ? `~~${duration} hours~~` : `${duration} hours`, 
                inline: true 
            });
        }

    await channel.send({ embeds: [embed] });

    const embed_copy = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`Moderation Action: ${deleted ? "Deletion" : edit ? "Edit" : action.charAt(0).toUpperCase() + action.slice(1)}`)
        .setThumbnail(target.avatarURL())
        .addFields(
            { name: '🆔 ID', value: `#${id}`, inline: true },
            { name: '👤 User', value: `<@${target.id}>`, inline: true },
            { 
                name: '📜 Reason', 
                value: edit && oldReason && oldReason !== reason ? 
                    `~~${oldReason}~~\n${reason}` : 
                    deleted ? `~~${reason}~~` : reason,
                inline: false 
            }
        )
        .setFooter({ text: `Moderation action log` })
        .setTimestamp();
        if (duration) {
            embed.addFields({ 
                name: '⏳ Duration', 
                value: edit && oldDuration && (Number(oldDuration) !== Number(duration)) ? 
                    `~~${oldDuration} hours~~\n${duration} hours` : 
                    deleted ? `~~${duration} hours~~` : `${duration} hours`, 
                inline: true 
            });
        }

    await channel_copy.send({ embeds: [embed_copy] });
}

module.exports.logAction = logAction;