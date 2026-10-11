// UI & Meta Progression (Skins, Gold, Dice, Gacha) for Meow.io
const SKINS_CATALOG = [
  { id: 'white', name: 'Mèo Trắng', icon: '🐱', cost: 0, unlocked: true },
  { id: 'orange', name: 'Mèo Cam', icon: '🐈', cost: 100, unlocked: true },
  { id: 'black', name: 'Mèo Mun', icon: '🐈‍⬛', cost: 150, unlocked: false },
  { id: 'gray', name: 'Mèo Xám', icon: '🐱', cost: 200, unlocked: false },
  { id: 'rabbit', name: 'Mèo Thỏ', icon: '🐰', cost: 350, unlocked: false },
  { id: 'fox', name: 'Mèo Cáo', icon: '🦊', cost: 450, unlocked: false },
  { id: 'tiger', name: 'Mèo Hổ', icon: '🐯', cost: 500, unlocked: false },
  { id: 'panda', name: 'Gấu Trúc', icon: '🐼', cost: 550, unlocked: false },
  { id: 'lion', name: 'Mèo Sư Tử', icon: '🦁', cost: 600, unlocked: false },
  { id: 'frog', name: 'Mèo Ếch', icon: '🐸', cost: 650, unlocked: false },
  { id: 'hamster', name: 'Chuột Hamster', icon: '🐹', cost: 700, unlocked: false },
  { id: 'mouse', name: 'Mèo Chuột', icon: '🐭', cost: 750, unlocked: false },
  { id: 'robot', name: 'Mèo Cyber', icon: '🤖', cost: 850, unlocked: false },
  { id: 'ghost', name: 'Mèo Ma Quái', icon: '👻', cost: 950, unlocked: false },
  { id: 'king', name: 'Hoàng Đế', icon: '👑', cost: 1000, unlocked: false },
  { id: 'cowboy', name: 'Cao Bồi', icon: '🤠', cost: 1100, unlocked: false },
  { id: 'wizard', name: 'Phù Thủy', icon: '🧙', cost: 1200, unlocked: false },
  { id: 'space', name: 'Phi Hành Gia', icon: '🚀', cost: 1350, unlocked: false },
  { id: 'dragon', name: 'Long Vương', icon: '🐉', cost: 1500, unlocked: false },
];

class UIController {
  constructor() {
    let savedName = localStorage.getItem('meow_player_name');
    if (!savedName || savedName === 'undefined' || savedName === 'null' || savedName.trim() === '') {
      savedName = 'Mèo Hiệp Sĩ';
    }
    this.playerName = savedName;

    this.currentUser = null;
    try {
      const storedAcc = localStorage.getItem('meow_user_account');
      if (storedAcc && storedAcc !== 'undefined') {
        this.currentUser = JSON.parse(storedAcc);
        if (this.currentUser && this.currentUser.username) {
          this.playerName = this.currentUser.username;
        }
      }
    } catch (e) {
      this.currentUser = null;
    }

    const storedGold = localStorage.getItem('meow_gold');
    this.gold = (storedGold !== null && !isNaN(parseInt(storedGold))) ? parseInt(storedGold) : 150;

    const storedDice = localStorage.getItem('meow_dice');
    this.dice = (storedDice !== null && !isNaN(parseInt(storedDice))) ? parseInt(storedDice) : 3;

    let savedSkins = null;
    try {
      savedSkins = JSON.parse(localStorage.getItem('meow_unlocked_skins'));
    } catch (e) {
      savedSkins = null;
    }
    this.unlockedSkins = (Array.isArray(savedSkins) && savedSkins.length > 0) ? savedSkins : ['white', 'orange'];
    this.selectedSkin = localStorage.getItem('meow_selected_skin') || 'white';
    
    this.initDOM();
    this.renderSkinCarousel();
    this.updateWalletUI();
    this.updateAccountUI();
    this.onInventoryChange = null;
  }

  saveData() {
    if (!this.playerName || this.playerName === 'undefined' || this.playerName === 'null' || this.playerName.trim() === '') {
      this.playerName = 'Mèo Hiệp Sĩ';
    }
    // Always persist to device's localStorage
    localStorage.setItem('meow_gold', this.gold);
    localStorage.setItem('meow_dice', this.dice);
    localStorage.setItem('meow_unlocked_skins', JSON.stringify(this.unlockedSkins));
    localStorage.setItem('meow_selected_skin', this.selectedSkin);
    localStorage.setItem('meow_player_name', this.playerName);

    // If logged in, also mirror into user account object
    if (this.currentUser) {
      this.currentUser.gold = this.gold;
      this.currentUser.dice = this.dice;
      this.currentUser.unlocked_skins = this.unlockedSkins;
      this.currentUser.selected_skin = this.selectedSkin;
      localStorage.setItem('meow_user_account', JSON.stringify(this.currentUser));
    }

    // Only notify cloud sync if logged into an account
    if (this.currentUser && typeof this.onInventoryChange === 'function') {
      this.onInventoryChange({
        username: this.currentUser.username,
        gold: this.gold,
        dice: this.dice,
        unlockedSkins: this.unlockedSkins,
        selectedSkin: this.selectedSkin
      });
    }
  }

  syncWithCloud(userData) {
    // Only accept cloud updates if player is logged in! Guests rely strictly on localStorage.
    if (!this.currentUser || !userData) return;
    if (userData.gold !== undefined) this.gold = userData.gold;
    if (userData.dice !== undefined) this.dice = userData.dice;
    if (userData.unlockedSkins && Array.isArray(userData.unlockedSkins)) {
      this.unlockedSkins = userData.unlockedSkins;
    }
    if (userData.selectedSkin) this.selectedSkin = userData.selectedSkin;
    this.saveData();
    this.updateWalletUI();
    this.renderSkinCarousel();
  }

  setLoggedInUser(user) {
    this.currentUser = user;
    localStorage.setItem('meow_user_account', JSON.stringify(user));
    this.playerName = user.username;
    this.playerNameInput.value = user.username;

    // Merge local guest skins and currency with account data so local progress is preserved!
    const mergedSkins = new Set(this.unlockedSkins);
    if (user.unlocked_skins && Array.isArray(user.unlocked_skins)) {
      user.unlocked_skins.forEach(s => mergedSkins.add(s));
    }
    this.unlockedSkins = Array.from(mergedSkins);
    this.gold = Math.max(this.gold || 0, user.gold !== undefined ? user.gold : 0);
    this.dice = Math.max(this.dice || 0, user.dice !== undefined ? user.dice : 0);
    if (user.selected_skin) {
      this.selectedSkin = user.selected_skin;
    }
    this.saveData();
    this.updateWalletUI();
    this.updateAccountUI();
    this.renderSkinCarousel();

    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.add('hidden');
    alert(`🎉 Chào mừng ${user.username}! Dữ liệu tài khoản đã được đồng bộ lên Cloud.`);
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('meow_user_account');
    this.updateAccountUI();
    alert('Đã đăng xuất tài khoản. Bạn đang ở chế độ khách!');
  }

  updateAccountUI() {
    const nameText = document.getElementById('accountUsernameText');
    const btnOpenAuth = document.getElementById('btnOpenAuthModal');
    const btnLogout = document.getElementById('btnLogout');

    if (this.currentUser) {
      if (nameText) nameText.textContent = `🐾 ${this.currentUser.username}`;
      if (btnOpenAuth) btnOpenAuth.classList.add('hidden');
      if (btnLogout) btnLogout.classList.remove('hidden');
    } else {
      if (nameText) nameText.textContent = 'Khách (Chưa đăng nhập)';
      if (btnOpenAuth) btnOpenAuth.classList.remove('hidden');
      if (btnLogout) btnLogout.classList.add('hidden');
    }
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

    // Event listeners for Player Name Input
    this.playerNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && val !== 'undefined' && val !== 'null') {
        this.playerName = val;
        localStorage.setItem('meow_player_name', this.playerName);
      }
    });

    this.playerNameInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      this.playerName = (val && val !== 'undefined' && val !== 'null') ? val : 'Mèo Hiệp Sĩ';
      this.playerNameInput.value = this.playerName;
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

    // Wire up Auth Modal & Controls
    this.initAuthUI();
  }

  initAuthUI() {
    const authModal = document.getElementById('authModal');
    const btnOpenAuth = document.getElementById('btnOpenAuthModal');
    const btnLogout = document.getElementById('btnLogout');
    const btnClose1 = document.getElementById('btnCloseAuthModal');
    const btnClose2 = document.getElementById('btnCloseAuthModal2');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const formLogin = document.getElementById('formLogin');
    const formRegister = document.getElementById('formRegister');
    const loginMsg = document.getElementById('loginMsg');
    const regMsg = document.getElementById('regMsg');

    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        if (loginMsg) loginMsg.classList.add('hidden');
        if (regMsg) regMsg.classList.add('hidden');
        authModal.classList.remove('hidden');
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
      });
    }

    const closeFn = () => authModal.classList.add('hidden');
    if (btnClose1) btnClose1.addEventListener('click', closeFn);
    if (btnClose2) btnClose2.addEventListener('click', closeFn);

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
        if (loginMsg) loginMsg.classList.add('hidden');
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.classList.remove('hidden');
        formLogin.classList.add('hidden');
        if (regMsg) regMsg.classList.add('hidden');
      });
    }

    // Submit Login
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('loginIdentifier').value.trim();
        const password = document.getElementById('loginPassword').value;
        loginMsg.className = 'auth-message';
        loginMsg.textContent = 'Đang kiểm tra đăng nhập...';
        loginMsg.classList.remove('hidden');

        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
          });
          const data = await res.json();
          if (data.success && data.user) {
            loginMsg.className = 'auth-message success';
            loginMsg.textContent = '✅ Đăng nhập thành công!';
            setTimeout(() => {
              this.setLoggedInUser(data.user);
            }, 600);
          } else {
            loginMsg.className = 'auth-message error';
            loginMsg.textContent = '❌ ' + (data.message || 'Sai thông tin tài khoản!');
          }
        } catch (err) {
          loginMsg.className = 'auth-message error';
          loginMsg.textContent = '❌ Lỗi kết nối server: ' + err.message;
        }
      });
    }

    // Submit Register
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        regMsg.className = 'auth-message';
        regMsg.textContent = 'Đang đăng ký tài khoản mới...';
        regMsg.classList.remove('hidden');

        try {
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
          });
          const data = await res.json();
          if (data.success && data.user) {
            regMsg.className = 'auth-message success';
            regMsg.textContent = '✨ Đăng ký thành công! Đang lưu thông tin...';
            setTimeout(() => {
              this.setLoggedInUser(data.user);
            }, 600);
          } else {
            regMsg.className = 'auth-message error';
            regMsg.textContent = '❌ ' + (data.message || 'Đăng ký thất bại!');
          }
        } catch (err) {
          regMsg.className = 'auth-message error';
          regMsg.textContent = '❌ Lỗi kết nối server: ' + err.message;
        }
      });
    }
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

  showGameOver(score, goldEarned, diceEarned, isSurrendered = false) {
    // Add rewards to local storage
    this.gold += goldEarned;
    this.dice += diceEarned;
    this.saveData();
    this.updateWalletUI();

    const titleEl = document.querySelector('#gameOverScreen h2');
    const subtitleEl = document.querySelector('.game-over-subtitle');
    const iconEl = document.querySelector('.game-over-icon');

    if (isSurrendered) {
      if (iconEl) iconEl.textContent = '🏳️';
      if (titleEl) titleEl.textContent = 'ĐÃ ĐẦU HÀNG & BẢO LƯU!';
      if (subtitleEl) subtitleEl.textContent = 'Phần thưởng của bạn đã được bảo lưu an toàn!';
    } else {
      if (iconEl) iconEl.textContent = '💥';
      if (titleEl) titleEl.textContent = 'MÈO ĐÃ BỊ HẠ!';
      if (subtitleEl) subtitleEl.textContent = 'Bạn đã chiến đấu rất dũng cảm!';
    }

    document.getElementById('finalScore').textContent = `🐱 ${score}`;
    document.getElementById('finalGold').textContent = `🪙 +${goldEarned}`;
    document.getElementById('finalDice').textContent = `🎲 +${diceEarned}`;

    this.hud.classList.add('hidden');
    this.gameOverScreen.classList.remove('hidden');
    sound.playDeath();
  }
}
