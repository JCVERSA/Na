/**
 * Rob Bank Command — Braquer la banque d'un joueur
 * Nebula Bot by Dark Neon
 * 20% de chance de réussir. Si pris :
 *   - Payer 5000 coins (si assez) OU
 *   - Prélèvement direct sur la banque OU
 *   - Si trop pauvre → dette remboursée sur les gains de .work
 */

const eco = require('../../utils/economy');
const np  = require('../../utils/neonparty');

const COOLDOWN    = 2 * 60 * 60 * 1000; // 2h
const FINE        = 5000;
const SUCCESS_PCT = 20; // 20% de succès

module.exports = {
  name: 'robbank',
  aliases: ['bankrob', 'braquer'],
  category: 'economy',
  description: 'Braquer la banque d\'un joueur (20% de succès, très risqué!)',
  usage: '.robbank @joueur',

  async execute(sock, msg, args, extra) {
    try {
      // ── Vérifications NeonParty ──────────────────────────────────────────
      if (!np.isRegistered(extra.sender))
        return extra.reply("❌ Tu n'es pas dans NeonParty !\nTape *.startneonparty <pseudo>* pour rejoindre.");
      if (np.isInPrison(extra.sender))
        return extra.reply(
          `🔒 *Tu es en prison !*\n\nImpossible de braquer depuis la cellule...\n` +
          `⏳ Libéré dans : *${np.formatTime(np.timeUntilRelease(extra.sender))}*`
        );
      if (!np.isAlive(extra.sender))
        return extra.reply(`💀 *Tu es mort !*\nImpossible de braquer... ressuscite d'abord.`);

      // ── Cooldown ─────────────────────────────────────────────────────────
      const robber  = eco.getUser(extra.sender);
      const lastRob = robber.lastRobBank || 0;
      const elapsed = Date.now() - lastRob;
      if (elapsed < COOLDOWN) {
        const rem = COOLDOWN - elapsed;
        return extra.reply(`🚔 *Trop tôt !*\n\nAttends encore : *${eco.formatTime(rem)}* avant le prochain braquage.`);
      }

      // ── Cible ─────────────────────────────────────────────────────────────
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) return extra.reply('❌ Mentionne la cible !\nEx: *.robbank @joueur*');
      const targetId = mentioned[0];

      if (targetId === extra.sender) return extra.reply('😂 Braquer ta propre banque ? Tape .bank à la place !');
      if (!np.isRegistered(targetId)) {
        return await sock.sendMessage(extra.from, {
          text: `❌ @${targetId.split('@')[0]} n'est pas dans NeonParty!`,
          mentions: [targetId]
        }, { quoted: msg });
      }

      const victim = eco.getUser(targetId);
      const bank   = victim.bank || 0;

      if (bank < 500)
        return await sock.sendMessage(extra.from, {
          text: `🏦 @${targetId.split('@')[0]} n'a même pas 500 🪙 en banque... va voler quelqu'un de riche !`,
          mentions: [targetId]
        }, { quoted: msg });

      // ── Jet de dé ─────────────────────────────────────────────────────────
      eco.updateUser(extra.sender, { lastRobBank: Date.now() });
      const success = Math.random() * 100 < SUCCESS_PCT;
      const robberTag = np.tag(extra.sender);
      const victimTag = np.tag(targetId);

      if (success) {
        // Voler entre 15% et 40% de la banque
        const pct    = Math.floor(Math.random() * 25) + 15;
        const stolen = Math.max(200, Math.floor((bank * pct) / 100));
        const actual = Math.min(stolen, bank);

        eco.updateUser(targetId, { bank: bank - actual });
        eco.addCoins(extra.sender, actual);
        eco.addXP(extra.sender, 20);
        np.recordCrime(extra.sender, targetId, 'rob');

        return await sock.sendMessage(extra.from, {
          text:
            `🏦💥 *BRAQUAGE RÉUSSI !*\n` +
            `${'═'.repeat(28)}\n\n` +
            `🔫 @${robberTag.wa} a pillé la banque de @${victimTag.wa} !\n\n` +
            `💸 Butin : *+${actual.toLocaleString()} 🪙* (${pct}% de la banque)\n` +
            `💰 Ton solde : *${(robber.coins + actual).toLocaleString()} 🪙*\n\n` +
            `😱 @${victimTag.wa} : *-${actual.toLocaleString()} 🪙* de ta banque !\n` +
            `💡 _Sécurise ton argent avec .bank et achète un .shop shield_`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

      // ── ÉCHEC — se faire attraper ─────────────────────────────────────────
      // Scénario 1 : assez de coins pour payer l'amende
      if (robber.coins >= FINE) {
        eco.removeCoins(extra.sender, FINE);
        const after = eco.getUser(extra.sender);
        return await sock.sendMessage(extra.from, {
          text:
            `🚔 *BRAQUAGE RATÉ — ARRÊTÉ !*\n` +
            `${'═'.repeat(28)}\n\n` +
            `👮 @${robberTag.wa} s'est fait attraper en flagrant délit !\n\n` +
            `💸 Amende payée : *-${FINE.toLocaleString()} 🪙*\n` +
            `💰 Solde restant : *${after.coins.toLocaleString()} 🪙*\n\n` +
            `⏳ Prochain braquage dans : *2h*\n` +
            `_Tu aurais dû acheter un meilleur plan..._`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

      // Scénario 2 : pas assez de coins → ponctionner la banque du braqueur
      const robberBank = robber.bank || 0;
      if (robberBank >= FINE) {
        eco.updateUser(extra.sender, { bank: robberBank - FINE });
        return await sock.sendMessage(extra.from, {
          text:
            `🚔 *BRAQUAGE RATÉ — ARRÊTÉ !*\n` +
            `${'═'.repeat(28)}\n\n` +
            `👮 @${robberTag.wa} s'est fait attraper !\n` +
            `💳 Pas assez en poche → l'amende a été prélevée sur ta banque !\n\n` +
            `🏦 Amende banque : *-${FINE.toLocaleString()} 🪙*\n` +
            `🏦 Solde banque restant : *${(robberBank - FINE).toLocaleString()} 🪙*\n\n` +
            `⏳ Prochain braquage dans : *2h*`,
          mentions: [extra.sender, targetId]
        }, { quoted: msg });
      }

      // Scénario 3 : trop pauvre partout → dette sur les gains de .work
      const debtTotal = FINE - robber.coins - robberBank;
      const wipeCoins = robber.coins;
      const wipeBank  = robberBank;
      eco.updateUser(extra.sender, { coins: 0, bank: 0 });
      eco.addBankDebt(extra.sender, debtTotal);

      return await sock.sendMessage(extra.from, {
        text:
          `🚔 *BRAQUAGE RATÉ — TOTALEMENT RUINÉ !*\n` +
          `${'═'.repeat(28)}\n\n` +
          `👮 @${robberTag.wa} s'est fait attraper !\n` +
          `💸 Tous tes coins confisqués : *-${(wipeCoins + wipeBank).toLocaleString()} 🪙*\n` +
          `😱 Tu dois encore : *${debtTotal.toLocaleString()} 🪙*\n\n` +
          `⚠️ *DETTE ACTIVE !*\n` +
          `Chaque gain de *.work* ira directement rembourser la dette jusqu'à zéro !\n\n` +
          `⏳ Prochain braquage dans : *2h*\n` +
          `_La prochaine fois, épargne avant de braquer..._`,
        mentions: [extra.sender, targetId]
      }, { quoted: msg });

    } catch (err) {
      await extra.reply(`❌ Erreur: ${err.message}`);
    }
  }
};
