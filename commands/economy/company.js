/**
 * Company Command — Ouvrir et gérer son entreprise NeonParty
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const ent = require('../../utils/enterprise');

const OPEN_COST   = 4000;
const OPEN_BONUS  = 1500;
const BOT_COST    = 2000; // coût pour embaucher 1 bot worker

module.exports = {
  name: 'company',
  aliases: ['entreprise', 'corp', 'business', 'boite'],
  category: 'economy',
  description: 'Ouvrir et gérer son entreprise',
  usage: '.company | .company open <nom> | .company info | .company hirebot | .company close',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) {
        return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");
      }

      const sub = (args[0] || '').toLowerCase();
      const co  = ent.getCompany(extra.sender);

      // ── Ouvrir ─────────────────────────────────────────────────────────────
      if (sub === 'open' || sub === 'ouvrir' || sub === 'creer' || sub === 'créer') {
        if (co) return extra.reply(`❌ T'as déjà une entreprise : *${co.name}*`);
        const user = eco.getUser(extra.sender);
        if (user.coins < OPEN_COST) {
          return extra.reply(
            `❌ Il te faut *${OPEN_COST.toLocaleString()} 🪙* pour ouvrir une entreprise !\n` +
            `💰 Ton solde : *${user.coins.toLocaleString()} 🪙*\n` +
            `📉 Manque : *${(OPEN_COST - user.coins).toLocaleString()} 🪙*`
          );
        }

        const name = args.slice(1).join(' ') || `${np.getPlayer(extra.sender).username} Corp`;
        if (name.length > 32) return extra.reply('❌ Nom trop long (max 32 caractères)');

        eco.removeCoins(extra.sender, OPEN_COST);
        eco.addCoins(extra.sender,  OPEN_BONUS);
        ent.openCompany(extra.sender, name);

        return extra.reply(
          `🏢 *ENTREPRISE OUVERTE !* 🎉\n\n` +
          `📛 Nom : *${name}*\n` +
          `💸 Coût : *-${OPEN_COST.toLocaleString()} 🪙*\n` +
          `🎁 Bonus ouverture : *+${OPEN_BONUS.toLocaleString()} 🪙*\n\n` +
          `*Prochaines étapes :*\n` +
          `• *.hire @joueur* — Recruter un employé\n` +
          `• *.payworker @joueur <montant>* — Payer\n` +
          `• *.company info* — Voir les stats\n\n` +
          `_⚠️ Paie tes employés dans les 2min après leur .work !_`
        );
      }

      if (!co) {
        return extra.reply(
          `❌ T'as pas encore d'entreprise !\n\n` +
          `💰 Coût d'ouverture : *${OPEN_COST.toLocaleString()} 🪙*\n` +
          `🎁 Bonus reçu à l'ouverture : *+${OPEN_BONUS.toLocaleString()} 🪙*\n\n` +
          `Tape *.company open <nom>* pour créer la tienne`
        );
      }

      // ── Infos ──────────────────────────────────────────────────────────────
      if (!sub || sub === 'info' || sub === 'stats') {
        const rank    = ent.getCompanyRank(co.xp || 0);
        const nextR   = ent.getNextRank(co.xp || 0);
        const xpPct   = nextR ? Math.round(((co.xp - rank.xpRequired) / (nextR.xpRequired - rank.xpRequired)) * 10) : 10;
        const xpBar   = '█'.repeat(xpPct) + '░'.repeat(10 - xpPct);

        const emp     = (co.employees || []).length;
        const pending = Object.keys(co.pendingPay || {}).length;
        const botW    = co.botWorkers || 0;

        return extra.reply(
          `🏢 *${co.name}*\n` +
          `${'═'.repeat(30)}\n\n` +
          `📊 Rang : *${rank.name}*\n` +
          `⭐ XP : *${(co.xp || 0).toLocaleString()}*\n` +
          `[${xpBar}]\n` +
          (nextR ? `➡️ Prochain rang à *${nextR.xpRequired.toLocaleString()} XP*\n` : `🏆 Rang maximum!\n`) +
          `\n💰 Total gagné : *${(co.totalEarned || 0).toLocaleString()} 🪙*\n` +
          `👷 Employés : *${emp}*${pending > 0 ? ` (⚠️ ${pending} paiement(s) en attente)` : ''}\n` +
          `🤖 Bot-workers : *${botW}/${rank.botWorkers}* (${rank.level >= 10 ? 'débloqué' : `🔒 requis rang 10`})\n` +
          `⚡ Bonus de rang : *+${rank.workBonus} 🪙/travail*\n` +
          `${co.open ? '✅ Ouverte' : '🔒 Fermée'}\n\n` +
          `_Rangs 10+ = bot-workers disponibles_`
        );
      }

      // ── Fermer ─────────────────────────────────────────────────────────────
      if (sub === 'close' || sub === 'fermer') {
        ent.closeCompany(extra.sender);
        return extra.reply(`🔒 Entreprise *${co.name}* fermée.`);
      }

      // ── Embaucher un bot-worker ────────────────────────────────────────────
      if (sub === 'hirebot' || sub === 'botworker') {
        const rank = ent.getCompanyRank(co.xp || 0);
        if (rank.level < 10) {
          return extra.reply(
            `❌ Rang minimum *10 (Corp automatisée)* requis!\n` +
            `Tu es rang *${rank.level}* actuellement.\n` +
            `📈 XP manquant : *${(50000 - (co.xp || 0)).toLocaleString()}*`
          );
        }

        const result = ent.hireBotWorker(extra.sender);
        if (!result.ok) {
          if (result.reason === 'max_reached')
            return extra.reply(`❌ Nombre max de bot-workers atteint pour ton rang ! (${rank.botWorkers} max)`);
          return extra.reply(`❌ Impossible d'embaucher un bot-worker.`);
        }

        const user = eco.getUser(extra.sender);
        if (user.coins < BOT_COST) return extra.reply(`❌ Il te faut *${BOT_COST.toLocaleString()} 🪙* !`);
        eco.removeCoins(extra.sender, BOT_COST);

        return extra.reply(
          `🤖 *BOT-WORKER EMBAUCHÉ !*\n\n` +
          `💸 Coût : *-${BOT_COST.toLocaleString()} 🪙*\n` +
          `👷 Bot-workers actifs : *${result.count}/${rank.botWorkers}*\n` +
          `⏰ Ils travaillent toutes les *2 heures* automatiquement`
        );
      }

      return extra.reply(`❓ Sous-commande inconnue.\nUsage : *.company open/info/hirebot/close*`);

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
