'use strict';

(() => {
  const CONFIG = window.GAME_CONFIG;
  const $ = (selector) => document.querySelector(selector);

  const SUITS = ['spade', 'club', 'heart', 'diamond'];
  const SUIT_ICONS = { spade: '♠', club: '♣', heart: '♥', diamond: '♦' };
  const SUIT_COLORS = { spade: 'black', club: 'black', heart: 'red', diamond: 'red' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // ラウンド1は2枚、以降は毎ラウンド5枚ずつ追加し、全11ラウンドで52枚に到達する。
  const ROUND_SIZES = [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52];

  const els = {
    board: $('#board'),
    powerPreview: $('#powerPreview'),
    toast: $('#toast'),
    roundValue: $('#roundValue'),
    turnValue: $('#turnValue'),
    lifeValue: $('#lifeValue'),
    energyValue: $('#energyValue'),
    scoreValue: $('#scoreValue'),
    phaseLabel: $('#phaseLabel'),
    actionPrompt: $('#actionPrompt'),
    slot1Summary: $('#slot1Summary'),
    slot2Summary: $('#slot2Summary'),
    inventory: $('#inventory'),
    passButton: $('#passButton'),
    comboValue: $('#comboValue'),

    roundModal: $('#roundModal'),
    roundModalTitle: $('#roundModalTitle'),
    roundModalText: $('#roundModalText'),
    slot1Select: $('#slot1Select'),
    slot2Select: $('#slot2Select'),
    startRoundButton: $('#startRoundButton'),

    rewardModal: $('#rewardModal'),
    rewardGrid: $('#rewardGrid'),
    skipRewardButton: $('#skipRewardButton'),

    replaceModal: $('#replaceModal'),
    replaceList: $('#replaceList'),
    cancelReplaceButton: $('#cancelReplaceButton'),

    gameOverModal: $('#gameOverModal'),
    finalRound: $('#finalRound'),
    finalScore: $('#finalScore'),
    restartButton: $('#restartButton'),

    gameClearModal: $('#gameClearModal'),
    clearFinalRound: $('#clearFinalRound'),
    clearFinalScore: $('#clearFinalScore'),
    restartFromClearButton: $('#restartFromClearButton'),

    rulesModal: $('#rulesModal'),
    rulesButton: $('#rulesButton'),
    closeRulesButton: $('#closeRulesButton'),
  };

  const state = {
    round: 1,
    turn: 1,
    lives: CONFIG.initialLives,
    score: 0,
    energy: CONFIG.maxEnergy,
    cards: [],
    phase: 'roundSetup',
    actionIndex: 0,
    ownedSkills: [],
    equipped: ['normal', 'normal'],
    pendingRewardSkill: null,
    toastTimer: null,
    deckSequence: [],
    totalRounds: 0,
    combo: 0,
  };

  function resetGame() {
    state.round = 1;
    state.turn = 1;
    state.lives = CONFIG.initialLives;
    state.score = 0;
    state.energy = CONFIG.maxEnergy;
    state.cards = [];
    state.phase = 'roundSetup';
    state.actionIndex = 0;
    state.ownedSkills = [];
    state.equipped = ['normal', 'normal'];
    state.pendingRewardSkill = null;
    state.deckSequence = buildDeckSequence();
    state.totalRounds = ROUND_SIZES.length;
    state.combo = 0;
    closeAllModals();
    prepareRound();
  }

  function buildDeckSequence() {
    // 13ランク×4スートの52枚。本来の神経衰弱と同じく、同じ数字ならスート・色を問わずペアになる。
    // ラウンド1は開始ペア(2枚)、以降は毎ラウンド5枚ずつ(新規ペア2組+単独カード1枚、または
    // 前ラウンドの単独カードの解消+新規ペア2組)を追加し、全11ラウンドで52枚に到達する。
    //
    // 「奇数枚(単独カードが存在する)ランクは常に0か1つだけ」という制約は、盤面枚数の偶奇が
    // 毎ラウンド機械的に反転するため必ず守る必要がある(2ランク以上が同時に単独になると、
    // 異なる数字同士は絶対にペアにならず、ラウンドが終了不能になるため)。
    // そのため単独カードの解消は必ず次ラウンドで行われる。ランダム性は「新規ペア」枠が
    // 新規ランクを開始するか、温めていたランク(2/4導入済み)を完成させるかの選択、および
    // 「単独」枠が新規ランクを開始するか、温めていたランクを奇数にするかの選択に持たせている。
    const suitPools = {};
    RANKS.forEach((rank) => { suitPools[rank] = shuffle([...SUITS]); });
    const drawnCount = {};
    RANKS.forEach((rank) => { drawnCount[rank] = 0; });

    const sequence = [];
    const draw = (rank) => {
      const suit = suitPools[rank].shift();
      sequence.push({ rank, suit, color: SUIT_COLORS[suit] });
      drawnCount[rank] += 1;
    };

    let notStarted = shuffle([...RANKS]); // 0/4枚(まだ手つかず)のランク
    let paired = []; // 2/4枚導入済み(すでに1組ペアが場にある、残り2枚待ち)のランク
    let pendingRank = null; // 奇数枚(1 or 3)のまま残っている、次ラウンドで解消待ちのランク

    const startRank = notStarted.splice(Math.floor(Math.random() * notStarted.length), 1)[0];
    draw(startRank);
    draw(startRank); // ラウンド1: 開始ペア(同じランクの2枚)。
    paired.push(startRank);

    const pickPairSlot = () => {
      const canFresh = notStarted.length > 0;
      const canComplete = paired.length > 0;
      // 手つかず・ペア済み、それぞれのランク"数"に比例した確率で選ぶ（固定50%だと、
      // 数が少ない側のランクほど優先的に選ばれてしまい偏りが出るため）。
      const chooseFresh = canFresh
        && (!canComplete || Math.random() < notStarted.length / (notStarted.length + paired.length));
      if (chooseFresh) {
        const index = Math.floor(Math.random() * notStarted.length);
        const rank = notStarted.splice(index, 1)[0];
        draw(rank);
        draw(rank);
        paired.push(rank);
      } else {
        const index = Math.floor(Math.random() * paired.length);
        const rank = paired.splice(index, 1)[0];
        draw(rank);
        draw(rank);
      }
    };

    const pickSingleSlot = () => {
      const canFresh = notStarted.length > 0;
      const canBump = paired.length > 0;
      // pickPairSlotと同様、ランク数に比例した確率で選ぶ。
      const chooseFresh = canFresh
        && (!canBump || Math.random() < notStarted.length / (notStarted.length + paired.length));
      if (chooseFresh) {
        const index = Math.floor(Math.random() * notStarted.length);
        pendingRank = notStarted.splice(index, 1)[0];
      } else {
        const index = Math.floor(Math.random() * paired.length);
        pendingRank = paired.splice(index, 1)[0];
      }
      draw(pendingRank);
    };

    for (let round = 2; round <= ROUND_SIZES.length; round += 1) {
      if (pendingRank) {
        draw(pendingRank);
        if (drawnCount[pendingRank] === 2) paired.push(pendingRank);
        // drawnCount===4になった場合は完了なので、どちらのプールにも戻さない。
        pendingRank = null;
      }

      pickPairSlot();
      pickPairSlot();

      const isEvenRound = round % 2 === 0;
      if (isEvenRound) pickSingleSlot();
    }

    return sequence;
  }

  function prepareRound() {
    state.phase = 'roundSetup';
    state.turn = 1;
    state.actionIndex = 0;
    clearPreview();
    openModal(els.roundModal);
    // インラインの装備パネルを表示してから、残り領域にカードを配置します。
    void els.roundModal.offsetHeight;
    buildDeck();
    renderBoard();
    populateLoadoutSelects();
    els.roundModalTitle.textContent = `ラウンド ${state.round} / ${state.totalRounds}`;
    els.roundModalText.textContent =
      `${state.cards.length}枚のカードが配置されました（全52枚中${state.cards.length}枚）。`;
    updateUI();
  }

  function buildDeck() {
    // 毎ラウンド、そのラウンドまでの累計枚数分をまるごと配り直す（前ラウンドの状態は引き継がない）。
    const count = ROUND_SIZES[state.round - 1];
    const specs = state.deckSequence.slice(0, count);
    const cards = specs.map((spec) => ({
      id: `r${state.round}-${spec.rank}${spec.suit}-${Math.random().toString(36).slice(2, 8)}`,
      rank: spec.rank,
      suit: spec.suit,
      color: spec.color,
      symbol: spec.rank,
      faceUp: false,
      matched: false,
      newlyFlipped: false,
      x: 0,
      y: 0,
      width: 70,
      height: 96,
      rotation: 0,
    }));

    shuffle(cards);
    state.cards = cards;
    assignScatteredLayout();
  }

  function assignScatteredLayout() {
    const rect = els.board.getBoundingClientRect();
    const boardWidth = Math.max(rect.width, 320);
    const boardHeight = Math.max(rect.height, 460);
    const cards = state.cards;
    const count = cards.length;
    const area = boardWidth * boardHeight;
    const estimatedWidth = Math.sqrt(area / Math.max(count * 1.9, 1)) * 0.72;
    const cardWidth = clamp(
      estimatedWidth,
      CONFIG.layout.minCardWidth,
      CONFIG.layout.maxCardWidth
    );
    const cardHeight = cardWidth * CONFIG.layout.cardAspectRatio;
    const margin = Math.max(12, cardWidth * 0.12);
    const placed = [];

    for (const card of cards) {
      let position = null;
      for (let attempt = 0; attempt < 700; attempt += 1) {
        const candidate = {
          x: randomBetween(margin, Math.max(margin, boardWidth - cardWidth - margin)),
          y: randomBetween(margin, Math.max(margin, boardHeight - cardHeight - margin)),
        };
        const overlaps = placed.some((other) => rectanglesOverlap(
          candidate.x,
          candidate.y,
          cardWidth,
          cardHeight,
          other.x,
          other.y,
          cardWidth,
          cardHeight,
          CONFIG.layout.minimumGap
        ));
        if (!overlaps) {
          position = candidate;
          break;
        }
      }

      if (!position) {
        // 高ラウンドでランダム配置が難しい場合も、少し崩した格子で破綻を防ぎます。
        const index = placed.length;
        const columns = Math.max(1, Math.floor((boardWidth - margin * 2) / (cardWidth + CONFIG.layout.minimumGap)));
        const row = Math.floor(index / columns);
        const col = index % columns;
        position = {
          x: clamp(
            margin + col * (cardWidth + CONFIG.layout.minimumGap) + randomBetween(-5, 5),
            margin,
            boardWidth - cardWidth - margin
          ),
          y: clamp(
            margin + row * (cardHeight + CONFIG.layout.minimumGap) + randomBetween(-5, 5),
            margin,
            boardHeight - cardHeight - margin
          ),
        };
      }

      card.x = position.x;
      card.y = position.y;
      card.width = cardWidth;
      card.height = cardHeight;
      card.rotation = randomBetween(-CONFIG.layout.maxRotationDeg, CONFIG.layout.maxRotationDeg);
      placed.push(position);
    }
  }

  function renderBoard() {
    els.board.querySelectorAll('.card').forEach((element) => element.remove());

    state.cards.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      button.dataset.cardId = card.id;
      button.style.left = `${card.x}px`;
      button.style.top = `${card.y}px`;
      button.style.width = `${card.width}px`;
      button.style.height = `${card.height}px`;
      button.style.transform = `rotate(${card.rotation}deg)`;
      button.style.zIndex = String(index + 3);
      button.setAttribute('aria-label', '裏向きのカード');

      button.innerHTML = `
        <span class="card-inner">
          <span class="card-face card-back"></span>
          <span class="card-face card-front card-suit-${card.color}">
            <span class="card-symbol">
              <span class="card-rank">${escapeHtml(card.rank)}</span>
              <span class="card-suit-icon">${escapeHtml(SUIT_ICONS[card.suit])}</span>
            </span>
          </span>
        </span>
      `;

      button.addEventListener('click', () => handleCardClick(card.id));
      button.addEventListener('mouseenter', () => previewCardAction(card.id));
      button.addEventListener('mouseleave', clearPreview);
      els.board.appendChild(button);
    });

    syncCardElements();
  }

  function handlePassClick() {
    if (!CONFIG.passEnabled) return;
    if (state.phase !== 'action' || state.actionIndex !== 0) return;
    if (state.lives <= CONFIG.passLifeCost) {
      showToast('ライフが足りないため様子見できません', 'danger');
      return;
    }
    state.lives -= CONFIG.passLifeCost;
    state.phase = 'peeking';
    clearPreview();
    updateUI();
  }

  function handlePeekClick(cardId) {
    const card = getCard(cardId);
    if (!card || card.faceUp || card.matched) return;

    card.faceUp = true;
    syncCardElements();
    showToast(`様子見: ${card.rank}${SUIT_ICONS[card.suit]}を確認しました（−${CONFIG.passLifeCost} LIFE）`, 'danger');

    window.setTimeout(() => {
      card.faceUp = false;
      state.phase = 'action';
      state.turn += 1;
      state.actionIndex = 0;
      state.energy = CONFIG.maxEnergy;
      syncCardElements();
      updateUI();
    }, CONFIG.resultDelayMs);
  }

  function handleCardClick(cardId) {
    if (state.phase === 'peeking') {
      handlePeekClick(cardId);
      return;
    }
    if (state.phase !== 'action') return;
    const card = getCard(cardId);
    if (!card || card.faceUp || card.matched) return;

    const skillId = state.equipped[state.actionIndex];
    const skill = CONFIG.skills[skillId];
    if (!skill) return;

    if (state.energy < skill.energyCost) {
      showToast('エネルギーが足りません', 'danger');
      return;
    }
    state.energy -= skill.energyCost;

    const targets = determineTargets(card, skill);
    targets.forEach((target) => {
      target.faceUp = true;
      target.newlyFlipped = true;
    });

    clearPreview();
    syncCardElements();
    showToast(
      `${skill.name}: ${targets.length}枚公開${skill.energyCost > 0 ? `（−${skill.energyCost} ENERGY）` : ''}`,
      'success'
    );

    state.actionIndex += 1;
    const remainingHidden = getHiddenCards().length;

    if (state.actionIndex >= 2 || remainingHidden === 0) {
      state.phase = 'resolving';
      updateUI();
      window.setTimeout(resolveTurn, CONFIG.resultDelayMs);
    } else {
      updateUI();
    }
  }

  function determineTargets(selectedCard, skill) {
    const hiddenCards = getHiddenCards();
    const otherHidden = hiddenCards.filter((card) => card.id !== selectedCard.id);
    const targets = [selectedCard];

    switch (skill.targetMode) {
      case 'nearest': {
        const nearest = findNearestCard(selectedCard, otherHidden);
        if (nearest) targets.push(nearest);
        break;
      }
      case 'randomTwo': {
        shuffle(otherHidden);
        targets.push(...otherHidden.slice(0, 2));
        break;
      }
      case 'radius': {
        const radius = selectedCard.width * CONFIG.layout.powerRadiusInCardWidths;
        targets.push(...otherHidden.filter((card) => centerDistance(selectedCard, card) <= radius));
        break;
      }
      case 'single':
      default:
        break;
    }

    return uniqueById(targets);
  }

  function resolveTurn() {
    const faceUpCards = state.cards.filter((card) => card.faceUp && !card.matched);
    const groups = new Map();

    faceUpCards.forEach((card) => {
      if (!groups.has(card.symbol)) groups.set(card.symbol, []);
      groups.get(card.symbol).push(card);
    });

    const matchedCards = [];
    let pairCount = 0;

    for (const cards of groups.values()) {
      const completePairs = Math.floor(cards.length / 2);
      pairCount += completePairs;
      matchedCards.push(...cards.slice(0, completePairs * 2));
    }

    const unmatchedCards = faceUpCards.filter((card) => !matchedCards.includes(card));

    if (pairCount > 0) {
      const earned = CONFIG.pairBaseScore * pairCount * pairCount;
      state.score += earned;
      state.combo += 1;
      const comboRecovery = Math.min(state.combo, CONFIG.maxLives - state.lives);
      state.lives += comboRecovery;
      matchedCards.forEach((card) => { card.matched = true; });
      syncCardElements();
      const parts = [pairCount > 1 ? `${pairCount}ペア・コンボ！ +${earned}` : `1ペア！ +${earned}`];
      if (comboRecovery > 0) parts.push(`コンボ${state.combo} +${comboRecovery} LIFE`);
      showToast(parts.join(' / '), 'success');
    } else {
      state.combo = 0;
      state.lives -= 1;
      showToast('ペアなし −1 LIFE', 'danger');
    }

    unmatchedCards.forEach((card) => { card.faceUp = false; });
    state.cards.forEach((card) => { card.newlyFlipped = false; });
    updateUI();

    window.setTimeout(() => {
      if (state.lives <= 0) {
        endGame();
        return;
      }

      const hiddenCount = getHiddenCards().length;
      if (hiddenCount <= 1) {
        endRound();
      } else {
        state.turn += 1;
        state.actionIndex = 0;
        state.energy = CONFIG.maxEnergy;
        state.phase = 'action';
        syncCardElements();
        updateUI();
      }
    }, pairCount > 0 ? CONFIG.removeDelayMs : 450);
  }

  function endRound() {
    const roundBonus = state.round * CONFIG.roundBonusMultiplier;
    state.score += roundBonus;
    showToast(`ラウンド突破 +${roundBonus}`, 'success');
    updateUI();

    const completedRound = state.round;
    const shouldReward = completedRound % CONFIG.rewardEveryRounds === 0;
    const rewardOptions = getAvailableRewardSkills();

    window.setTimeout(() => {
      if (shouldReward && rewardOptions.length > 0) {
        showReward(rewardOptions);
      } else {
        advanceRound();
      }
    }, 700);
  }

  function advanceRound() {
    if (state.round >= state.totalRounds) {
      showGameClear();
      return;
    }
    state.round += 1;
    prepareRound();
  }

  function showGameClear() {
    state.phase = 'gameclear';
    clearPreview();
    els.clearFinalRound.textContent = String(state.round);
    els.clearFinalScore.textContent = String(state.score);
    openModal(els.gameClearModal);
    updateUI();
  }

  function showReward(options) {
    state.phase = 'reward';
    els.rewardGrid.innerHTML = '';

    options.slice(0, 3).forEach((skillId) => {
      const skill = CONFIG.skills[skillId];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'reward-card';
      button.innerHTML = `
        <span class="rarity rarity-${skill.rarity}">${escapeHtml(skill.rarity)}</span>
        <strong>${escapeHtml(skill.name)}</strong>
        <p>${escapeHtml(skill.description)}</p>
      `;
      button.addEventListener('click', () => acquireReward(skillId));
      els.rewardGrid.appendChild(button);
    });

    openModal(els.rewardModal);
    updateUI();
  }

  function acquireReward(skillId) {
    closeModal(els.rewardModal);
    if (state.ownedSkills.length < CONFIG.inventoryLimit) {
      state.ownedSkills.push(skillId);
      showToast(`${CONFIG.skills[skillId].name}を獲得`, 'success');
      updateInventory();
      advanceRound();
      return;
    }

    state.pendingRewardSkill = skillId;
    showReplaceModal();
  }

  function showReplaceModal() {
    els.replaceList.innerHTML = '';
    state.ownedSkills.forEach((ownedId) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'replace-button';
      button.textContent = `${CONFIG.skills[ownedId].name}と入れ替える`;
      button.addEventListener('click', () => replaceOwnedSkill(ownedId));
      els.replaceList.appendChild(button);
    });
    openModal(els.replaceModal);
  }

  function replaceOwnedSkill(oldSkillId) {
    const newSkillId = state.pendingRewardSkill;
    const index = state.ownedSkills.indexOf(oldSkillId);
    if (index >= 0 && newSkillId) state.ownedSkills[index] = newSkillId;
    state.equipped = state.equipped.map((id) => id === oldSkillId ? 'normal' : id);
    state.pendingRewardSkill = null;
    closeModal(els.replaceModal);
    showToast(`${CONFIG.skills[newSkillId].name}を獲得`, 'success');
    advanceRound();
  }

  function getAvailableRewardSkills() {
    const available = CONFIG.rewardSkillIds.filter((id) => !state.ownedSkills.includes(id));
    shuffle(available);
    return available;
  }

  function populateLoadoutSelects() {
    const options = ['normal', ...state.ownedSkills];
    [els.slot1Select, els.slot2Select].forEach((select, slotIndex) => {
      select.innerHTML = '';
      options.forEach((skillId) => {
        const option = document.createElement('option');
        option.value = skillId;
        const energyCost = CONFIG.skills[skillId].energyCost;
        option.textContent = `${CONFIG.skills[skillId].name}（ENERGY ${energyCost}）`;
        option.selected = state.equipped[slotIndex] === skillId;
        select.appendChild(option);
      });
    });
    syncLoadoutSelectRestrictions();
  }

  function syncLoadoutSelectRestrictions(changedSlot = null) {
    const first = els.slot1Select.value;
    const second = els.slot2Select.value;

    if (first !== 'normal' && first === second) {
      if (changedSlot === 0) els.slot2Select.value = 'normal';
      else els.slot1Select.value = 'normal';
    }

    const totalCost = CONFIG.skills[els.slot1Select.value].energyCost
      + CONFIG.skills[els.slot2Select.value].energyCost;
    if (totalCost > CONFIG.maxEnergy) {
      if (changedSlot === 0) els.slot2Select.value = 'normal';
      else els.slot1Select.value = 'normal';
    }

    const selected1 = els.slot1Select.value;
    const selected2 = els.slot2Select.value;
    [...els.slot1Select.options].forEach((option) => {
      option.disabled = option.value !== 'normal' && (
        option.value === selected2
        || CONFIG.skills[option.value].energyCost + CONFIG.skills[selected2].energyCost > CONFIG.maxEnergy
      );
    });
    [...els.slot2Select.options].forEach((option) => {
      option.disabled = option.value !== 'normal' && (
        option.value === selected1
        || CONFIG.skills[option.value].energyCost + CONFIG.skills[selected1].energyCost > CONFIG.maxEnergy
      );
    });
  }

  function startRound() {
    syncLoadoutSelectRestrictions();
    state.equipped = [els.slot1Select.value, els.slot2Select.value];
    state.phase = 'action';
    state.actionIndex = 0;
    state.energy = CONFIG.maxEnergy;
    closeModal(els.roundModal);
    updateUI();
  }

  function endGame() {
    state.phase = 'gameover';
    clearPreview();
    els.finalRound.textContent = String(state.round);
    els.finalScore.textContent = String(state.score);
    openModal(els.gameOverModal);
    updateUI();
  }

  function previewCardAction(cardId) {
    if (state.phase !== 'action') return;
    const selectedCard = getCard(cardId);
    if (!selectedCard || selectedCard.faceUp || selectedCard.matched) return;

    clearPreview();
    const skill = CONFIG.skills[state.equipped[state.actionIndex]];
    const previewTargets = skill.targetMode === 'randomTwo'
      ? [selectedCard]
      : determineTargets(selectedCard, skill);

    previewTargets.forEach((card) => {
      const element = getCardElement(card.id);
      element?.classList.add('is-preview');
    });

    if (skill.targetMode === 'radius') {
      const radius = selectedCard.width * CONFIG.layout.powerRadiusInCardWidths;
      els.powerPreview.hidden = false;
      els.powerPreview.style.width = `${radius * 2}px`;
      els.powerPreview.style.height = `${radius * 2}px`;
      els.powerPreview.style.left = `${selectedCard.x + selectedCard.width / 2 - radius}px`;
      els.powerPreview.style.top = `${selectedCard.y + selectedCard.height / 2 - radius}px`;
    }
  }

  function clearPreview() {
    els.board.querySelectorAll('.is-preview').forEach((el) => el.classList.remove('is-preview'));
    els.powerPreview.hidden = true;
  }

  function syncCardElements() {
    state.cards.forEach((card) => {
      const element = getCardElement(card.id);
      if (!element) return;
      element.classList.toggle('is-face-up', card.faceUp);
      element.classList.toggle('is-matched', card.matched);
      element.classList.toggle('is-newly-flipped', card.newlyFlipped);
      const interactable = state.phase === 'action' || state.phase === 'peeking';
      element.classList.toggle('is-disabled', !interactable || card.faceUp || card.matched);
      element.disabled = !interactable || card.faceUp || card.matched;
      element.setAttribute('aria-label', card.faceUp ? `表向き: ${card.rank}${SUIT_ICONS[card.suit]}` : '裏向きのカード');
    });
  }

  function updateUI() {
    els.roundValue.textContent = String(state.round);
    els.turnValue.textContent = String(state.turn);
    els.lifeValue.textContent = String(state.lives);
    els.energyValue.textContent = `${state.energy} / ${CONFIG.maxEnergy}`;
    els.scoreValue.textContent = String(state.score);
    if (els.comboValue) els.comboValue.textContent = String(state.combo);

    const skill1 = CONFIG.skills[state.equipped[0]];
    const skill2 = CONFIG.skills[state.equipped[1]];
    els.slot1Summary.querySelector('strong').textContent = skill1.name;
    els.slot2Summary.querySelector('strong').textContent = skill2.name;
    els.slot1Summary.classList.toggle('is-active', state.phase === 'action' && state.actionIndex === 0);
    els.slot2Summary.classList.toggle('is-active', state.phase === 'action' && state.actionIndex === 1);

    if (els.passButton) {
      const canPass = CONFIG.passEnabled && state.phase === 'action' && state.actionIndex === 0;
      els.passButton.hidden = !CONFIG.passEnabled || !canPass;
      els.passButton.disabled = !canPass || state.lives <= CONFIG.passLifeCost;
    }

    if (state.phase === 'action') {
      const activeSkill = CONFIG.skills[state.equipped[state.actionIndex]];
      els.phaseLabel.textContent = `アクションフェイズ — FLIP ${state.actionIndex + 1}`;
      els.actionPrompt.textContent = `${activeSkill.name}: 対象の裏向きカードを選んでください`;
    } else if (state.phase === 'peeking') {
      els.phaseLabel.textContent = '様子見フェイズ';
      els.actionPrompt.textContent = '確認したいカードを1枚選んでください（判定は行われません）';
    } else if (state.phase === 'resolving') {
      els.phaseLabel.textContent = '判定フェイズ';
      els.actionPrompt.textContent = '表向きのカードからペアを判定しています';
    } else if (state.phase === 'reward') {
      els.phaseLabel.textContent = '報酬フェイズ';
      els.actionPrompt.textContent = '特殊フリップを1つ選んでください';
    } else if (state.phase === 'gameover') {
      els.phaseLabel.textContent = 'ゲームオーバー';
      els.actionPrompt.textContent = 'ライフが0になりました';
    } else if (state.phase === 'gameclear') {
      els.phaseLabel.textContent = 'ゲームクリア';
      els.actionPrompt.textContent = '52枚のカードをすべて使い切りました';
    } else {
      els.phaseLabel.textContent = 'カード配置フェイズ';
      els.actionPrompt.textContent = '盤面の配置を見て、このラウンドの装備を選んでください';
    }

    updateInventory();
    syncCardElements();
  }

  function updateInventory() {
    els.inventory.innerHTML = '';
    if (state.ownedSkills.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'inventory-empty';
      empty.textContent = `なし（上限 ${CONFIG.inventoryLimit}）`;
      els.inventory.appendChild(empty);
      return;
    }

    state.ownedSkills.forEach((skillId) => {
      const chip = document.createElement('span');
      chip.className = 'inventory-chip';
      chip.textContent = CONFIG.skills[skillId].name;
      els.inventory.appendChild(chip);
    });
  }

  function showToast(message, type = '') {
    window.clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `toast is-visible ${type ? `is-${type}` : ''}`;
    state.toastTimer = window.setTimeout(() => {
      els.toast.className = 'toast';
    }, CONFIG.toastDurationMs);
  }

  function openModal(modal) { modal.classList.add('is-open'); }
  function closeModal(modal) { modal.classList.remove('is-open'); }
  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop, .round-setup-panel').forEach((modal) => modal.classList.remove('is-open'));
  }

  function getCard(cardId) { return state.cards.find((card) => card.id === cardId); }
  function getCardElement(cardId) { return els.board.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`); }
  function getHiddenCards() { return state.cards.filter((card) => !card.faceUp && !card.matched); }

  function findNearestCard(source, candidates) {
    let nearest = null;
    let nearestDistance = Infinity;
    candidates.forEach((candidate) => {
      const distance = centerDistance(source, candidate);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function centerDistance(a, b) {
    const ax = a.x + a.width / 2;
    const ay = a.y + a.height / 2;
    const bx = b.x + b.width / 2;
    const by = b.y + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function rectanglesOverlap(ax, ay, aw, ah, bx, by, bw, bh, gap) {
    return !(
      ax + aw + gap <= bx ||
      bx + bw + gap <= ax ||
      ay + ah + gap <= by ||
      by + bh + gap <= ay
    );
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function uniqueById(cards) {
    return [...new Map(cards.map((card) => [card.id, card])).values()];
  }

  function randomBetween(min, max) { return min + Math.random() * Math.max(0, max - min); }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  els.startRoundButton.addEventListener('click', startRound);
  if (els.passButton) els.passButton.addEventListener('click', handlePassClick);
  els.slot1Select.addEventListener('change', () => syncLoadoutSelectRestrictions(0));
  els.slot2Select.addEventListener('change', () => syncLoadoutSelectRestrictions(1));
  els.skipRewardButton.addEventListener('click', () => {
    closeModal(els.rewardModal);
    advanceRound();
  });
  els.cancelReplaceButton.addEventListener('click', () => {
    state.pendingRewardSkill = null;
    closeModal(els.replaceModal);
    advanceRound();
  });
  els.restartButton.addEventListener('click', resetGame);
  els.restartFromClearButton.addEventListener('click', resetGame);
  els.rulesButton.addEventListener('click', () => openModal(els.rulesModal));
  els.closeRulesButton.addEventListener('click', () => closeModal(els.rulesModal));

  window.addEventListener('resize', () => {
    if (state.cards.length === 0 || state.phase === 'action' || state.phase === 'resolving') return;
    assignScatteredLayout();
    renderBoard();
  });

  resetGame();
})();
