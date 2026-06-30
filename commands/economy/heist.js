/**
 * Heist Command — Braquage de groupe (plusieurs joueurs, loot partagé)
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

const heists = new Map(); // from -> { leader, members, bet, timeout, started }

module.exports = {
  name: 'heist',
  aliases: ['braquage', 'casse', 'raid'],
  category: 'economy',
  description: 'Organiser un braquage de groupe (2-5 joueurs)',
  usage: '.heist <mise> | .heist join | .heist start',
  groupOnly: true,
  async execute(sock, msg, args, extra) {
    try {
      const sub = (args[0] || '').toLowerCase();

      // ── Rejoindre ───────────────────────────────────────────────────────
      if (sub === 'join' || sub === 'rejoindre') {
        const h = heists.get(extra.from);
        if (!h) return extra.reply('❌ Pas de braquage en cours! Tape *.heist <mise>* pour en lancer un');
        if (h.started) return extra.reply('❌ Le braquage est déjà commencé!');
        if (h.members.includes(extra.sender)) return extra.reply('❌ T\'es déjà dans l\'équipe!');
        if (h.members.length >= 5) return extra.reply('❌ Équipe complète (5 max)!');

        const user = eco.getUser(extra.sender);
        if (user.coins < h.bet) return extra.reply(`❌ Il te faut *${h.bet} 🪙* pour rejoindre!`);

        h.members.push(extra.sender);
        await sock.sendMessage(extra.from, {
          text: `👥 @${extra.sender.split('@')[0]} rejoint le braquage ! (${h.members.length}/5)\n_Tape .heist start pour commencer ou attends 2min_`,
          mentions: [extra.sender]
        }, { quoted: msg });
        return;
      }

      // ── Démarrer ────────────────────────────────────────────────────────
      if (sub === 'start' || sub === 'commencer') {
        const h = heists.get(extra.from);
        if (!h) return extra.reply('❌ Pas de braquage en attente!');
        if (h.leader !== extra.sender) return extra.reply('❌ Seul le leader peut démarrer!');
        if (h.members.length < 2) return extra.reply('❌ Minimum 2 joueurs pour braquer!');
        h.started = true;
        clearTimeout(h.timeout);
        await executHeist(sock, msg, extra.from, h);
        heists.delete(extra.from);
        return;
      }

      // ── Lancer un braquage ──────────────────────────────────────────────
      if (heists.has(extra.from)) return extra.reply('❌ Un braquage est déjà en cours! Tape *.heist join* pour rejoindre');

      const bet = parseInt(args[0]);
      if (!bet || bet < 100) return extra.reply('❌ Mise minimum *100 🪙*\nEx: *.heist 500*');
      if (bet > 5000) return extra.reply('❌ Mise max *5,000 🪙*');

      const user = eco.getUser(extra.sender);
      if (user.coins < bet) return extra.reply(`❌ Solde insuffisant! Tu as *${user.coins} 🪙*`);

      const timeout = setTimeout(async () => {
        const h = heists.get(extra.from);
        if (!h || h.started) return;
        if (h.members.length >= 2) {
          h.started = true;
          await executHeist(sock, msg, extra.from, h);
        } else {
          await sock.sendMessage(extra.from, { text: '❌ Braquage annulé — pas assez de membres!' });
        }
        heists.delete(extra.from);
      }, 120000);

      heists.set(extra.from, { leader: extra.sender, members: [extra.sender], bet, timeout, started: false });

      await sock.sendMessage(extra.from, {
        text:
          `🔫 *BRAQUAGE ORGANISÉ !*\n\n` +
          `👤 Leader : @${extra.sender.split('@')[0]}\n` +
          `💰 Mise : *${bet} 🪙* par personne\n\n` +
          `Tape *.heist join* pour rejoindre l\'équipe!\n` +
          `_(2-5 joueurs, 2min pour recruter)_`,
        mentions: [extra.sender]
      }, { quoted: msg });

    } catch(e) { await extra.reply(`❌ Erreur: ${e.message}`); }
  }
};

async function executHeist(sock, msg, groupId, h) {
  const { members, bet } = h;
  const pot = bet * members.length;

  // Vérifier les soldes
  const valid = members.filter(m => {
    const u = eco.getUser(m);
    return u.coins >= bet;
  });

  if (valid.length < 2) {
    return sock.sendMessage(groupId, { text: '❌ Braquage annulé — certains membres n\'ont plus assez de coins!', mentions: members });
  }

  for (const m of valid) eco.removeCoins(m, bet);
  const actualPot = bet * valid.length;

  // Chance de succès selon le nombre de membres
  const successChance = 30 + valid.length * 10; // 40%-80%
  const success = Math.random() * 100 < successChance;

  const mentions = valid;

  if (success) {
    // Loot aléatoire entre 1.5x et 3x la mise
    const mult  = 1.5 + Math.random() * 1.5;
    const total = Math.floor(actualPot * mult);
    const each  = Math.floor(total / valid.length);

    for (const m of valid) { eco.addCoins(m, each); eco.addXP(m, 30); }

    const lines = valid.map(m => `• @${m.split('@')[0]} : +${each} 🪙`);
    await sock.sendMessage(groupId, {
      text:
        `🔫 *BRAQUAGE RÉUSSI !* 💰\n\n` +
        `👥 Équipe : ${valid.length} membres\n` +
        `💎 Butin total : *${total.toLocaleString()} 🪙*\n\n` +
        `*Distribution :*\n${lines.join('\n')}\n\n` +
        `_On est ensemble bg !_ 🤝`,
      mentions
    });
  } else {
    const fines = ['Interpellés à la sortie 🚔', 'La banque avait des détecteurs secrets 🚨', 'Un complice a craqué sous la pression 😤', 'Les caméras étaient partout 📷'];
    const why   = fines[Math.floor(Math.random() * fines.length)];
    await sock.sendMessage(groupId, {
      text:
        `🚔 *BRAQUAGE RATÉ !*\n\n` +
        `❌ ${why}\n\n` +
        `👥 Tout le monde a perdu *${bet} 🪙*\n` +
        `💸 Total perdu : *${actualPot.toLocaleString()} 🪙*\n\n` +
        `_Recommence avec une meilleure équipe !_`,
      mentions
    });
  }
}
