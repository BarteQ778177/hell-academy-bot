const { Events } = require("discord.js");
const fs = require('fs');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        backup(client);
        setInterval(() => backup(client), 8.64e+7);
    },
};

async function backup(client) {
    if (process.env.DEV) return console.log("[Backup] Skipped")
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    const members = await guild.members.fetch();
    const roles = await guild.roles.fetch();
    const date = new Date().toISOString().replace(/[-T:.]/g, '_').replace(/\..+/, '');
    fs.writeFile(`logs/roles-${date}.txt`, JSON.stringify(members), err => {
        if (err) { console.error(err); return; }
    });
    fs.writeFile(`logs/roles_data-${date}.txt`, JSON.stringify(roles), err => {
        if (err) { console.error(err); return; }
    });
    console.log("[Backup] User Information Backed Up")
}