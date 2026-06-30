/**
 * NGame Command v5 — NeonParty RPG Menu (Malvin-XD style)
 * Nebula Bot by Dark Neon
 */
const np  = require('../../utils/neonparty');
const eco = require('../../utils/economy');
const ent = require('../../utils/enterprise');

module.exports = {
  name: 'ngame',
  aliases: ['neonmenu', 'jeu', 'rpgmenu', 'game'],
  category: 'economy',
  description: 'NeonParty RPG game menu',
  usage: '.ngame',

  async execute(sock, msg, args, extra) {
    try {
      const cfg        = require('../../config');
      const p          = cfg.prefix || '.';
      const registered = np.isRegistered(extra.sender);
      const pf         = registered ? np.getPlayer(extra.sender) : null;
      const alive      = registered ? np.isAlive(extra.sender) : false;
      const inJail     = registered ? np.isInPrison(extra.sender) : false;
      const co         = registered ? ent.getCompany(extra.sender) : null;
      const delay      = (ms) => new Promise(r => setTimeout(r, ms));

      // ── Style helpers (Malvin-XD) ─────────────────────────────────────────
      const DIVIDER = '┄'.repeat(22);

      function section(emoji, title, lines) {
        const body = lines.map(l => l === '' ? '│' : `│  ◈  ${l}`).join('\n');
        return `╭─「 ${emoji} *${title}* 」\n${body}\n╰${DIVIDER}`;
      }

      const c = (cmd, desc) => desc ? `\`${p}${cmd}\` — _${desc}_` : `\`${p}${cmd}\``;

      // ══════════════════════════════════════════
      //  MSG 1 — PLAYER STATUS CARD
      // ══════════════════════════════════════════
      let msg1;

      if (!registered) {
        msg1 =
          `╭══〘〘 \`⚔️ NEON PARTY\` 〙〙═⊷\n` +
          `│↠🌌 ᴛʜᴇ ɴᴇʙᴜʟᴀ ʙᴏᴛ ʀᴘɢ\n` +
          `│↠⚠️ sᴛᴀᴛᴜs: *Not Registered*\n` +
          `╰═══════════════════════⊷\n\n` +
          `╭─「 🎮 *HOW TO JOIN* 」\n` +
          `│  ◈  \`${p}startneonparty <username>\`\n` +
          `│  ◈  _Username: 2-16 chars (letters, numbers, - _)\n` +
          `│  ◈  🎁 Welcome bonus: *+500 🪙*\n` +
          `╰${DIVIDER}\n\n` +
          `> _Type .ngame again after registering to see all commands!_`;
      } else {
        const w      = pf.weapon && np.WEAPON_STATS[pf.weapon];
        const a      = pf.armor  && np.ARMOR_STATS[pf.armor];
        const rank   = np.getPlayerRank(pf.gameXp || 0);
        const nextR  = np.getNextPlayerRank(pf.gameXp || 0);
        const ecoU   = eco.getUser(extra.sender);
        const powers = np.getPowers(extra.sender);
        const now    = Date.now();

        const wInfo = w
          ? `${w.emoji} *${w.name}* ${pf.weaponExpiry && pf.weaponExpiry > now ? `⏳${np.formatTime(pf.weaponExpiry - now)}` : '♾️'}`
          : '🤜 *Bare Hands*';
        const aInfo = a
          ? `${a.emoji} *${a.name}* ${pf.armorExpiry && pf.armorExpiry > now ? `⏳${np.formatTime(pf.armorExpiry - now)}` : '♾️'}`
          : '🚫 *No Armor*';

        let statusEmoji, statusTxt;
        if (inJail)      { statusEmoji = '🔒'; statusTxt = `PRISON  ⏳${np.formatTime(np.timeUntilRelease(extra.sender))}`; }
        else if (!alive) { statusEmoji = '💀'; statusTxt = `DEAD  ⏳${np.formatTime(np.timeUntilRevive(extra.sender))}`; }
        else             { statusEmoji = '💚'; statusTxt = 'ALIVE'; }

        const hpBar  = np.hpBar(alive ? pf.hp : 0, pf.maxHp);
        const xpLeft = nextR
          ? `→ *${(nextR.xpRequired - (pf.gameXp || 0)).toLocaleString()} XP* to ${nextR.name}`
          : '🌌 *MAX RANK*';
        const pwList = powers.length ? powers.map(pw => `✨\`${pw.id}\``).join('  ') : '_No powers_';

        msg1 =
          `╭══〘〘 \`⚔️ NEON PARTY\` 〙〙═⊷\n` +
          `│↠👤 ɴᴀᴍᴇ: *${pf.username.toUpperCase()}*\n` +
          `│↠${statusEmoji} sᴛᴀᴛᴜs: ${statusTxt}\n` +
          `│↠🏆 ʀᴀɴᴋ: *${rank.name}* (×${rank.dmgMult} DMG)\n` +
          `│↠⭐ xᴘ: *${(pf.gameXp || 0).toLocaleString()}*  ${xpLeft}\n` +
          `│↠🔪 ᴋɪʟʟs: *${pf.killCount || 0}*  💀 ᴅᴇᴀᴛʜs: *${pf.deathCount || 0}*\n` +
          `│↠💰 ᴄᴏɪɴs: *${(ecoU.coins || 0).toLocaleString()} 🪙*\n` +
          `╰═══════════════════════⊷\n\n` +
          `╭─「 ⚔️ *LOADOUT* 」\n` +
          `│  ◈  ❤️ HP : ${hpBar}  *${pf.hp}/${pf.maxHp}*\n` +
          `│  ◈  ⚔️ Weapon : ${wInfo}\n` +
          `│  ◈  🛡️ Armor  : ${aInfo}\n` +
          `│  ◈  ✨ Powers : ${pwList}\n` +
          `│  ◈  💍 ${pf.marriedTo ? `Married to *${pf.spouseName}*` : 'Single'}\n` +
          `│  ◈  🏢 ${co ? `*${co.name}*  ${co.open ? '✅' : '🔒'}` : 'No company'}\n` +
          `╰${DIVIDER}`;
      }

      // ══════════════════════════════════════════
      //  MSG 2 — ECONOMY, COMBAT & JUSTICE
      // ══════════════════════════════════════════
      const msg2 = [
        section('💰', 'ECONOMY', [
          c('balance',        'Full economic profile'),
          c('bank deposit/withdraw <amount>', 'Manage your bank (safe from rob)'),
          c('inventory',      'View your items'),
          c('daily',          'Daily reward + streak bonus 🔥'),
          c('collect',        'Passive income (every 2h)'),
          c('streak',         'Your daily streak details'),
          c('levels',         'All titles and your progression'),
        ]),
        section('⚔️', 'COMBAT & SURVIVAL', [
          c('kill @player',        'Attack — damage based on your rank'),
          c('revive [@player]',    'Revive yourself or an ally (power required)'),
          c('heal',                'Use a healing potion (+50 HP)'),
          c('equip <id>',          'Equip weapon / armor / power'),
          c('equip unequip weapon','Unequip your weapon'),
          c('equip unequip armor', 'Unequip your armor'),
        ]),
        section('⚖️', 'JUSTICE & PRISON', [
          c('plainte @player',             'File a complaint — within 30s of a crime'),
          c('prison [@player]',            'Check prison status'),
          c('justify',                     'Try to get released (20-25% chance)'),
          c('caution @player <amount>',    'Pay bail for a prisoner (min 500 🪙)'),
          '',
          '⚠️ _3 false complaints = auto prison!_',
          '⚠️ _In prison you can only use .justify_',
        ]),
        section('🎁', 'SHARING & TRADES', [
          c('share @player <amount>',  'Share coins with someone'),
          c('share @player item <id>', 'Gift an item from your inventory'),
          c('pay @player <amount>',    'Transfer coins (alias of share coins)'),
          c('gift @player <id>',       'Gift an item directly'),
        ]),
        section('🎯', 'DROP SYSTEM', [
          c('drop <amount>',     'Drop coins on the floor — 1 min to pick up!'),
          c('drop item <id>',    'Drop an inventory item on the floor'),
          c('pickup',            'See available drops in this group'),
          c('pickup <id>',       'Pick up a specific drop'),
          c('pickup last',       'Pick up the last available drop'),
          '',
          '⚠️ _1 minute to pick up or it is lost forever!_',
        ]),
        section('📋', 'PROFILE & RANKINGS', [
          c('gprofile [@player]',   'Full game profile'),
          c('gamerank [@player]',   'Combat rank + all 20 levels'),
          c('pvprank',              'Top 10 killers — PVP leaderboard'),
          c('richlist',             'Richest players ranking'),
          c('topxp',                'Players ranked by XP level'),
          c('setgamename <name>',   'Change your game username'),
          c('stopneonparty',        'Leave NeonParty (coins kept)'),
        ]),
      ].join('\n\n');

      // ══════════════════════════════════════════
      //  MSG 3 — SHOP & WEAPONS
      // ══════════════════════════════════════════
      const msg3 = [
        section('🛒', 'SHOP — .shop weapon / armor / power', [
          '⚔️ *WEAPONS*',
          '',
          '♾️ *Permanent* _(unlimited charges)_',
          '`🗡️ dagger +15`  `⚔️ sword +25`  `🪓 axe +30`',
          '`🗡️ katana +45`  `🔫 pistol +35`',
          '',
          '⏳ *Temporary* _(charges + expiry)_',
          '`🔫 ak47 +50` _(7d)_   `🎯 sniper +75`   `💣 grenade +55`',
          '`🚀 bazooka +80`   `🌀 rasengan +90`   `⚡ chidori +95`',
          '`🌙 getsuga +110`',
          '`☢️ I AM ATOMIC +200` _(50 000 🪙 — 1 charge only)_',
        ]),
        section('🛡️', 'ARMORS', [
          '♾️ *Permanent* _(yours forever)_',
          '`🧥 leather -10`   `⛑️ helmet -15`   `🌟 godshield -70`',
          '',
          '⏳ *Temporary*',
          '`🛡️ shield2 -25` _(7 days)_',
          '`🦺 armor -35` _(14 days)_',
          '`🔰 titanium -50` _(30 days)_',
        ]),
        section('✨', 'POWERS', [
          '⚡ *Offensive*',
          '`🎯 chance` _+20% dmg (1h)_',
          '`☠️ poison` _+20 dmg/hit (3 charges)_',
          '`😤 berserker` _+50% atk / -30% def (30min)_',
          '',
          '🛡️ *Defensive*',
          '`👁️ sharingan` _35% dodge (2 charges)_',
          '`👻 invisible` _immunity to 1 attack (1 charge)_',
          '`🔮 barrier` _absorbs 30 dmg/hit (3h)_',
          '`⏱️ time_stop` _total immunity 5 min_',
          '',
          '💊 *Healing*',
          '`💊 healing` _+50 HP (1 charge)_',
          '`🧬 super_heal` _+100 HP + immunity 10 min_',
          '`🌿 regen` _+5 HP per hit received (2h)_',
          '',
          '💫 *Special*',
          '`💫 revive_power` _revive yourself or an ally_',
          '',
          `_Use \`${p}buy <id>\` then \`${p}equip <id>\` to activate_`,
        ]),
      ].join('\n\n');

      // ══════════════════════════════════════════
      //  MSG 4 — ACTIVITIES, GAMES & BETS
      // ══════════════════════════════════════════
      const msg4 = [
        section('⛏️', 'ACTIVITIES & EARNINGS', [
          c('work',              'Work for coins (30min cooldown)'),
          c('mine',              'Mine resources (15min)'),
          c('fish',              'Go fishing 🎣 (10min)'),
          c('hunt',              'Go hunting 🏹 (20min)'),
          c('beg',               'Beg for coins 🙏'),
          c('crime',             'Commit a crime (risky, 1h cooldown)'),
          c('rob @player',       'Try to steal from someone (risky!)'),
          c('robbank @player',   'Rob the BANK — 20% success, very risky!'),
        ]),
        section('🎲', 'GAMES & BETS', [
          c('gamble <amount>',              '50/50 bet — double or nothing!'),
          c('blackjack <amount>',           'Blackjack vs the bot 🃏'),
          c('coinflip @player <amount>',    'Challenge someone to coin flip 🪙'),
          c('dice <face> <amount>',         'Bet on a dice roll 🎲'),
          c('slots <amount>',               'Slot machine 🎰 (5min cooldown)'),
          c('wheel <amount>',               'Wheel of fortune 🎡 (10min cooldown)'),
          c('scratch',                      'Scratch card 🎫 (1h cooldown)'),
          c('lottery <nb tickets>',         'Buy lottery tickets (100 🪙 each)'),
          c('duel @player <amount>',        'Challenge someone to a duel'),
          c('heist @p1 [@p2...]',           'Group heist 2-5 players 🔫'),
        ]),
        section('📈', 'INVESTMENTS & BOUNTIES', [
          c('invest <amount>',              'Invest coins (24h return, -30% to +80%)'),
          c('loan <amount>',                'Borrow coins (repay in 48h +25% interest)'),
          c('bounty @player <amount>',      'Put a bounty on someone'),
          c('bounty claim @player',         'Claim a bounty after a kill'),
          '',
          '⚠️ _Bounty is auto-claimed after a kill!_',
        ]),
      ].join('\n\n');

      // ══════════════════════════════════════════
      //  MSG 5 — COMPANY, FAMILY, MARKET & OWNER
      // ══════════════════════════════════════════
      const msg5 = [
        section('🏢', 'COMPANY', [
          '💰 _Opening cost: 4 000 🪙 | Bonus: +1 500 🪙_',
          '📈 _20 ranks (Freelancer → Dark Neon Corp)_',
          '🤖 _Bot-workers unlock at rank 10_',
          '',
          c('company open <name>',     'Open your company'),
          c('company info',            'Stats, rank and XP'),
          c('company hirebot',         'Hire a bot-worker (rank 10+, 2000 🪙)'),
          c('hire @player',            'Recruit a player'),
          c('hire fire @player',       'Fire a player'),
          c('hire list',               'List your employees'),
          c('payworker @player <amt>', 'Pay an employee (min 200 🪙 within 2 min!)'),
          '',
          '⚠️ _Not paid in 2min: -500 🪙 boss / +700 🪙 worker_',
          '⚠️ _5 failures = PRISON 5H + COMPANY CLOSED_',
        ]),
        section('💍', 'FAMILY & RELATIONS', [
          '_Marriage costs 1 000 🪙 (received by partner)_',
          '_Adoption requires min 800 🪙 in pocket_',
          '',
          c('marry @player',   'Marriage proposal'),
          c('marry accept',    'Accept a proposal'),
          c('marry refuse',    'Refuse a proposal'),
          c('divorce',         'Separate from your partner'),
          c('adopt @player',   'Propose an adoption'),
          c('adopt accept',    'Accept an adoption'),
          c('family [@player]','View family tree'),
        ]),
        section('🏪', 'PLAYER MARKET', [
          c('market open',              'Open your market (10 000 🪙)'),
          c('market @player see',       'View a player\'s listings'),
          c('market all',               'See all active listings'),
          c('market info',              'Your market profile and rank'),
          c('put <itemId> <price>',     'List an item for sale'),
          c('remove <itemId>',          'Remove an item from your market'),
          c('buy <listing ID>',         'Buy an item (ID starts with mkt_)'),
          '',
          '💡 _Every 3 sales = +2 000 🪙 + level up!_',
        ]),
        section('🖼️', 'AVATAR', [
          c('avatar',               'View your current avatar'),
          c('avatar <emoji>',       'Set an emoji as your avatar'),
          c('avatar (attach image)','Set an image as your avatar'),
          '',
          '💡 _Avatar shows on your .gprofile!_',
        ]),
        section('👑', 'OWNER ONLY', [
          c('givecoins @player <amount>', 'Give coins to a player (unlimited balance)'),
          c('givelevel @player <amount>', 'Add levels to a player instantly'),
          c('giverank @player <1-20>',    'Set a player\'s NeonParty rank (1-20)'),
        ]),
      ].join('\n\n') +
        '\n\n' +
        `╭══════════════════════════════╮\n` +
        `│  🛒 \`${p}shop weapon / armor / power\`\n` +
        `│  📦 \`${p}buy <id>\` → powers activate instantly!\n` +
        `│  🎮 \`${p}me <emoji/word>\` → mini-game (every 2h)\n` +
        `│  💰 \`${p}daily\` → daily reward\n` +
        `│  ⛏️  \`${p}work / .mine / .fish / .hunt\`\n` +
        `│  🎲 \`${p}gamble / .blackjack / .slots\`\n` +
        `│  🎯 \`${p}drop <amount>\` / \`${p}pickup\`\n` +
        `│  📋 \`${p}gprofile\` → full game profile\n` +
        `╰══════════════════════════════╯\n` +
        `> 🌌 *NeonParty v5* — _by Dark Neon_ 👑`;

      await sock.sendMessage(extra.from, { text: msg1 }, { quoted: msg });
      await delay(500);
      await sock.sendMessage(extra.from, { text: msg2 });
      await delay(500);
      await sock.sendMessage(extra.from, { text: msg3 });
      await delay(500);
      await sock.sendMessage(extra.from, { text: msg4 });
      await delay(500);
      await sock.sendMessage(extra.from, { text: msg5 });

    } catch(e) { await extra.reply(`❌ Error: ${e.message}`); }
  }
};
