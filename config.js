'use strict';

/**
 * ゲーム調整用設定。
 * 数値やフリップ性能の多くは、このファイルだけで変更できます。
 */
window.GAME_CONFIG = {
  initialLives: 20,
  maxLives: 20,
  maxEnergy: 3,
  inventoryLimit: 4,
  rewardEveryRounds: 2,
  pairBaseScore: 100,
  roundBonusMultiplier: 50,
  resultDelayMs: 700,
  removeDelayMs: 650,
  toastDurationMs: 1600,

  layout: {
    minCardWidth: 48,
    maxCardWidth: 92,
    cardAspectRatio: 1.38,
    minimumGap: 8,
    maxRotationDeg: 11,
    powerRadiusInCardWidths: 2.25,
  },

  symbols: [
    '🌙', '☀️', '🌊', '🔥', '🌿', '⚡', '❄️', '🍀',
    '🪐', '⭐', '🦋', '🐚', '🍎', '🧿', '🎲', '🔔',
    '🗝️', '💎', '🪶', '🕯️', '🎭', '🧩', '🚀', '🪙',
    '🦊', '🐋', '🍄', '🌵', '🎈', '🎵', '🧲', '🪁'
  ],

  skills: {
    normal: {
      id: 'normal',
      name: '通常フリップ',
      rarity: 'basic',
      description: '選んだカードを1枚めくる。',
      targetMode: 'single',
      energyCost: 0,
    },
    double: {
      id: 'double',
      name: 'ダブル',
      rarity: 'common',
      description: '選んだカードと、最も近い裏向きカードをめくる。消費エネルギー1。',
      targetMode: 'nearest',
      energyCost: 1,
    },
    lucky: {
      id: 'lucky',
      name: 'ラッキーストライク',
      rarity: 'uncommon',
      description: '選んだ1枚と、ランダムな裏向きカード2枚をめくる。消費エネルギー2。',
      targetMode: 'randomTwo',
      energyCost: 2,
    },
    power: {
      id: 'power',
      name: 'パワーアタック',
      rarity: 'rare',
      description: '選んだカードと、その周囲にある裏向きカードをめくる。消費エネルギー3。',
      targetMode: 'radius',
      energyCost: 3,
    },
  },

  rewardSkillIds: ['double', 'lucky', 'power'],
};
