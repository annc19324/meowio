// Local Offline Game Engine for Meow.io (0ms Ping, Works 100% Offline without Server)
class OfflineEngine {
  constructor() {
    this.mapSize = 7000;
    this.targetBotCount = 28;
    this.targetFoodCount = 1500;

    this.player = null;
    this.bots = [];
    this.foods = [];
    this.foodIdCounter = 1;

    this.isRunning = false;
    this.lastTime = 0;
    this.animFrameId = null;

    this.events = [];
  }

  start(playerName, skin, onStateCallback, onGameOverCallback) {
    this.onState = onStateCallback;
    this.onGameOver = onGameOverCallback;

    // Create player
    this.player = {
      id: 'local_player',
      name: playerName || 'Mèo Offline',
      skin: skin || 'white',
      x: this.mapSize / 2,
      y: this.mapSize / 2,
      angle: 0,
      targetAngle: 0,
      size: 100,
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      isBoosting: false,
      isScratching: false,
      scratchTimer: 0,
      attackCooldown: 0.45,
      timeSinceAttack: 0,
      shieldHits: 0,
      gold: 0,
      diceCount: 0,
      buff: null,
      alive: true
    };

    // Initialize foods & bots
    this.foods = [];
    for (let i = 0; i < this.targetFoodCount; i++) {
      this.spawnFood();
    }

    this.bots = [];
    const botNames = ['Mèo Múp', 'Tom Ngố', 'Bánh Mì', 'Mèo Ú', 'Hoàng Thượng', 'Kem Bơ', 'Ninja Neko', 'Lạc Lạc', 'Mèo Cam'];
    const botSkins = ['orange', 'black', 'gray', 'rabbit', 'fox', 'lion', 'white'];

    for (let i = 0; i < this.targetBotCount; i++) {
      this.bots.push({
        id: 'bot_' + i,
        name: botNames[i % botNames.length] + ' ' + (i + 1),
        skin: botSkins[i % botSkins.length],
        x: 300 + Math.random() * (this.mapSize - 600),
        y: 300 + Math.random() * (this.mapSize - 600),
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        size: 90 + Math.floor(Math.random() * 180),
        hp: 100,
        maxHp: 100,
        energy: 100,
        isBoosting: false,
        isScratching: false,
        scratchTimer: 0,
        timeSinceAttack: 0,
        shieldHits: 0,
        wanderTimer: 0,
        alive: true
      });
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  surrender() {
    if (this.player && this.player.alive) {
      this.player.alive = false;
      this.stop();
      if (typeof this.onGameOver === 'function') {
        this.onGameOver({
          score: this.player.size,
          goldEarned: this.player.gold,
          diceEarned: this.player.diceCount,
          isSurrendered: true
        });
      }
    }
  }

  setInput(targetAngle, isBoosting) {
    if (this.player && this.player.alive) {
      this.player.targetAngle = targetAngle;
      this.player.isBoosting = isBoosting;
    }
  }

  getRadius(size) {
    return 24 + Math.sqrt(size) * 1.6;
  }

  spawnFood() {
    const roll = Math.random();
    let typeCode = 1; // 1: small, 2: big, 3: pate, 4: coin, 5: dice
    let radius = 6;
    let val = 5;

    if (roll < 0.46) {
      typeCode = 1; radius = 10; val = 15; // Hạt sáng nhỏ
    } else if (roll < 0.66) {
      typeCode = 2; radius = 16; val = 45; // Hạt sáng lớn
    } else if (roll < 0.74) {
      typeCode = 6; radius = 17; val = 30; // ⚡ Hạt tốc độ
    } else if (roll < 0.80) {
      typeCode = 7; radius = 18; val = 35; // 🧲 Nam châm
    } else if (roll < 0.85) {
      typeCode = 8; radius = 18; val = 35; // 🛡️ Khiên bảo vệ
    } else if (roll < 0.90) {
      typeCode = 3; radius = 24; val = 120; // 🥫 Hộp pate
    } else if (roll < 0.94) {
      typeCode = 9; radius = 19; val = 50; // 🌿 Cỏ mèo
    } else if (roll < 0.97) {
      typeCode = 10; radius = 26; val = 150; // 🐟 Cá vàng
    } else if (roll < 0.985) {
      typeCode = 4; radius = 14; val = 25; // 🪙 Đồng vàng
    } else if (roll < 0.995) {
      typeCode = 5; radius = 18; val = 0; // 🎲 Xúc xắc
    } else {
      typeCode = 11; radius = 24; val = 80; // ⭐ Siêu sao bất tử
    }

    const margin = 100;
    const food = [
      this.foodIdCounter++,
      typeCode,
      Math.round(margin + Math.random() * (this.mapSize - margin * 2)),
      Math.round(margin + Math.random() * (this.mapSize - margin * 2)),
      radius,
      val
    ];
    this.foods.push(food);
  }

  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    const allCats = [this.player, ...this.bots].filter(c => c.alive);

    // 1. Update Cats (Player & Bots)
    for (const cat of allCats) {
      // Angle smoothing
      let diff = cat.targetAngle - cat.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      const effectiveTurnSpeed = Math.max(7.0, 10.0 - Math.sqrt(Math.max(0, cat.size - 100)) * 0.06);
      cat.angle += Math.sign(diff) * Math.min(Math.abs(diff), effectiveTurnSpeed * dt);

      // Buff update
      let speedBuff = 1.0;
      if (cat.buff) {
        cat.buff.duration -= dt;
        if (cat.buff.type === 'speed') speedBuff = 1.35;
        else if (cat.buff.type === 'star') speedBuff = 1.5;
        else if (cat.buff.type === 'catnip') speedBuff = 1.15;
        if (cat.buff.duration <= 0) cat.buff = null;
      }

      // Speed & Boost (Bigger cats move FASTER)
      const baseSpeed = 270;
      const sizeMultiplier = Math.min(1.65, 1.0 + Math.sqrt(Math.max(0, cat.size - 100)) * 0.015);
      let speed = baseSpeed * sizeMultiplier * speedBuff;
      if (cat.isBoosting && cat.energy > 5) {
        speed *= 1.75;
        cat.energy = Math.max(0, cat.energy - 35 * dt);
        if (cat.energy <= 0) cat.isBoosting = false;
      } else {
        cat.isBoosting = false;
        cat.energy = Math.min(100, cat.energy + 18 * dt);
      }

      cat.x += Math.cos(cat.angle) * speed * dt;
      cat.y += Math.sin(cat.angle) * speed * dt;

      // Clamp boundary
      const r = this.getRadius(cat.size);
      cat.x = Math.max(r, Math.min(this.mapSize - r, cat.x));
      cat.y = Math.max(r, Math.min(this.mapSize - r, cat.y));

      // Timers
      cat.timeSinceAttack += dt;
      if (cat.scratchTimer > 0) {
        cat.scratchTimer -= dt;
        if (cat.scratchTimer <= 0) cat.isScratching = false;
      }

      // Simple Bot AI
      if (cat !== this.player) {
        cat.wanderTimer -= dt;
        if (cat.wanderTimer <= 0) {
          cat.wanderTimer = 1.0 + Math.random() * 1.5;
          // Look for food or player
          const dx = this.player.x - cat.x;
          const dy = this.player.y - cat.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 280 && cat.size > this.player.size * 1.1) {
            cat.targetAngle = Math.atan2(dy, dx); // Chase player!
            cat.isBoosting = dist < 140;
          } else if (dist < 220 && this.player.size > cat.size * 1.1) {
            cat.targetAngle = Math.atan2(-dy, -dx); // Flee from player!
            cat.isBoosting = dist < 120;
          } else {
            cat.targetAngle += (Math.random() - 0.5) * 1.6;
            cat.isBoosting = false;
          }
        }
      }
    }

    // Magnet Pull Effect
    for (const cat of allCats) {
      if (cat.buff && cat.buff.type === 'magnet') {
        const pullRange = 320;
        for (let j = 0; j < this.foods.length; j++) {
          const f = this.foods[j];
          const dx = cat.x - f[2];
          const dy = cat.y - f[3];
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < pullRange) {
            f[2] += (dx / dist) * 400 * dt;
            f[3] += (dy / dist) * 400 * dt;
          }
        }
      }
    }

    // 2. Combat Scratch Hits
    for (const attacker of allCats) {
      if (attacker.timeSinceAttack < 0.45) continue;
      const attRadius = this.getRadius(attacker.size);

      for (const victim of allCats) {
        if (victim === attacker) continue;
        const vicRadius = this.getRadius(victim.size);
        const dx = victim.x - attacker.x;
        const dy = victim.y - attacker.y;
        const dist = Math.hypot(dx, dy);

        if (dist > attRadius + vicRadius + 30) continue;

        let angleDiff = Math.atan2(dy, dx) - attacker.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        if (Math.abs(angleDiff) <= 0.85) {
          attacker.timeSinceAttack = 0;
          attacker.isScratching = true;
          attacker.scratchTimer = 0.25;

          const ratio = attacker.size / victim.size;
          let damage = ratio >= 1.0 ? Math.round(18 * Math.min(2.5, ratio)) : Math.max(3, Math.round(18 * ratio * 0.7));

          if (attacker.buff && attacker.buff.type === 'catnip') damage = Math.round(damage * 1.5);
          else if (attacker.buff && attacker.buff.type === 'star') damage = Math.round(damage * 2.0);

          let absorbed = false;
          if (victim.buff && victim.buff.type === 'star') {
            damage = 0;
            absorbed = true;
          } else if (victim.shieldHits > 0) {
            victim.shieldHits--;
            damage = 0;
            absorbed = true;
          } else {
            victim.hp = Math.max(0, victim.hp - damage);
          }

          const hitX = Math.round(attacker.x + Math.cos(attacker.angle) * (attRadius + 15));
          const hitY = Math.round(attacker.y + Math.sin(attacker.angle) * (attRadius + 15));

          this.events.push({
            type: 'scratch',
            attackerId: attacker.id,
            victimId: victim.id,
            damage: damage,
            absorbed: absorbed,
            hitX, hitY
          });

          if (victim.hp <= 0 && !absorbed) {
            victim.alive = false;
            attacker.size += Math.round(victim.size * 0.35);
            attacker.gold = (attacker.gold || 0) + 35;

            this.events.push({
              type: 'kill',
              killerName: attacker.name,
              victimName: victim.name
            });

            if (victim === this.player) {
              this.onGameOver({
                score: this.player.size,
                goldEarned: this.player.gold,
                diceEarned: this.player.diceCount
              });
            }
          }
          break;
        }
      }
    }

    // 3. Food Eating
    const playerRadius = this.getRadius(this.player.size);
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      const dx = f[2] - this.player.x;
      const dy = f[3] - this.player.y;
      if (dx * dx + dy * dy <= (playerRadius + f[4]) * (playerRadius + f[4])) {
        const type = f[1];
        if (type === 1) { this.player.size += 15; this.player.gold += 1; }
        else if (type === 2) { this.player.size += 45; this.player.gold += 3; }
        else if (type === 3) {
          this.player.size += 120;
          this.player.hp = Math.min(100, this.player.hp + 35);
          this.player.gold += 8;
          this.events.push({ type: 'eat_pate', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 4) {
          this.player.gold += 25;
          this.events.push({ type: 'coin_pickup', playerId: this.player.id, gold: 25 });
        }
        else if (type === 5) {
          this.player.diceCount++;
          this.events.push({ type: 'dice_pickup', playerId: this.player.id, buffType: 'speed' });
        }
        else if (type === 6) {
          this.player.size += 30;
          this.player.energy = 100;
          this.player.buff = { type: 'speed', duration: 5 };
          this.events.push({ type: 'eat_speed_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 7) {
          this.player.size += 35;
          this.player.buff = { type: 'magnet', duration: 7 };
          this.player.gold += 3;
          this.events.push({ type: 'eat_magnet_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 8) {
          this.player.size += 35;
          this.player.shieldHits = Math.min(4, (this.player.shieldHits || 0) + 2);
          this.player.gold += 3;
          this.events.push({ type: 'eat_shield_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 9) {
          this.player.size += 50;
          this.player.hp = Math.min(100, this.player.hp + 25);
          this.player.buff = { type: 'catnip', duration: 6 };
          this.player.gold += 5;
          this.events.push({ type: 'eat_catnip_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 10) {
          this.player.size += 150;
          this.player.hp = Math.min(100, this.player.hp + 50);
          this.player.gold += 20;
          this.events.push({ type: 'eat_fish_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 11) {
          this.player.size += 80;
          this.player.buff = { type: 'star', duration: 5 };
          this.player.gold += 30;
          this.events.push({ type: 'eat_star_orb', playerId: this.player.id, x: f[2], y: f[3] });
        }

        this.foods.splice(i, 1);
        this.spawnFood();
      }
    }

    // 4. Construct State for Renderer & HUD
    const catsFormatted = allCats.map(c => ({
      id: c.id,
      name: c.name,
      skin: c.skin,
      x: Math.round(c.x),
      y: Math.round(c.y),
      angle: c.angle,
      size: Math.round(c.size),
      radius: Math.round(this.getRadius(c.size)),
      hp: Math.round(c.hp),
      maxHp: 100,
      energy: Math.round(c.energy),
      isBoosting: c.isBoosting,
      isScratching: c.isScratching,
      shieldHits: c.shieldHits,
      buff: c.buff ? { type: c.buff.type, duration: Number(c.buff.duration.toFixed(1)) } : null,
      hasSpeedBuff: c.buff && (c.buff.type === 'speed' || c.buff.type === 'star'),
      gold: c.gold,
      diceCount: c.diceCount
    }));

    const leaderboard = catsFormatted
      .map(c => ({ id: c.id, name: c.name, score: c.size, skin: c.skin }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const leaderId = leaderboard[0] ? leaderboard[0].id : null;

    const minimap = catsFormatted.map(c => ({
      x: c.x,
      y: c.y,
      isLeader: c.id === leaderId
    }));

    this.onState({
      mapSize: this.mapSize,
      players: catsFormatted,
      foods: this.foods,
      leaderboard: leaderboard,
      minimap: minimap,
      events: this.events
    });

    this.events = [];
  }
}

window.OfflineEngine = OfflineEngine;
