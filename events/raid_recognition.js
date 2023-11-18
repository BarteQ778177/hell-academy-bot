const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder } = require('discord.js');
const fs = require("fs");
const axios = require("axios");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

let messageCount = 0;

function log(text) {
    const now = new Date();
    const formattedTime = `[${messageCount}] [${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}] `;
    console.log(formattedTime + text)
}

async function getRaidInfo(screenshot, content) {
    const axios = require('axios');
    const FormData = require('form-data');
    
    try {
        screenshot = `https://duckduckgo.com/iu/?u=${screenshot}`;
        const screenshotResponse = await axios.get(screenshot, { responseType: 'stream' });
    
        const form = new FormData();
        form.append('image', screenshotResponse.data, { filename: 'image.png' });
    
        try {
            const uploadResponse = await axios.post('http://127.0.0.1:5000/predict', form, { headers: { ...form.getHeaders() } });
            console.log('Success:', uploadResponse.data);
    
            const { class: image_class, confidence: confidence } = uploadResponse.data;
            if (!image_class || image_class === 'negative') return false;
            
            const raidMap = { 
                valtan: "Valtan", 
                vykas: "Vykas", 
                kakul: "Kakul-Saydon", 
                cali: "Caliligos" 
            };

            const raidInfo = { 
                raidName: (raidMap[image_class] || null), 
                confidence: confidence, 
                deathless: await checkDeathless(content) 
            };

            log(JSON.stringify(raidInfo));
            
            return raidInfo;
        } catch (error) {
            console.error(`Error uploading image: ${error}`);
        }
    } catch (error) {
        log(`Error when trying to detect image: ${error}`);
        return false;
    }    
}

async function checkDeathless(content) {
    let check = ["soon", "tomorrow", "rip"];

    let regex = /\b(dl|deathless|dr|shadow|shadows|roar|roars|roar's|atd|atds|delight|delights)\b\S*/i;
    let matches = content.match(regex);

    if (matches) {
        let index = matches.index
        let wordsBefore = content.substring(0, index).split(/\s+/).filter(word => check.includes(word.toLowerCase()));
        let wordsAfter = content.substring(index + matches[0].length).split(/\s+/).filter(word => check.includes(word.toLowerCase()));

        if (!(wordsBefore.length > 0 || wordsAfter.length > 0))
            return true
    }
    return false
}

async function addClear(memberId, raidName, deathless) {
    const raidMap = { "Valtan": "valtan", "Vykas": "vykas", "Kakul-Saydon": "kakul", "Caliligos" : "cali" };
    raidName = raidMap[raidName];
    raidName = deathless ? raidName + "_dl" : raidName;
    if (raidName === "cali_dl") raidName = "cali";

    const exists = await prisma.clears.findUnique({
        where: { member_id: memberId },
    });

    if (exists) {
        const query = await prisma.clears.update({
            where: { member_id: memberId },
            data: { [raidName]: { increment: 1 } },
        });

        if (query) log(`(Update) Clear added for ${memberId} | ${raidName}`);
    } else {
        const query = await prisma.clears.create({
            data: {
                member_id: memberId,
                [raidName]: 1
            },
        });

        if (query) log(`(Create) Clear added for ${memberId} | ${raidName}`);
    }
}

function getBanner(raidName, deathless) {
    const banners = {
        "Valtan": {
            "normal": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522340687155261/1_valtan_clear.png",
            "deathless": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522338908782652/2_valtan_deathless.png"
        },
        "Vykas": {
            "normal": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522339160428675/2_vykas_clear.png",
            "deathless": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522339382722570/2_vykas_deathless.png"
        },
        "Kakul-Saydon": {
            "normal": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522339609231420/3_clown_clear.png",
            "deathless": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522339827322961/4_clown_deathless.png"
        },
        "Brelshaza": {
            "normal": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522340104142848/5_brelshaza.png",
            "deathless": "https://cdn.discordapp.com/attachments/1168522227348676629/1168522340389371914/5_brelshaza_deathless.png"
        },
        "Caliligos": {
            "normal": "https://cdn.discordapp.com/attachments/1168522227348676629/1169757347124609074/1_caliligos.png",
            "deathless": "https://cdn.discordapp.com/attachments/1168522227348676629/1169757347124609074/1_caliligos.png"
        },
    };

    if (raidName && banners[raidName]) {
        return deathless ? banners[raidName].deathless : banners[raidName].normal;
    }

    return false;
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(m) {
    await check(m);
  }
}

async function check(m, forced) {
    const isRaidsChannel = m.channelId === process.env.RAIDS_CHANNEL_ID;
    const mentionsArray = Array.from(m.mentions.users.keys());
    let uniqueMentions = new Set(mentionsArray);
    const selfMention = uniqueMentions.has(m.author.id);
    uniqueMentions.add(m.author.id);
    const mentionCount = uniqueMentions.size;
    if (!isRaidsChannel || (mentionCount <= 1 && !selfMention)) return;
    if (mentionCount < 7 && m.type === 19) return;
    messageCount += 1
    log(m.id)
    log(`Message was sent in raid channel and also it has user mentions, proceeding further.`)
    log(`mentionCount: ${mentionCount}`)
    const isImageUrl = url => /(https?:\/\/.*\.(?:png|jpg|jpeg|gif))/i.test(url);
    const checkScreenshot = async () => {
        if (m.attachments.size === 0 && mentionCount >= 3 && mentionCount <= 8 && (mentionCount < 7 ? m.type !== 19 : true)) {
            const extractImageUrl = m => /(https?:\/\/[^\s]+?\.(png|jpg|jpeg|gif))/.exec(m);
            const match = extractImageUrl(m.content)
            if (match) return match[0];

            const time = 15;
            let isScreenshotReceived = false;
    
            const info = "A screenshot is suggested based on recent mentions.\nIf this seems inaccurate, please disregard.\n\nWaiting for a clear screenshot..."
            const embed = new EmbedBuilder()
                .setTitle('📸 Screenshot Needed')
                .setDescription(info)
                .setColor('#FFA500');
            
            const waiting = await m.reply({ embeds: [embed] });
    
            const countdown = async () => {
                for (let i = time; i > 0; i--) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (isScreenshotReceived) break;
    
                    embed.setDescription(`${info}\nTime left: ${i - 1}s`);
                    await waiting.edit({ embeds: [embed] });
                }
            };
    
            const awaitScreenshot = async () => {
                const filter = msg => msg.author.id === m.author.id;
                try {
                    const messageScreenshot = await m.channel.awaitMessages({ filter, max: 1, time: time * 1000, errors: ['time'] });
                    isScreenshotReceived = true;
                    return messageScreenshot;
                } catch (e) {
                    log(`An error occurred while awaiting messages: ${e}`);
                    return null;
                }
            };
    
            const [messageScreenshot] = await Promise.all([awaitScreenshot(), countdown().catch(console.error)]);
    
            if (!messageScreenshot) {
                log('User did not provide a valid screenshot within 15 seconds time period.');
                await waiting.delete();
                return;
            }
    
            const collectedMsg = messageScreenshot.first();
            const { attachments, content } = collectedMsg;
    
            await waiting.delete();

            if (attachments.size >= 1) return attachments.first().attachment;
            if (isImageUrl(content)) return content;
    
            return;
        }
    
        return m.attachments.first()?.attachment;
    };
    
    const screenshot = await checkScreenshot();
    if (!screenshot) return;
    
    let embeds = []
    let manual = false;
    let { raidName, confidence, deathless } = await getRaidInfo(screenshot, m.content);
    if (!raidName) { return log("Screenshot provided wasn't an clear image.")}
    if (confidence <= 65) raidName = false;
    
    const mentionLimitList = {
        "Kakul-Saydon": 4,
        "Caliligos": 4,
    }

    const mentionLimit = mentionLimitList[raidName] ?? 8
    if (mentionCount > mentionLimit) {
        const promptUserSelection = async (m) => {
            try {
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId('users')
                    .setPlaceholder('Select multiple users.')
                    .setMinValues(1)
                    .setMaxValues(8);
                uniqueMentions.forEach(id => userSelect.addDefaultUsers(id));
    
                const info = `You've mentioned more than ${mentionLimit} users.\nPlease select up to ${mentionLimit} users from the list.`;
                const embed = new EmbedBuilder()
                    .setTitle('Too many mentions')
                    .setDescription(info)
                    .setColor('#FFA500');
                
                const first = new ActionRowBuilder().addComponents(userSelect);
                
                let waiting = await m.reply({ embeds: [embed], components: [first] });
    
                const filter = (interaction) => interaction.user.id === m.author.id;
                const collector = m.channel.createMessageComponentCollector({ filter, time: 45000, max: 1 });
    
                return new Promise((resolve, reject) => {
                    collector.on('collect', async interaction => {
                        if (interaction.customId === 'users') {
                            try {
                                await waiting.delete();
                            } catch (e) {
                                log(`Couldn\'t delete the message. ${e}`);
                            }
                            interaction.deferUpdate();
                            resolve(interaction.values);
                        }
                    });
    
                    collector.on('end', async (collected, reason) => {
                        try {
                            if (reason === 'time') {
                                await waiting.delete();
                                resolve(false);
                            }
                        } catch (e) {
                            log(`Couldn\'t delete the message. ${e}`);
                        }
                    });
                });
            } catch (e) {
                return resolve(false);
            }
        };
    
        log(`Too many people were mentioned. (${mentionCount})`);
        try {
            const users = await promptUserSelection(m);
            if (Array.isArray(users)) uniqueMentions = new Set(users)
        } catch (e) {
            console.log(e.message);
        }
    }    

    if (uniqueMentions.size > 8) { try { await m.react('❌') } catch (e) {}; return };

    const guild = m.client.guilds.cache.get(process.env.GUILD_ID);
    const staff_channel = guild.channels.cache.get(process.env.DEV ? process.env.RAIDS_CHANNEL_ID : process.env.RAIDS_APPROVAL_CHANNEL_ID);
    const raids_channel = guild.channels.cache.get(process.env.RAIDS_CHANNEL_ID);

    const raids = {
        "Valtan": ["Demon Beast Slayer", "Demon's Roar"],
        "Vykas": ["Covetous Slayer", "Addicted to Delight"],
        "Kakul-Saydon": ["Mayhem Slayer", "Mayhem Shadow"],
        "Brelshaza": ["Phantom Slayer", "Phantom Monarch"],
        "Caliligos": ["Thunderstrike", "Thunderstrike"]
    };

    const accept = new ButtonBuilder()
        .setCustomId('accept')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success);
    const deny = new ButtonBuilder()
        .setCustomId('deny')
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);

    const select_raid = new StringSelectMenuBuilder()
        .setCustomId('raid')
        .setPlaceholder('Change Raid Type');
    Object.entries(raids).forEach(([raid]) => {
        const optionBuilder = new StringSelectMenuOptionBuilder()
            .setLabel(raid)
            .setDescription(`Change raid type to ${raid}`)
            .setValue(raid);
        select_raid.addOptions(optionBuilder);
    });
    const select_deathless = new StringSelectMenuBuilder()
        .setCustomId('deathless')
        .setPlaceholder('Change Deathless State');
    ["Clear", "Deathless"].forEach((type) => {
        const optionBuilder = new StringSelectMenuOptionBuilder()
            .setLabel(type)
            .setDescription(`Raid Completion ${type}`)
            .setValue(type);
        select_deathless.addOptions(optionBuilder);
    });

    const embed = new EmbedBuilder()
        .setColor(0xa8a8a8)
        .setTitle("Raid Approval Request")
        .setImage(screenshot)
        .setThumbnail(getBanner(raidName, deathless));
    embeds.push({ name: `${m.url}`, value: `** **` })
    if (raidName) { 
        embeds.push({ name: "Raid", value: `${raidName} ${deathless ? "[**Deathless**]" : ""} ${confidence < 99.9 ? `\n\`Confidence: ${confidence.toFixed(0)}%\`` : ""}` })
    } else {
        embeds.push({ name: "Raid", value: `Unable to recognize raid type ${deathless ? "[**Deathless**]" : ""}`})
    }

    let participants = Array.from(uniqueMentions).map(id => `<@${id}>`).join(" ");
    embeds.push({ name: "Participants", value: `${participants}` })
    embed.addFields(embeds);

    try {
        const first = new ActionRowBuilder().addComponents(select_raid);
        const second = new ActionRowBuilder().addComponents(select_deathless);
        const third = new ActionRowBuilder().addComponents(accept, deny);
        const response = await staff_channel.send({ embeds: [embed], components: [first, second, third], fetchReply : true})
        try {
            const collector = response.createMessageComponentCollector({ time: 604800000 });
            collector.on('collect', async interaction => {
                const staff = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'staff');
                const admin = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'admin');
                const roles = interaction.member.roles.cache;
                if (interaction.user.id !== '458571041787346956' && !roles.has(staff.id) && !roles.has(admin.id)) return interaction.reply({ content: 'Missing permissions.', ephemeral: true });
                
                try {
                    m = await raids_channel.messages.fetch(m.id);
                } catch (e) {
                    if (e.code === 10008) {
                        const receivedEmbed = response.embeds[0];
                        const embed = [{ name: "Staff Info", value: `Status: Clear message was deleted`}];
                        const newEmbed = EmbedBuilder.from(receivedEmbed).addFields(embed).setColor(0x8b0000);
                        await response.edit({ embeds: [newEmbed], components: [] });
                        await interaction.deferUpdate();
                        return;
                    } else {
                        log(`Failed to refetch message: ${e}`);
                    }
                }   

                if (interaction.customId === "raid" || interaction.customId === "deathless") {
                    if (interaction.customId === "raid")
                        raidName = interaction.values[0];
                    if (interaction.customId === "deathless") 
                        deathless = interaction.values[0] === "Deathless";
                    await response.edit({
                        embeds: [EmbedBuilder.from(response.embeds[0])
                            .setThumbnail(getBanner(raidName, deathless))]
                    });
                    await interaction.deferUpdate();
                }
                if (interaction.customId === "accept") {
                    if (!raidName) { return await interaction.reply({ content: "Missing raid type", ephemeral: true }) }
                    try { await m.react("✅") } catch (e) {}

                    const index = deathless ? 1 : 0;
                    const role = guild.roles.cache.find(r => r.name === raids[raidName][index]);
                    await guild.members.fetch()
                    uniqueMentions.forEach(async id => {
                        addClear(id, raidName, deathless)
                        await guild.members.cache.get(id).roles.add(role.id)
                    })
                } else if (interaction.customId === "deny") {
                    await m.react("❌")
                }

                if (interaction.customId === "raid" || interaction.customId === "deathless") {
                    manual = true;
                    const receivedEmbed = response.embeds[0];
                    let embeds = receivedEmbed.fields;
                    embeds[1].value = `${raidName} ${deathless ? "[**Deathless**]" : ""}`;
                    const newEmbed = EmbedBuilder.from(receivedEmbed).setFields(embeds);
                    await response.edit({ embeds: [newEmbed] });
                }
                if (interaction.customId === "accept" || interaction.customId === "deny") {
                    const receivedEmbed = response.embeds[0];
                    let embed = []
                    embed.push({ name: "Staff Info", value: `Status: ${interaction.customId === "accept" ? "Accepted" : "Denied"}\nBy: <@${interaction.user.id}>${ manual ? "\nOverride Method: Manual" : "" }${forced ? `\nSent via \`/recheck\` by: <@${forced.toString()}>` : ""}`})
                    const newEmbed = EmbedBuilder.from(receivedEmbed).addFields(embed).setColor(interaction.customId === "accept" ? 0x0af50a : 0xff0000);
                    await response.edit({ embeds: [newEmbed], components: [] });          
                }
            });
            } catch (e) {
                return console.log(e)
            }
        } catch (e) {
            return console.log(e)
        }
    }
    
module.exports.check = check;