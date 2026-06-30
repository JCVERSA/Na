/**
 * StopNeonParty — Quitter le jeu NeonParty
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const ent = require('../../utils/enterprise');

const pendingQuit = new Map();

module.exports = {
  name: 'stopneonparty',
  aliases: ['quitterjeu', 'leavegame', 'snp_stop'],
  category: 'economy',
  description: 'Quitter définitivement NeonParty',
  usage: '.stopneonparty | .stopneonparty confirm',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ T'es pas encore inscrit dans NeonParty!");
      }

      const sub = (args[0] || '').toLowerCase();

      if (sub === 'confirm' || sub === 'oui') {
        const p = np.getPlayer(extra.sender);

        // Fermer l'entreprise si existante
        if (ent.hasCompany(extra.sender)) {
          ent.closeCompany(extra.sender);
        }

        // Marquer comme non-enregistré (on garde les données eco)
        np.updatePlayer(extra.sender, {
          registered: false,
          alive: true,
          inPrison: false,
          prisonUntil: null,
          weapon: null, armor: null, powers: [],
        });

        pendingQuit.delete(extra.sender);

        return extra.reply(
          `👋 *AU REVOIR !*\n\n` +
          `Tu as quitté *NeonParty* ${p.username ? `, ${p.username}` : ''}.\n\n` +
          `_Tes coins sont conservés._\n` +
          `_Pour rejouer, tape .startneonparty <pseudo>_`
        );
      }

      // Confirmation
      const p = np.getPlayer(extra.sender);
      pendingQuit.set(extra.sender, Date.now());
      setTimeout(() => pendingQuit.delete(extra.sender), 60000);

      return extra.reply(
        `⚠️ *QUITTER NEONPARTY ?*\n\n` +
        `👤 Pseudo : *${p.username}*\n` +
        `🔪 Kills : *${p.killCount || 0}*  💀 Morts : *${p.deathCount || 0}*\n\n` +
        `*Ce que tu perdras :*\n` +
        `❌ Ton pseudo de jeu\n` +
        `❌ Ton arme et armure équipées\n` +
        `❌ Tes pouvoirs actifs\n` +
        `❌ Ton entreprise (si tu en as une)\n\n` +
        `✅ *Ce qui reste :* Tes coins, ton niveau économie\n\n` +
        `Tape *.stopneonparty confirm* pour confirmer\n` +
        `_60 secondes pour répondre_`
      );

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
