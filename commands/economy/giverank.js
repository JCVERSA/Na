/**
 * GiveRank Command — Owner sets a player's NeonParty game rank
 * Nebula Bot by Dark Neon
 */
const np = require('../../utils/neonparty');

// Mirror of PLAYER_RANKS from neonparty.js for display
const RANK_NAMES = [
  { level: 1,  name: '🪨 Mineur',         xpRequired: 0     },
  { level: 2,  name: '⚒️ Majeur',         xpRequired: 50    },
  { level: 3,  name: '🗡️ Apprenti',       xpRequired: 120   },
  { level: 4,  name: '⚔️ Combattant',     xpRequired: 250   },
  { level: 5,  name: '🛡️ Garde',          xpRequired: 450   },
  { level: 6,  name: '🔱 Soldat',         xpRequired: 700   },
  { level: 7,  name: '💪 Vétéran',        xpRequired: 1000  },
  { level: 8,  name: '🌟 Élite',          xpRequired: 1400  },
  { level: 9,  name: '🔥 Assassin',       xpRequired: 1900  },
  { level: 10, name: '💀 Chasseur',       xpRequired: 2500  },
  { level: 11, name: '🦅 Faucon',         xpRequired: 3300  },
  { level: 12, name: '🐯 Tigre',          xpRequired: 4300  },
  { level: 13, name: '🦁 Roi des bêtes',  xpRequired: 5500  },
  { level: 14, name: '⚡ Foudre',         xpRequired: 7000  },
  { level: 15, name: '🌀 Ninja',          xpRequired: 9000  },
  { level: 16, name: '🔮 Sorcier',        xpRequired: 11500 },
  { level: 17, name: '🌙 Spectre',        xpRequired: 14500 },
  { level: 18, name: '☢️ Démon',          xpRequired: 18000 },
  { level: 19, name: '🌌 Dieu du combat', xpRequired: 22500 },
  { level: 20, name: '👑 DARK LEGEND',    xpRequired: 28000 },
];

module.exports = {
  name: 'giverank',
  aliases: ['setrank', 'addrank', 'gr'],
  category: 'economy',
  description: '[OWNER] Set a player\'s NeonParty rank (1–20)',
  usage: '.giverank @player <rank 1-20>',

  async execute(sock, msg, args, extra) {
    try {
      const config = require('../../config');
      const isOwner = (config.ownerNumber || []).some(n => extra.sender.includes(n));
      if (!isOwner) return extra.reply('❌ This command is *owner only*!');

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // Show rank list if no args
      if (!mentioned[0] || !args.find(a => /^\d+$/.test(a))) {
        const rankList = RANK_NAMES.map(r =>
          `│  ◈ *${r.level}.* ${r.name} _(${r.xpRequired} XP)_`
        ).join('\n');
        return extra.reply(
          `👑 *GIVE RANK — OWNER*\n\n` +
          `Usage : *.giverank @player <level 1-20>*\n\n` +
          `╭─「 🏆 NEONPARTY RANKS 」\n` +
          rankList + '\n' +
          `╰${'─'.repeat(30)}\n\n` +
          `_Example: .giverank @user 15_`
        );
      }

      const targetId  = mentioned[0];
      const rankLevel = parseInt(args.find(a => /^\d+$/.test(a)));

      if (rankLevel < 1 || rankLevel > 20) {
        return extra.reply('❌ Rank must be between *1* and *20*!');
      }

      // Player must be registered in NeonParty
      if (!np.isRegistered(targetId)) {
        return extra.reply(
          `❌ This player is not registered in NeonParty!\n` +
          `_Ask them to use *.startneonparty* first._`
        );
      }

      const targetRank = RANK_NAMES[rankLevel - 1];
      const before     = np.getPlayer(targetId);
      const beforeRank = np.getPlayerRank(before.gameXp || 0);
      const tag        = targetId.split('@')[0];

      // Set XP to exactly the threshold of the target rank
      np.updatePlayer(targetId, {
        gameXp:    targetRank.xpRequired,
        gameLevel: targetRank.level
      });

      await sock.sendMessage(extra.from, {
        text:
          `👑 *OWNER RANK GRANT*\n` +
          `${'═'.repeat(30)}\n\n` +
          `👤 @${tag}\n\n` +
          `${'─'.repeat(30)}\n` +
          `🏆 Rank before : *${beforeRank.name}* (Lv.${beforeRank.level})\n` +
          `🚀 Rank after  : *${targetRank.name}* (Lv.${targetRank.level})\n` +
          `✨ Game XP set : *${targetRank.xpRequired.toLocaleString()}*\n\n` +
          `🎉 *${tag} has been promoted by the owner!* 🎉\n\n` +
          `> _Powered by Nebula Bot_ 👑`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
