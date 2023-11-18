const { Events } = require('discord.js');

const ROLE_NAMES = {
    DEMON_HUNTER: 'Demon Hunter',
    ACADEMY: 'Academy',
};
const TITLES = {
    'Demon Beast Slayer': '<:demonbeastslayer:1138502853946773546>',
    'Covetous Slayer': '<:covetousslayer:1138511513355817061>',
    'Mayhem Slayer': '<:mayhemslayer:1138511527335444572>',
    'Phantom Slayer': '<:phantomslayer:1138511534247661699>',
};

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    async execute(_, member) {
        const roles = member.roles.cache;
        const demonhunter = member.guild.roles.cache.find(r => r.name === ROLE_NAMES.DEMON_HUNTER);
        const academy = member.guild.roles.cache.find(r => r.name === ROLE_NAMES.ACADEMY);

        if (roles.has(demonhunter?.id) && roles.has(academy?.id)) {
            try {
                await member.roles.remove(academy.id);
                console.log(`[Roles] Academy Removed [${member.user.username} (${member.id})]`);
            } catch (e) {
                console.error(`[Roles] Academy Remove Error: ${e.message} (${member.id})`);
            }
            return;
        }

        if (roles.has(demonhunter?.id)) return;
        const clears = Object.keys(TITLES).filter(title => roles.some(r => r.name === title)).length;
        if (clears >= 3) {
            try {
                await member.roles.add(demonhunter.id);
                console.log(`[Roles] Demon Hunter Given [${member.user.username} (${member.id})]`);
            } catch (e) {
                console.error(`[Roles] Demon Hunter Add Error: ${e.message} (${member.id})`);
            }
        }
    },
};