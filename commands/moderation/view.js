const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { checkPermissions } = require('@classes/utility')

process.on("uncaughtException", async (err) => console.error("uncaughtException ", err) );
process.on("unhandledRejection", async (err) => console.error("unhandledRejection ", err) );
process.on("uncaughtExceptionMonitor", async (err) => console.error("uncaughtExceptionMonitor ", err) );

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view')
        .setDescription('View user moderation')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!(await checkPermissions(interaction))) return;
        const target = interaction.options.getUser('user');
        const admin = await checkPermissions(interaction, true, true)
        
        const types = [
            { label: '🔍 All', value: 'all' },
            { label: '🚫 Bans', value: 'ban' },
            { label: '⌛ Timeouts', value: 'timeout' },
            { label: '⚠️ Warnings', value: 'warn' },
        ];        
    
        const typeEmoji = {
            'all': '🔍',
            'ban': '🚫',
            'timeout': '⌛',
            'warn': '⚠️',
        }

        const availableActionTypes = await fetchActionTypesForUser(target);

        const filteredTypes = types.filter(typeOption => {
            if (typeOption.value === 'all') return true;
            return availableActionTypes.includes(typeOption.value);
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('type')
            .setPlaceholder('Select a moderation action to view')
            .addOptions(filteredTypes);
        
        const first = new ActionRowBuilder()
            .addComponents(selectMenu);
    
        const embed = new EmbedBuilder()
            .setTitle('🔍 Moderation History')
            .setDescription('Choose a moderation action to view')
            .setColor(0x0099FF);
    
        await interaction.reply({ embeds: [embed], components: [first], ephemeral: true });
    
        const updateEmbed = async (embed, type, page, target) => {
            const { totalEntries, actions } = await fetchActions(type, page, target);
            if (totalEntries === 0) {
                embed.setFields()
                    .setDescription(`No history found for <@${target.id}>`)
                    .setFooter({ text: " " });
                return [first];
            }
            const totalPages = Math.ceil(totalEntries / 5);
        
            const prevButton = new ButtonBuilder()
                .setCustomId('prev')
                .setStyle('Secondary')
                .setEmoji('⬅️')
                .setDisabled(page === 0);
        
            const nextButton = new ButtonBuilder()
                .setCustomId('next')
                .setStyle('Secondary')
                .setEmoji('➡️')
                .setDisabled(page === totalPages - 1);

            const second = new ActionRowBuilder()
                .addComponents(prevButton, nextButton);

            const descriptionHeader = type === "all" ? "All Actions" : type.toUpperCase();
            const progressBar = createProgressBar(page + 1, totalPages);
            embed.setFields()
                 .setDescription(`${typeEmoji[type]} **${descriptionHeader}**`)
                 .setFooter({ text: `${progressBar}` });
        
            actions.forEach(({ id, staffid, action, reason, timestamp, duration }) => {
                const unixTimestamp = Math.floor(new Date(timestamp).getTime() / 1000);
                const fieldName = type === "all" ? `${typeEmoji[action]} (#${id})` : `(#${id})`;
                embed.addFields({ name: fieldName, value: `Reason: ${reason}\n${duration ? `Duration: ${duration} hours\n` : ""}Date: <t:${unixTimestamp}>\n${admin ? `Staff: <@${staffid}>` : ""}` });
            });
            
            
            return [first, second]
        };
        
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 1800000 });
        
        let page = 0;
        let type = null;
        
        collector.on('collect', async i => {
            const customId = i.customId;
        
            if (!type && customId !== 'type') return;
        
            if (customId === 'type') {
                type = i.values[0];
                page = 0;
            }
            if (customId === 'prev') page = Math.max(0, page - 1);
            if (customId === 'next') page++;
        
            if (!type) return;
        
            const components = await updateEmbed(embed, type, page, target);
            try { await i.update({ embeds: [embed], components: components, ephemeral: true }); } catch (e) {}
        });        
    },
};

async function fetchActions(type, page, target) {
    const whereCondition = { userid: target.id };
    if(type !== "all") whereCondition.action = type;

    return {
        totalEntries: await prisma.actions.count({ where: whereCondition }),
        actions: await prisma.actions.findMany({
            skip: page * 5,
            take: 5,
            where: whereCondition,
            orderBy: { timestamp: 'desc' }
        })
    };
}

const createProgressBar = (currentPage, totalPages) => {
    const filledBlocks = Math.round((currentPage / totalPages) * totalPages);
    const emptyBlocks = totalPages - filledBlocks;
    return `${'▮'.repeat(filledBlocks)}${'▯'.repeat(emptyBlocks)}`;
}

async function fetchActionTypesForUser(target) {
    const actions = await prisma.actions.findMany({
        where: { userid: target.id },
        select: { action: true }
    });
    return [...new Set(actions.map(a => a.action))];
}