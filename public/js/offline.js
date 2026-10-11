// Local Offline Game Engine for Meow.io (0ms Ping, Works 100% Offline without Server)
class OfflineEngine {
  constructor() {
    this.mapSize = 7000;
    this.targetBotCount = 28;
    this.targetFoodCount = 700;

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

    if (roll < 0.65) {
      typeCode = 1; radius = 6; val = 5;
    } else if (roll < 0.85) {
      typeCode = 2; radius = 11; val = 20;
    } else if (roll < 0.92) {
      typeCode = 3; radius = 16; val = 50;
    } else if (roll < 0.96) {
      typeCode = 4; radius = 10; val = 15;
    } else {
      typeCode = 5; radius = 14; val = 0;
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
      cat.angle += Math.sign(diff) * Math.min(Math.abs(diff), 8.5 * dt);

      // Speed & Boost
      let speed = 190 * (120 / (100 + cat.size * 0.15));
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
          const damage = ratio >= 1.0 ? Math.round(18 * Math.min(2.5, ratio)) : Math.max(3, Math.round(18 * ratio * 0.7));

          victim.hp = Math.max(0, victim.hp - damage);

          const hitX = Math.round(attacker.x + Math.cos(attacker.angle) * (attRadius + 15));
          const hitY = Math.round(attacker.y + Math.sin(attacker.angle) * (attRadius + 15));

          this.events.push({
            type: 'scratch',
            attackerId: attacker.id,
            victimId: victim.id,
            damage: damage,
            hitX, hitY
          });

          if (victim.hp <= 0) {
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
        if (type === 1) { this.player.size += 5; this.player.gold += 1; }
        else if (type === 2) { this.player.size += 20; this.player.gold += 3; }
        else if (type === 3) {
          this.player.size += 50;
          this.player.hp = Math.min(100, this.player.hp + 25);
          this.player.gold += 5;
          this.events.push({ type: 'eat_pate', playerId: this.player.id, x: f[2], y: f[3] });
        }
        else if (type === 4) {
          this.player.gold += 15;
          this.events.push({ type: 'coin_pickup', playerId: this.player.id, gold: 15 });
        }
        else if (type === 5) {
          this.player.diceCount++;
          this.events.push({ type: 'dice_pickup', playerId: this.player.id, buffType: 'speed' });
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
