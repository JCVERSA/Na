/**
 * Plainte Command — Porter plainte après un crime (5 secondes)
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');

const PRISON_MIN = 30 * 60 * 1000;  // 30 min
const PRISON_MAX = 60 * 60 * 1000;  // 1h
const FALSE_WARN_LIMIT = 3;

module.exports = {
  name: 'plainte',
  aliases: ['complaint', 'signaler', 'accuser', 'porter'],
  category: 'economy',
  description: 'Porter plainte contre un joueur (dans les 5s après un crime)',
  usage: '.plainte @joueur',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      if (np.isInPrison(extra.sender)) {
        return extra.reply("🔒 Tu es en prison, tu peux pas porter plainte!");
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply("❌ Mentionne le coupable!\n*.plainte @joueur*");

      const accusedId  = mentioned[0];
      const accuserId  = extra.sender;

      if (accusedId === accuserId) return extra.reply("😂 Tu portes plainte contre toi-même ?");

      if (!np.isRegistered(accusedId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${accusedId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [accusedId]
        }, { quoted: msg });
      }

      // ── Vérifier s'il y a un crime récent (dans les 30s) ───────────────────
      const crime = np.getRecentCrime(accuserId);

      if (!crime) {
        // Fausse plainte — avertir le plaignant
        const p = np.getPlayer(accuserId);
        const warns = (p.prisonWarns || 0) + 1;
        np.updatePlayer(accuserId, { prisonWarns: warns });

        let msg2 = `⚠️ *FAUSSE PLAINTE !*\n\n` +
          `Aucun crime récent contre toi (dans les 30s).\n_Valable pour : .kill @toi et .rob @toi et .robbank @toi_\n\n` +
          `⚠️ Avertissement : *${warns}/${FALSE_WARN_LIMIT}*`;

        if (warns >= FALSE_WARN_LIMIT) {
          const duration = PRISON_MIN; // 30 min pour fausses plaintes répétées
          np.sendToPrison(accuserId, duration);
          np.updatePlayer(accuserId, { prisonWarns: 0 });
          msg2 += `\n\n🔒 *3 FAUSSES PLAINTES — TU ES EN PRISON 30min !*`;
        }

        return extra.reply(msg2);
      }

      // Crime trouvé, mais est-ce bien cet accusé ?
      if (crime.attackerId !== accusedId) {
        return await sock.sendMessage(extra.from, {
          text: `❌ Le crime récent n'a pas été commis par @${accusedId.split('@')[0]}!\nLe vrai coupable est quelqu'un d'autre.`,
          mentions: [accusedId]
        }, { quoted: msg });
      }

      // ── Plainte valide ! ──────────────────────────────────────────────────
      const accusedTag = np.tag(accusedId);
      const accuserTag = np.tag(accuserId);

      // Durée prison : aléatoire entre 30min et 1h
      const duration = Math.floor(Math.random() * (PRISON_MAX - PRISON_MIN)) + PRISON_MIN;
      np.sendToPrison(accusedId, duration);

      // Pénalité économique
      eco.removeCoins(accusedId, 300);

      await sock.sendMessage(extra.from, {
        text:
          `⚖️ *PLAINTE DÉPOSÉE !*\n` +
          `${'═'.repeat(28)}\n\n` +
          `📢 @${accuserTag.wa} 『 *${accuserTag.gn}* 』 accuse\n` +
          `🔒 @${accusedTag.wa} 『 *${accusedTag.gn}* 』\n\n` +
          `🚔 Crime : *${{'kill':'⚔️ Meurtre','attack':'👊 Agression','rob':'💰 Braquage','crime':'🦹 Crime'}[crime.type] || '🚔 Crime'}*\n` +
          `⏳ Prison : *${np.formatTime(duration)}*\n` +
          `💸 Amende : *-300 🪙*\n\n` +
          `_@${accusedTag.wa} : tape .justify pour tenter d'être libéré(e)_\n` +
          `_Ou un ami peut payer ta caution avec .caution @toi <montant>_`,
        mentions: [accuserId, accusedId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
