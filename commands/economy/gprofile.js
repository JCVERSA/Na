/**
 * GProfile Command — Fiche de jeu NeonParty (Carte Image)
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const { generateGProfileCard } = require('../../utils/nebulaCard');

module.exports = {
  name: 'gprofile',
  aliases: ['gprofil', 'fiche', 'gameprofile', 'gp'],
  category: 'economy',
  description: 'Voir ta fiche de jeu NeonParty',
  usage: '.gprofile [@joueur]',

  async execute(sock, msg, args, extra) {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetId  = mentioned[0] || extra.sender;

      if (!np.isRegistered(targetId)) {
        if (targetId === extra.sender)
          return extra.reply("❌ Inscris-toi d'abord : *.startneonparty <pseudo>*");
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas encore dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const p      = np.getPlayer(targetId);
      const alive  = np.isAlive(targetId);
      const ecoU   = eco.getUser(targetId);
      const powers = np.getPowers(targetId);

      const weapon = p.weapon && np.WEAPON_STATS[p.weapon];
      const armor  = p.armor  && np.ARMOR_STATS[p.armor];

      const rank = np.getPlayerRank(p.gameXp || 0);
      const kdr  = p.deathCount > 0
        ? (p.killCount / p.deathCount).toFixed(2)
        : p.killCount.toString();

      const powersLine = powers.length > 0
        ? powers.map(pw => pw.id).join(', ')
        : 'Aucun';

      // Générer la carte
      const buffer = await generateGProfileCard(sock, p, ecoU, targetId, {
        name: p.username,
        alive,
        rankName: rank.name,
        kdr,
        weapon: weapon ? weapon.name : 'Mains nues',
        armor: armor ? armor.name : 'Aucune',
        powers: powersLine
      });

      await sock.sendMessage(extra.from, {
        image: buffer,
        caption: `🎮 *Hero Card* — ${p.username}`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch(e) { 
      console.error('[GPROFILE CARD ERROR]', e);
      await extra.reply(`❌ Erreur: ${e.message}`); 
    }
  }
};
