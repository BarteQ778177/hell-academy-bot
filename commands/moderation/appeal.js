const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { checkPermissions, serverIcon } = require('@classes/utility');
const { logAction } = require('@classes/moderation')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('appeal')
        .setDescription('Decide on appeal request')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('decision')
                .setDescription('Decision')
                .setRequired(true)
                .addChoices(
                    { name: 'Accept', value: 'accept' },
                    { name: 'Deny', value: 'deny' },
                )
        ),
    async execute(interaction) {
        if (!(await checkPermissions(interaction, true))) return;
        const accept = interaction.options.getString('decision') === 'accept';
        const id = interaction.options.getInteger('id');
        const { userid, appeal } = await prisma.actions.findUnique({
            where: { id: id },
        }) ?? false;

        if (!appeal) return await interaction.reply({ content: 'An error has occured.', ephemeral: true });

        const handleStaffDecision = async () => {
            const message = await interaction.client.channels.cache.get(process.env.APPEALS_CHANNEL_ID).messages.fetch(appeal);
            const receivedEmbed = message.embeds[0];
            const embed = [{ name: "⚖️ Decision", value: `${accept ? "✅ Accepted" : "❌ Denied"}\nBy: <@${interaction.user.id}>`}];
            const newEmbed = EmbedBuilder.from(receivedEmbed).addFields(embed).setColor(accept ? 0x0af50a : 0xff0000);
            if (accept) {
                try { await message.guild.members.unban(userid) } catch (e) {
                    if (e.code === 10026) {
                        await interaction.reply({ content: 'User is not banned.', ephemeral: true })
                        return false;
                    }
                    console.log(e)
                    return false;
                }
                await prisma.actions.update({
                    where: { id: id },
                    data: { appeal: null }
                });
            }
            await message.edit({ embeds: [newEmbed], components: [] });
            return true;
        }

        const sendStaffDecision = async (accept) => {
            const member = await interaction.client.users.fetch(userid)
            const iconURL = await serverIcon(interaction)
            const appealEmbed = new EmbedBuilder()
                .setColor(accept ? 0x00FF00 : 0xFF0000)
                .setTitle('Appeal Decision')
                .setDescription(accept ? 
                    `Your appeal has been reviewed and accepted.\nYou\'ve been invited to [rejoin Hell Academy](https://discord.gg/hellacademy).` :
                    `After careful review, your appeal has been denied.`
                )
                .setThumbnail(iconURL)
                .setFooter({ text: accept ? 
                    'Thank you for your patience during the review process.' : 
                    'Decision is final.',
                    iconURL: iconURL
                });
            
            await member.send({ embeds: [appealEmbed] })
            
            try {
                const guild_appeals = interaction.client.guilds.cache.get(process.env.GUILD_ID_APPEAL)
                const member_appeals = await guild_appeals.members.fetch(userid)
                await member_appeals.kick()
            } catch (e) {
                console.error(e);
            }

            return true;
        }

        const handled = await handleStaffDecision();
        if (!handled) return;
        const sent = await sendStaffDecision(accept);

        await interaction.reply({ content: `Decision has been processed.${sent ? "" : "\nHowever it hasn't been sent to user DMs either because user doesn't accept new messages or isn't in ban appeals server."}`, ephemeral: true })
    }
}