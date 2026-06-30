/**
 * GiveLevel Command — Owner adds levels to a player
 * Nebula Bot by Dark Neon
 */
const eco = require('../../utils/economy');

module.exports = {
  name: 'givelevel',
  aliases: ['addlevel', 'givexp', 'gl'],
  category: 'economy',
  description: '[OWNER] Add levels to a player',
  usage: '.givelevel @player <amount>',

  async execute(sock, msg, args, extra) {
    try {
      const config = require('../../config');
      const isOwner = (config.ownerNumber || []).some(n => extra.sender.includes(n));
      if (!isOwner) return extra.reply('❌ This command is *owner only*!');

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned[0]) {
        return extra.reply(
          `🌟 *GIVE LEVEL — OWNER*\n\n` +
          `Usage : *.givelevel @player <levels>*\n` +
          `Ex    : *.givelevel @user 5*\n\n` +
          `_Grants the specified number of levels instantly._`
        );
      }

      const targetId = mentioned[0];
      const amount   = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount <= 0) return extra.reply('❌ Please enter a valid level amount!');

      const before     = eco.getUser(targetId);
      const newLevel   = (before.level || 1) + amount;
      eco.setLevel(targetId, newLevel);
      const after      = eco.getUser(targetId);
      const tag        = targetId.split('@')[0];
      const titleBefore = eco.getTitle(before.level);
      const titleAfter  = eco.getTitle(after.level);

      await sock.sendMessage(extra.from, {
        text:
          `👑 *OWNER LEVEL GRANT*\n` +
          `${'═'.repeat(30)}\n\n` +
          `👤 @${tag}\n` +
          `📈 Levels added : *+${amount}*\n\n` +
          `${'─'.repeat(30)}\n` +
          `⭐ Level : *${before.level}* → *${after.level}*\n` +
          `🏷️ Title : ${titleBefore} → *${titleAfter}*\n` +
          `\n> _Powered by Nebula Bot_ 👑`,
        mentions: [targetId]
      }, { quoted: msg });

    } catch (e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
