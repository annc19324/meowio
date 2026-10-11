// Main Game Controller for Meow.io (Dual Mode: Online Multiplayer & Local Offline)
window.addEventListener('DOMContentLoaded', () => {
  const serverUrl = window.MEOW_SERVER_URL || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3000');
  const socket = io(serverUrl);
  const canvas = document.getElementById('gameCanvas');
  const renderer = new GameRenderer(canvas);
  const ui = new UIController();
  const offlineEngine = new OfflineEngine();

  let gameMode = 'online'; // 'online' or 'offline'
  let localPlayerId = null;
  let latestState = null;
  let isGameActive = false;

  // Controls State
  let targetAngle = 0;
  let isBoosting = false;
  let lastTapTime = 0;
  let boostTimeout = null;

  // 1. App Detection (Hide "Tải App" if already inside Mobile App)
  function isRunningInApp() {
    return window.isAndroidApp === true ||
           navigator.userAgent.includes('MeowApp') ||
           window.Android !== undefined ||
           window.matchMedia('(display-mode: standalone)').matches ||
           new URLSearchParams(window.location.search).get('app') === 'true';
  }

  if (isRunningInApp()) {
    if (downloadAppWrapper) downloadAppWrapper.style.display = 'none';
  } else {
    if (downloadAppWrapper) downloadAppWrapper.style.display = 'block';
  }

  // Cloud Database Sync with Neon PostgreSQL
  function requestCloudSync() {
    if (socket.connected && gameMode === 'online') {
      const currentName = ui.playerNameInput.value.trim() || 'Mèo';
      socket.emit('syncUserProfile', { name: currentName });
    }
  }

  socket.on('connect', () => {
    requestCloudSync();
  });

  socket.on('userProfileSynced', (userData) => {
    ui.syncWithCloud(userData);
  });

  ui.playerNameInput.addEventListener('change', () => {
    requestCloudSync();
  });

  ui.onInventoryChange = (invData) => {
    if (socket.connected && gameMode === 'online') {
      socket.emit('updateCloudInventory', invData);
    }
  };

  // Download Modal triggers
  const btnOpenDownloadModal = document.getElementById('btnOpenDownloadModal');
  const btnCloseDownloadModal = document.getElementById('btnCloseDownloadModal');
  if (btnOpenDownloadModal) {
    btnOpenDownloadModal.addEventListener('click', () => {
      downloadModal.classList.remove('hidden');
    });
  }
  if (btnCloseDownloadModal) {
    btnCloseDownloadModal.addEventListener('click', () => {
      downloadModal.classList.add('hidden');
    });
  }

  // 2. Mode Switching (Online vs Offline)
  const modeOnlineBtn = document.getElementById('modeOnlineBtn');
  const modeOfflineBtn = document.getElementById('modeOfflineBtn');
  const hudModeTag = document.getElementById('hudModeTag');

  modeOnlineBtn.addEventListener('click', () => {
    gameMode = 'online';
    modeOnlineBtn.classList.add('active');
    modeOfflineBtn.classList.remove('active');
    hudModeTag.textContent = 'ONLINE';
    hudModeTag.style.color = '#70a1ff';
  });

  modeOfflineBtn.addEventListener('click', () => {
    gameMode = 'offline';
    modeOfflineBtn.classList.add('active');
    modeOnlineBtn.classList.remove('active');
    hudModeTag.textContent = 'OFFLINE (0ms)';
    hudModeTag.style.color = '#2ed573';
  });

  // 3. Start Game
  function startGame() {
    sound.init();
    const name = ui.playerNameInput.value.trim() || 'Mèo Hiệp Sĩ';
    const skin = ui.selectedSkin;

    if (gameMode === 'online') {
      offlineEngine.stop();
      socket.emit('joinGame', { name, skin });
    } else {
      // Launch Offline Engine
      localPlayerId = 'local_player';
      isGameActive = true;

      ui.startScreen.classList.add('hidden');
      ui.gameOverScreen.classList.add('hidden');
      ui.hud.classList.remove('hidden');

      offlineEngine.start(
        name,
        skin,
        (state) => {
          latestState = state;
          const me = state.players.find(p => p.id === localPlayerId);
          if (me) ui.updateHUD(me);
          ui.updateLeaderboard(state.leaderboard, localPlayerId);
          processEvents(state.events, me);
        },
        (overData) => {
          isGameActive = false;
          offlineEngine.stop();
          ui.showGameOver(overData.score, overData.goldEarned, overData.diceEarned);
        }
      );
    }
  }

  socket.on('gameJoined', (data) => {
    if (gameMode !== 'online') return;
    localPlayerId = data.playerId;
    isGameActive = true;

    ui.startScreen.classList.add('hidden');
    ui.gameOverScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');
  });

  socket.on('gameOver', (data) => {
    if (gameMode !== 'online') return;
    isGameActive = false;
    ui.showGameOver(data.score, data.goldEarned, data.diceEarned);
  });

  // 4. Online State Handling
  socket.on('state', (state) => {
    if (gameMode !== 'online' || !isGameActive) return;
    latestState = state;

    const me = state.players.find(p => p.id === localPlayerId);
    if (me) {
      ui.updateHUD(me);
    }

    ui.updateLeaderboard(state.leaderboard, localPlayerId);
    processEvents(state.events, me);
  });

  function processEvents(events, me) {
    if (!events || events.length === 0) return;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'scratch') {
        renderer.addScratchEffect(ev.hitX, ev.hitY, Math.random() * Math.PI);
        renderer.addSparks(ev.hitX, ev.hitY, '#ff4757', 5);

        if (ev.victimId === localPlayerId || ev.attackerId === localPlayerId) {
          sound.playScratch();
        }

        if (ev.absorbed) {
          renderer.addFloatingText('🛡️ BLOCKED!', ev.hitX, ev.hitY, '#70a1ff', 14);
        } else {
          renderer.addFloatingText(`-${ev.damage}`, ev.hitX, ev.hitY, '#ff4757', 16);
        }
      } 
      else if (ev.type === 'kill') {
        ui.addKillMessage(ev.killerName, ev.victimName);
      }
      else if (ev.type === 'eat_pate') {
        if (ev.playerId === localPlayerId) {
          sound.playPate();
          renderer.addFloatingText('+50 PATE! ❤️+25', ev.x, ev.y, '#2ed573', 18);
        }
      }
      else if (ev.type === 'coin_pickup') {
        if (ev.playerId === localPlayerId) {
          sound.playEat();
          if (me) renderer.addFloatingText(`+${ev.gold} 🪙`, me.x, me.y, '#ffa502', 15);
        }
      }
      else if (ev.type === 'dice_pickup') {
        if (ev.playerId === localPlayerId) {
          sound.playDice();
          ui.showBuffBanner(ev.buffType);
          if (me) renderer.addFloatingText('🎲 POWER UP!', me.x, me.y, '#a55eea', 18);
        }
      }
    }
  }

  // 5. Desktop Controls
  window.addEventListener('mousemove', (e) => {
    if (!isGameActive) return;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    targetAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    if (gameMode === 'offline') {
      offlineEngine.setInput(targetAngle, isBoosting);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameActive && !isBoosting) {
      isBoosting = true;
      sound.playBoost();
      if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isGameActive) {
      isBoosting = false;
      if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);
    }
  });

  window.addEventListener('dblclick', () => {
    if (!isGameActive) return;
    triggerTimedBoost(1500);
  });

  // 6. Mobile Controls
  const joystickZone = document.getElementById('joystickZone');
  const joystickBase = document.getElementById('joystickBase');
  const joystickStick = document.getElementById('joystickStick');
  const btnMobileBoost = document.getElementById('btnMobileBoost');

  let touchId = null;
  let joyCenter = { x: 0, y: 0 };

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    const rect = joystickBase.getBoundingClientRect();
    joyCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    updateJoystick(touch.clientX, touch.clientY);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchId) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  }, { passive: false });

  const endJoystick = (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        touchId = null;
        joystickStick.style.transform = 'translate(0px, 0px)';
        break;
      }
    }
  };

  joystickZone.addEventListener('touchend', endJoystick, { passive: false });
  joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });

  function updateJoystick(clientX, clientY) {
    const dx = clientX - joyCenter.x;
    const dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 45;

    targetAngle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);
    const stickX = Math.cos(targetAngle) * clampedDist;
    const stickY = Math.sin(targetAngle) * clampedDist;

    joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;

    if (gameMode === 'offline') {
      offlineEngine.setInput(targetAngle, isBoosting);
    }
  }

  btnMobileBoost.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!isGameActive) return;
    isBoosting = true;
    sound.playBoost();
    if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);
  }, { passive: false });

  btnMobileBoost.addEventListener('touchend', (e) => {
    e.preventDefault();
    isBoosting = false;
    if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (e.target.closest('#mobileControls') || e.target.closest('.modal-card')) return;
    const currentTime = new Date().getTime();
    if (currentTime - lastTapTime < 280 && currentTime - lastTapTime > 50) {
      triggerTimedBoost(1500);
    }
    lastTapTime = currentTime;
  });

  function triggerTimedBoost(durationMs) {
    isBoosting = true;
    sound.playBoost();
    if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);

    clearTimeout(boostTimeout);
    boostTimeout = setTimeout(() => {
      isBoosting = false;
      if (gameMode === 'offline') offlineEngine.setInput(targetAngle, isBoosting);
    }, durationMs);
  }

  // 7. Online Sync Interval (20 times/sec)
  setInterval(() => {
    if (isGameActive && gameMode === 'online' && socket.connected) {
      socket.emit('input', {
        targetAngle: Number(targetAngle.toFixed(3)),
        isBoosting: isBoosting
      });
    }
  }, 1000 / 20);

  // 8. Main Render Loop
  let lastFrameTime = performance.now();
  function renderLoop(currentTime) {
    const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = currentTime;
    const animTime = currentTime / 1000;

    renderer.render(latestState, localPlayerId, dt, animTime);
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // 9. Buttons
  document.getElementById('btnPlay').addEventListener('click', startGame);
  document.getElementById('btnPlayAgain').addEventListener('click', startGame);
  document.getElementById('btnBackToMenu').addEventListener('click', () => {
    offlineEngine.stop();
    ui.gameOverScreen.classList.add('hidden');
    ui.startScreen.classList.remove('hidden');
  });
});
