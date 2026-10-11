// UI & Meta Progression (Skins, Gold, Dice, Gacha) for Meow.io
const SKINS_CATALOG = [
  { id: 'white', name: 'Mèo Trắng', icon: '🐱', cost: 0, unlocked: true },
  { id: 'orange', name: 'Mèo Cam', icon: '🐈', cost: 100, unlocked: true },
  { id: 'black', name: 'Mèo Mun', icon: '🐈‍⬛', cost: 150, unlocked: false },
  { id: 'gray', name: 'Mèo Xám', icon: '🐱', cost: 200, unlocked: false },
  { id: 'rabbit', name: 'Mèo Thỏ', icon: '🐰', cost: 350, unlocked: false },
  { id: 'fox', name: 'Mèo Cáo', icon: '🦊', cost: 450, unlocked: false },
  { id: 'lion', name: 'Mèo Sư Tử', icon: '🦁', cost: 600, unlocked: false },
  { id: 'king', name: 'Hoàng Đế', icon: '👑', cost: 1000, unlocked: false },
  { id: 'wizard', name: 'Phù Thủy', icon: '🧙', cost: 1200, unlocked: false },
];

class UIController {
  constructor() {
    this.gold = parseInt(localStorage.getItem('meow_gold')) || 150; // Starter gold bonus
    this.dice = parseInt(localStorage.getItem('meow_dice')) || 3;   // Starter dice bonus
    this.unlockedSkins = JSON.parse(localStorage.getItem('meow_unlocked_skins')) || ['white', 'orange'];
    this.selectedSkin = localStorage.getItem('meow_selected_skin') || 'white';
    this.initDOM();
    this.renderSkinCarousel();
    this.updateWalletUI();
    this.onInventoryChange = null;
  }

  saveData() {
    localStorage.setItem('meow_gold', this.gold);
    localStorage.setItem('meow_dice', this.dice);
    localStorage.setItem('meow_unlocked_skins', JSON.stringify(this.unlockedSkins));
    localStorage.setItem('meow_selected_skin', this.selectedSkin);
    localStorage.setItem('meow_player_name', this.playerName);

    if (typeof this.onInventoryChange === 'function') {
      this.onInventoryChange({
        username: this.playerName,
        gold: this.gold,
        dice: this.dice,
        unlockedSkins: this.unlockedSkins,
        selectedSkin: this.selectedSkin
      });
    }
  }

  syncWithCloud(userData) {
    if (!userData) return;
    if (userData.gold !== undefined) this.gold = userData.gold;
    if (userData.dice !== undefined) this.dice = userData.dice;
    if (userData.unlockedSkins) this.unlockedSkins = userData.unlockedSkins;
    if (userData.selectedSkin) this.selectedSkin = userData.selectedSkin;
    this.saveData();
    this.updateWalletUI();
    this.renderSkinCarousel();
  }

  initDOM() {
    // Menu elements
    this.startScreen = document.getElementById('startScreen');
    this.hud = document.getElementById('hud');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.diceRollModal = document.getElementById('diceRollModal');

    this.menuGold = document.getElementById('menuGold');
    this.menuDice = document.getElementById('menuDice');
    this.playerNameInput = document.getElementById('playerNameInput');
    this.playerNameInput.value = this.playerName;

    // HUD elements
    this.hudAvatar = document.getElementById('hudAvatar');
    this.hudPlayerName = document.getElementById('hudPlayerName');
    this.hudTier = document.getElementById('hudTier');
    this.hpFill = document.getElementById('hpFill');
    this.hpText = document.getElementById('hpText');
    this.energyFill = document.getElementById('energyFill');
    this.energyText = document.getElementById('energyText');
    this.hudGold = document.getElementById('hudGold');
    this.hudDice = document.getElementById('hudDice');
    this.leaderboardList = document.getElementById('leaderboardList');
    this.killFeed = document.getElementById('killFeed');
    this.buffBanner = document.getElementById('buffBanner');

    // Event listeners
    this.playerNameInput.addEventListener('change', (e) => {
      this.playerName = e.target.value.trim() || 'Mèo Hiệp Sĩ';
      this.saveData();
    });

    // Dice Gacha Roll Modal
    document.getElementById('btnRollDice').addEventListener('click', () => {
      this.openDiceModal();
    });
    document.getElementById('btnCloseDiceModal').addEventListener('click', () => {
      this.diceRollModal.classList.add('hidden');
    });
    document.getElementById('btnDoRoll').addEventListener('click', () => {
      this.performDiceRoll();
    });
  }

  renderSkinCarousel() {
    const container = document.getElementById('skinCarousel');
    container.innerHTML = '';

    SKINS_CATALOG.forEach(skin => {
      const isUnlocked = this.unlockedSkins.includes(skin.id);
      const isSelected = this.selectedSkin === skin.id;

      const card = document.createElement('div');
      card.className = `skin-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
      
      let badge = '';
      if (!isUnlocked) {
        badge = `<div class="skin-price">🪙 ${skin.cost}</div>`;
      }

      card.innerHTML = `
        ${badge}
        <span class="skin-icon">${skin.icon}</span>
        <span class="skin-name">${skin.name}</span>
      `;

      card.addEventListener('click', () => {
        if (isUnlocked) {
          this.selectedSkin = skin.id;
          this.saveData();
          this.renderSkinCarousel();
        } else {
          // Try to buy with gold
          if (this.gold >= skin.cost) {
            if (confirm(`Mua skin ${skin.name} với giá 🪙 ${skin.cost} vàng?`)) {
              this.gold -= skin.cost;
              this.unlockedSkins.push(skin.id);
              this.selectedSkin = skin.id;
              this.saveData();
              this.updateWalletUI();
              this.renderSkinCarousel();
            }
          } else {
            alert(`Bạn cần thêm 🪙 ${skin.cost - this.gold} vàng để mở khóa skin này! Hãy thu thập thêm trong trận hoặc lắc xúc xắc 🎲!`);
          }
        }
      });

      container.appendChild(card);
    });
  }

  updateWalletUI() {
    this.menuGold.textContent = this.gold;
    this.menuDice.textContent = this.dice;
  }

  openDiceModal() {
    document.getElementById('rollResult').classList.add('hidden');
    this.diceRollModal.classList.remove('hidden');
  }

  performDiceRoll() {
    if (this.dice <= 0) {
      alert('Bạn đã hết Xúc Xắc! Hãy nhặt thêm 🎲 trong các trận đấu!');
      return;
    }

    this.dice--;
    this.saveData();
    this.updateWalletUI();

    const diceCube = document.getElementById('animatedDice');
    const resultBox = document.getElementById('rollResult');
    const resultIcon = document.getElementById('rollResultIcon');
    const resultText = document.getElementById('rollResultText');

    diceCube.classList.add('rolling');
    resultBox.classList.add('hidden');
    sound.playDice();

    setTimeout(() => {
      diceCube.classList.remove('rolling');

      // Random outcome: Skin or Gold
      const lockedSkins = SKINS_CATALOG.filter(s => !this.unlockedSkins.includes(s.id));
      const roll = Math.random();

      if (lockedSkins.length > 0 && roll < 0.45) {
        // Unlock random skin!
        const wonSkin = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
        this.unlockedSkins.push(wonSkin.id);
        this.selectedSkin = wonSkin.id;
        this.saveData();
        this.renderSkinCarousel();

        resultIcon.textContent = wonSkin.icon;
        resultText.innerHTML = `Chúc mừng! Bạn mở khóa skin mới:<br><strong>${wonSkin.name}</strong> 🎉`;
      } else {
        // Gold reward
        const bonusGold = Math.floor(Math.random() * 80) + 50;
        this.gold += bonusGold;
        this.saveData();
        this.updateWalletUI();

        resultIcon.textContent = '🪙';
        resultText.innerHTML = `Bạn nhận được kho báu:<br><strong>+${bonusGold} Vàng</strong> 🪙!`;
      }

      resultBox.classList.remove('hidden');
    }, 1200);
  }

  updateHUD(player) {
    if (!player) return;

    // HP Bar
    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    this.hpFill.style.width = `${hpPercent}%`;
    this.hpText.textContent = `${player.hp}/${player.maxHp}`;

    // Energy Bar
    const energyPercent = Math.max(0, Math.min(100, player.energy));
    this.energyFill.style.width = `${energyPercent}%`;
    this.energyText.textContent = `${player.energy}/100`;

    // Tier based on Size
    let tier = '🐱 Nhỏ';
    if (player.size >= 1000) tier = '👑 Boss Khổng Lồ';
    else if (player.size >= 700) tier = '🦁 Mèo Khổng Lồ';
    else if (player.size >= 400) tier = '🐱 Rất Lớn';
    else if (player.size >= 250) tier = '🐱 Lớn';
    else if (player.size >= 150) tier = '🐱 Trưởng Thành';

    this.hudTier.textContent = `${tier} (Size: ${player.size})`;
    this.hudPlayerName.textContent = player.name;
    this.hudGold.textContent = player.gold;
    this.hudDice.textContent = player.diceCount;
  }

  updateLeaderboard(leaderboard, localPlayerId) {
    this.leaderboardList.innerHTML = '';
    leaderboard.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = `leaderboard-item ${item.id === localPlayerId ? 'is-me' : ''}`;
      
      let rankBadge = `${index + 1}.`;
      if (index === 0) rankBadge = '👑';
      else if (index === 1) rankBadge = '🥈';
      else if (index === 2) rankBadge = '🥉';

      li.innerHTML = `
        <span class="lb-rank">${rankBadge}</span>
        <span class="lb-name">${item.name}</span>
        <span class="lb-score">${item.score}</span>
      `;
      this.leaderboardList.appendChild(li);
    });
  }

  addKillMessage(killerName, victimName) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.textContent = `🐾 ${killerName} đã cào hạ ${victimName}!`;
    this.killFeed.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 3200);
  }

  showBuffBanner(buffType) {
    const banner = this.buffBanner;
    let text = '🎲 NHẬN BUFF ĐẶC BIỆT!';
    if (buffType === 'speed') text = '⚡ BUFF: TĂNG TỐC 135% (7s)!';
    if (buffType === 'heal') text = '❤️ BUFF: HỒI PHỤC 50 HP!';
    if (buffType === 'shield') text = '🛡️ BUFF: LÁ CHẮN ĐỠ 2 ĐÒN CÀO!';
    if (buffType === 'size') text = '📏 BUFF: PHÌNH TO SIZE +15%!';
    if (buffType === 'gold') text = '🪙 BUFF: KHO BÁU +50 VÀNG!';

    banner.textContent = text;
    banner.classList.remove('hidden');

    clearTimeout(this.buffTimer);
    this.buffTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 2500);
  }

  showGameOver(score, goldEarned, diceEarned) {
    // Add rewards to local storage
    this.gold += goldEarned;
    this.dice += diceEarned;
    this.saveData();
    this.updateWalletUI();

    document.getElementById('finalScore').textContent = `🐱 ${score}`;
    document.getElementById('finalGold').textContent = `🪙 +${goldEarned}`;
    document.getElementById('finalDice').textContent = `🎲 +${diceEarned}`;

    this.hud.classList.add('hidden');
    this.gameOverScreen.classList.remove('hidden');
    sound.playDeath();
  }
}
