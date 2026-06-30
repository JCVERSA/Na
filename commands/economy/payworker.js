/**
 * PayWorker Command — Payer un employé après son .work
 * Nebula Bot by Dark Neon
 * ⚠️ Must be done within 2 minutes of employee's .work
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const ent = require('../../utils/enterprise');

const PENALTY_EMPLOYER =  500;
const PENALTY_BONUS_WORKER = 700;
const MIN_PAY = 200;
const PRISON_THRESHOLD = 5;
const PRISON_DURATION  = 5 * 60 * 60 * 1000; // 5h

module.exports = {
  name: 'payworker',
  aliases: ['pw', 'salaire', 'payer', 'payw'],
  category: 'economy',
  description: 'Payer un employé après son travail (min 200 🪙)',
  usage: '.payworker @joueur <montant>',

  async execute(sock, msg, args, extra) {
    try {
      if (!np.isRegistered(extra.sender)) return extra.reply("❌ Inscris-toi : *.startneonparty <pseudo>*");

      const co = ent.getCompany(extra.sender);
      if (!co) return extra.reply("❌ T'as pas d'entreprise!");

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // ── Vérifier les paiements en retard (appelé automatiquement) ──────────
      const overdue = ent.checkOverduePay(extra.sender);
      for (const { workerId, amount } of overdue) {
        const workerUser = eco.getUser(workerId);
        const employer   = eco.getUser(extra.sender);
        const workerTag  = np.tag(workerId);

        // Pénalité patron
        eco.removeCoins(extra.sender, Math.min(PENALTY_EMPLOYER, employer.coins));
        // Bonus worker
        eco.addCoins(workerId, PENALTY_BONUS_WORKER);

        const co2 = ent.getCompany(extra.sender);
        const streak = (co2?.missedStreak || {})[workerId] || 0;

        await sock.sendMessage(extra.from, {
          text:
            `⚠️ *PAIEMENT EN RETARD !*\n\n` +
            `👷 @${workerTag.wa} 『 *${workerTag.gn}* 』 n'a pas été payé(e) !\n\n` +
            `💸 Pénalité patron : *-${PENALTY_EMPLOYER} 🪙*\n` +
            `💰 Compensation worker : *+${PENALTY_BONUS_WORKER} 🪙*\n\n` +
            `⚠️ Non-paiements consécutifs : *${streak}/5*\n` +
            (streak >= PRISON_THRESHOLD
              ? `🔒 *5 manquements atteints ! PRISON + FERMETURE !*`
              : `_Encore ${PRISON_THRESHOLD - streak} avant prison !_`),
          mentions: [extra.sender, workerId]
        });

        // Prison si 5 manquements consécutifs
        if (streak >= PRISON_THRESHOLD) {
          np.sendToPrison(extra.sender, PRISON_DURATION);
          ent.closeCompany(extra.sender);
          await sock.sendMessage(extra.from, {
            text:
              `🔒 *EMPRISONNEMENT !*\n\n` +
              `@${extra.sender.split('@')[0]} n'a pas payé ses employés 5 fois de suite !\n\n` +
              `⏳ Prison : *5 heures*\n` +
              `🏢 Entreprise *${co2?.name || '?'}* : *FERMÉE*\n\n` +
              `_Tape .justify pour tenter une libération anticipée_`,
            mentions: [extra.sender]
          });
        }
      }

      // ── Payer manuellement ────────────────────────────────────────────────
      if (!mentioned[0]) {
        const pending = Object.keys(co.pendingPay || {});
        if (!pending.length) {
          return extra.reply("✅ Aucun paiement en attente!\n_Attends que tes employés tapent .work_");
        }
        const lines = pending.map(id => {
          const info = co.pendingPay[id];
          const left = Math.max(0, info.deadline - Date.now());
          return `• @${id.split('@')[0]} — *${info.amount} 🪙* dû ⏳ ${np.formatTime(left)}`;
        });
        return await sock.sendMessage(extra.from, {
          text:
            `💼 *PAIEMENTS EN ATTENTE*\n\n` +
            lines.join('\n') +
            `\n\n_Tape .payworker @joueur <montant>_`,
          mentions: pending
        }, { quoted: msg });
      }

      const workerId = mentioned[0];
      const amount   = parseInt(args.find(a => /^\d+$/.test(a)));

      if (!amount || amount < MIN_PAY) {
        return extra.reply(`❌ Montant minimum : *${MIN_PAY} 🪙*\nEx: *.payworker @joueur 250*`);
      }

      const employer = eco.getUser(extra.sender);
      if (employer.coins < amount) {
        return extra.reply(`❌ Solde insuffisant ! Tu as *${employer.coins.toLocaleString()} 🪙*`);
      }

      const result = ent.payEmployee(extra.sender, workerId, amount);
      if (!result.ok) {
        if (result.reason === 'too_low')
          return extra.reply(`❌ Paye au minimum *${MIN_PAY} 🪙*!`);
        if (result.reason === 'no_company')
          return extra.reply("❌ T'as plus d'entreprise!");
        return extra.reply("❌ Erreur de paiement.");
      }

      eco.removeCoins(extra.sender, amount);
      eco.addCoins(workerId, amount);
      const workerTag = np.tag(workerId);

      await sock.sendMessage(extra.from, {
        text:
          `✅ *SALAIRE VERSÉ !*\n\n` +
          `👷 @${workerTag.wa} 『 *${workerTag.gn}* 』 reçoit *${amount.toLocaleString()} 🪙* !\n` +
          `💰 Ton solde : *${(employer.coins - amount).toLocaleString()} 🪙*\n\n` +
          `_Compteur de manquements remis à zéro ✅_`,
        mentions: [extra.sender, workerId]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};
