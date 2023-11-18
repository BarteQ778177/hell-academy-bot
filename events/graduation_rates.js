const { Events, EmbedBuilder } = require("discord.js");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        sendStats(client);
    },
};

function getNextDate() {
    const UPDATE_HOUR = 20; // 8 PM
    const DAYS_IN_WEEK = 7;
    const TARGET_DAY = 2; // Tuesday (0 is Sunday)
  
    const now = new Date();
    const nextUpdate = new Date();

    nextUpdate.setHours(UPDATE_HOUR, 0, 0, 0);
  
    // Calculate days to next Saturday
    const daysUntilNextTargetDay = (TARGET_DAY - now.getDay() + DAYS_IN_WEEK) % DAYS_IN_WEEK || DAYS_IN_WEEK;
    nextUpdate.setDate(now.getDate() + daysUntilNextTargetDay);
  
    let timeUntilNextUpdate = nextUpdate - now;
  
    if (timeUntilNextUpdate <= 0) {
        nextUpdate.setDate(nextUpdate.getDate() + DAYS_IN_WEEK);
        timeUntilNextUpdate = nextUpdate - now;
    }
  
    return timeUntilNextUpdate;
}

function getTitles() {
    return {
        "Demon Beast Slayer": "<:demonbeastslayer:1138502853946773546>",
        "Demon's Roar": "<:demonsroar:1138511521220141066>",
        "Covetous Slayer": "<:covetousslayer:1138511513355817061>",
        "Addicted to Delight": "<:addictedtodelight:1138511511053152266>",
        "Mayhem Slayer": "<:mayhemslayer:1138511527335444572>",
        "Mayhem Shadow": "<:mayhemshadow:1138511523921276928>",
        "Phantom Slayer": "<:phantomslayer:1138511534247661699>",
        "Phantom Monarch": "<:phantommonarch:1138511530367914025>",
        "Demon Hunter": "<:demonhunter:1138511517206200430>",
        "Thunderstrike": "",
    };
}

let firstRun = true;
const STATS_UPDATE_THRESHOLD = 300000; // 5 minutes in milliseconds

async function sendStats(client) {
    const statsInterval = getNextDate();
    if (statsInterval <= 0 || statsInterval <= STATS_UPDATE_THRESHOLD) {
        console.log("[Stats] Time Calculation Error");
        return;
    }

    if (firstRun) {
        setTimeout(() => sendStats(client), statsInterval);
        return;
    }

    firstRun = false;
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    const channel = client.channels.cache.get(process.env.STATS_CHANNEL_ID);
    try {
        await guild.members.fetch();
        const memberCount = guild.memberCount;
        const roles = await guild.roles.fetch();
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("Graduation Rates")
            .setFooter({ text: `Total Members: ${memberCount}` })
            .setTimestamp();

        const addRoleStatsToEmbed = (roleName, icon) => {
            const role = roles.find(r => r.name === roleName);
            const roleSize = role.members.size;
            const rolePercentage = ((roleSize / memberCount) * 100).toFixed(2);
            embed.addFields([{
                name: `${roleName} ${icon}`,
                value: `${roleSize} (${rolePercentage}%)`,
                inline: true
            }]);
        };

        const titles = getTitles();
        let embedsAdded = 0;
        for (const [roleName, icon] of Object.entries(titles)) {
            addRoleStatsToEmbed(roleName, icon);
            embedsAdded++;
        
            if (embedsAdded % 2 === 0) {
                embed.addFields([{ name: '** **', value: '** **', inline: false }]);
            }
        }

        await channel.send({ embeds: [embed] });
        console.log("[Stats] Sent");
    } catch (error) {
        console.error("[Stats] Failed to send stats:", error);
    }

    // Schedule next run
    setTimeout(() => sendStats(client), statsInterval);
}