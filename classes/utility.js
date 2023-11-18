const checkPermissions = async (interaction, adminOnly, checkOnly) => {
    // if (interaction.user.id === '458571041787346956') return true;

    const roleNames = ['staff', 'admin'];
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const roles = member.roles.cache;
    const hasPermission = roles.some(r => roleNames.includes(r.name.toLowerCase()));
    
    if (!hasPermission || (adminOnly && !roles.some(r => r.name.toLowerCase() === 'admin'))) {
        if (checkOnly) return false;
        await interaction.reply({ content: 'Missing permissions.', ephemeral: true });
        return false;
    }

    return true;
}

const serverIcon = async (interaction) => {
    const guild = interaction.client.guilds.cache.get(process.env.GUILD_ID);
    const iconURL = await guild.iconURL({ format: 'png', dynamic: true, size: 512 });
    return iconURL;
}

module.exports.checkPermissions = checkPermissions;
module.exports.serverIcon = serverIcon;