const Player = require('./Player');
const Bot = require('./Bot');
const Food = require('./Food');

// Numerical Food Type Constants for ultra-fast compact serialization
const FOOD_TYPE_MAP = {
  'light_small': 1,
  'light_big': 2,
  'pate': 3,
  'coin': 4,
  'dice': 5,
  'speed_orb': 6,
  'magnet_orb': 7,
  'shield_orb': 8,
  'catnip_orb': 9,
  'fish_orb': 10,
  'star_orb': 11
};

class GameEngine {
  constructor(io) {
    this.io = io;
    this.mapSize = 10000;
    this.players = new Map(); // socket.id -> Player
    this.bots = new Map(); // bot.id -> Bot
    this.foods = new Map(); // food.id -> Food
    this.foodIdCounter = 1;

    // Online Mode: Only Real Players! Zero Bots.
    this.targetFoodCount = 1500;

    // Spatial partitioning grid (600x600 px cells)
    this.cellSize = 600;
    this.gridCols = Math.ceil(this.mapSize / this.cellSize);
    this.foodGrid = new Map();
    this.catGrid = new Map();

    // Minimap sync throttle counter
    this.tickCount = 0;
    this.cachedMinimap = [];

    // Events to broadcast in the next tick
    this.events = [];

    // Initialize foods (No bots spawned online)
    this.initFoods();

    // Highly optimized 20 TPS (Ticks Per Second) - standard for .io games
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 20);
  }

  getCellKey(x, y) {
    const cx = Math.max(0, Math.min(this.gridCols - 1, Math.floor(x / this.cellSize)));
    const cy = Math.max(0, Math.min(this.gridCols - 1, Math.floor(y / this.cellSize)));
    return `${cx},${cy}`;
  }

  initFoods() {
    for (let i = 0; i < this.targetFoodCount; i++) {
      this.spawnFood();
    }
  }

  initBots() {
    for (let i = 0; i < this.targetBotCount; i++) {
      this.spawnBot();
    }
  }

  spawnBot() {
    const id = 'bot_' + Math.random().toString(36).substring(2, 9);
    const x = 300 + Math.random() * (this.mapSize - 600);
    const y = 300 + Math.random() * (this.mapSize - 600);
    const bot = new Bot(id, x, y);
    this.bots.set(id, bot);
  }

  spawnFood(typeOverride = null, spawnX = null, spawnY = null) {
    const id = this.foodIdCounter++;
    let type = typeOverride;

    if (!type) {
      const roll = Math.random();
      if (roll < 0.46) type = 'light_small';          // 46% Hạt nhỏ
      else if (roll < 0.66) type = 'light_big';        // 20% Hạt to
      else if (roll < 0.74) type = 'speed_orb';        // 8%  ⚡ Hạt tốc độ
      else if (roll < 0.80) type = 'magnet_orb';       // 6%  🧲 Nam châm hút hạt
      else if (roll < 0.85) type = 'shield_orb';       // 5%  🛡️ Khiên bảo vệ
      else if (roll < 0.90) type = 'pate';             // 5%  🥫 Hộp pate
      else if (roll < 0.94) type = 'catnip_orb';       // 4%  🌿 Cỏ mèo cuồng nộ
      else if (roll < 0.97) type = 'fish_orb';         // 3%  🐟 Cá vàng béo ngậy
      else if (roll < 0.985) type = 'coin';            // 1.5% 🪙 Đồng vàng
      else if (roll < 0.995) type = 'dice';            // 1%  🎲 Xúc xắc
      else type = 'star_orb';                          // 0.5% ⭐ Ngôi sao bất tử
    }

    const margin = 120;
    const x = spawnX !== null ? spawnX : margin + Math.random() * (this.mapSize - margin * 2);
    const y = spawnY !== null ? spawnY : margin + Math.random() * (this.mapSize - margin * 2);

    const food = new Food(id, type, x, y);
    this.foods.set(id, food);

    // Add to spatial grid
    const key = this.getCellKey(x, y);
    if (!this.foodGrid.has(key)) {
      this.foodGrid.set(key, new Set());
    }
    this.foodGrid.get(key).add(food);

    return food;
  }

  removeFood(food) {
    this.foods.delete(food.id);
    const key = this.getCellKey(food.x, food.y);
    const cell = this.foodGrid.get(key);
    if (cell) {
      cell.delete(food);
    }
  }

  addPlayer(socketId, name, skin) {
    const player = new Player(socketId, name, skin, false);
    player.x = 400 + Math.random() * (this.mapSize - 800);
    player.y = 400 + Math.random() * (this.mapSize - 800);
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || !player.alive) return;

    if (typeof input.targetAngle === 'number') {
      player.targetAngle = input.targetAngle;
    }
    if (typeof input.isBoosting === 'boolean') {
      player.isBoosting = input.isBoosting;
    }
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.1);
    this.lastTick = now;
    this.tickCount++;

    const allCats = [...this.players.values()];

    // 1. Rebuild Spatial Grid for Players
    this.catGrid.clear();
    for (const cat of allCats) {
      if (!cat.alive) continue;
      const key = this.getCellKey(cat.x, cat.y);
      if (!this.catGrid.has(key)) {
        this.catGrid.set(key, []);
      }
      this.catGrid.get(key).push(cat);
    }

    // 2. Update physics
    for (const cat of allCats) {
      cat.update(dt, this.mapSize);
    }

    // 2.5 Update Magnet Pull for cats with magnet buff
    for (const cat of allCats) {
      if (cat.alive && cat.buff && cat.buff.type === 'magnet') {
        const pullRadius = 340;
        const pullRadiusSq = pullRadius * pullRadius;
        const candidateFoods = this.getNearbyFoods(cat.x, cat.y, 1);
        for (const food of candidateFoods) {
          const dx = cat.x - food.x;
          const dy = cat.y - food.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < pullRadiusSq) {
            const dist = Math.sqrt(distSq);
            const pullSpeed = 420 * dt;
            const oldKey = this.getCellKey(food.x, food.y);
            food.x += (dx / dist) * pullSpeed;
            food.y += (dy / dist) * pullSpeed;
            const newKey = this.getCellKey(food.x, food.y);
            if (oldKey !== newKey) {
              const oldCell = this.foodGrid.get(oldKey);
              if (oldCell) oldCell.delete(food);
              if (!this.foodGrid.has(newKey)) this.foodGrid.set(newKey, new Set());
              this.foodGrid.get(newKey).add(food);
            }
          }
        }
      }
    }

    // 3. Scratch attacks between players
    this.checkScratchAttacks(allCats);

    // 4. Food collisions
    this.checkFoodCollisions(allCats);

    // 5. Handle dead players
    for (const [id, player] of this.players.entries()) {
      if (!player.alive && !player.hasHandledDeath) {
        player.hasHandledDeath = true;
        this.dropDeathLoot(player);
        this.io.to(id).emit('gameOver', {
          score: player.size,
          goldEarned: player.gold,
          diceEarned: player.diceCount
        });
        if (typeof this.onPlayerDeath === 'function') {
          this.onPlayerDeath(player);
        }
      }
    }

    // Replenish foods
    while (this.foods.size < this.targetFoodCount) {
      this.spawnFood();
    }

    // 7. Area-of-Interest Optimized Broadcast
    this.broadcastStateOptimized(allCats);
  }

  getNearbyCats(x, y, radiusInCells = 1) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const results = [];

    for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
      for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.catGrid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }

  getNearbyFoods(x, y, radiusInCells = 1) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const results = [];

    for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
      for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.foodGrid.get(key);
        if (cell) {
          for (const f of cell) {
            results.push(f);
          }
        }
      }
    }
    return results;
  }

  checkScratchAttacks(cats) {
    const scratchArc = 0.85;

    for (const attacker of cats) {
      if (!attacker.alive || !attacker.canScratch()) continue;

      const attackerRadius = attacker.getRadius();
      const scratchReach = attackerRadius + 30;
      const candidates = this.getNearbyCats(attacker.x, attacker.y, 1);

      for (const victim of candidates) {
        if (victim.id === attacker.id || !victim.alive) continue;

        const victimRadius = victim.getRadius();
        const dx = victim.x - attacker.x;
        const dy = victim.y - attacker.y;
        const dist = Math.hypot(dx, dy);

        if (dist > attackerRadius + victimRadius + scratchReach) continue;

        const angleToVictim = Math.atan2(dy, dx);
        let angleDiff = angleToVictim - attacker.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        if (Math.abs(angleDiff) <= scratchArc) {
          attacker.performScratch();

          const baseDamage = 18;
          const sizeRatio = attacker.size / victim.size;
          let damage = 0;

          if (sizeRatio >= 1.0) {
            damage = Math.round(baseDamage * Math.min(2.5, sizeRatio));
          } else if (sizeRatio >= 0.5) {
            damage = Math.round(baseDamage * sizeRatio * 0.7);
          } else {
            damage = Math.max(3, Math.round(baseDamage * 0.2));
          }

          // Buff damage boost (Catnip +50%, Super Star +100%)
          if (attacker.buff && attacker.buff.type === 'catnip') {
            damage = Math.round(damage * 1.5);
          } else if (attacker.buff && attacker.buff.type === 'star') {
            damage = Math.round(damage * 2.0);
          }

          const result = victim.takeDamage(damage, attacker);

          const hitX = Math.round(attacker.x + Math.cos(attacker.angle) * (attackerRadius + 15));
          const hitY = Math.round(attacker.y + Math.sin(attacker.angle) * (attackerRadius + 15));

          this.events.push({
            type: 'scratch',
            attackerId: attacker.id,
            victimId: victim.id,
            damage: result.damage,
            absorbed: result.absorbed,
            hitX,
            hitY
          });

          if (result.killed) {
            attacker.size += Math.round(victim.size * 0.35);
            attacker.gold += 35;
            this.events.push({
              type: 'kill',
              killerId: attacker.id,
              killerName: attacker.name,
              victimId: victim.id,
              victimName: victim.name
            });
          }

          break;
        }
      }
    }
  }

  checkFoodCollisions(cats) {
    for (const cat of cats) {
      if (!cat.alive) continue;
      const catRadius = cat.getRadius();
      const candidateFoods = this.getNearbyFoods(cat.x, cat.y, 1);

      for (const food of candidateFoods) {
        const dx = food.x - cat.x;
        const dy = food.y - cat.y;
        const reach = catRadius + food.radius;

        if (dx * dx + dy * dy <= reach * reach) {
          this.removeFood(food);

          if (food.type === 'light_small') {
            cat.size += food.value;
            cat.gold += 1;
          } else if (food.type === 'light_big') {
            cat.size += food.value;
            cat.gold += 3;
          } else if (food.type === 'pate') {
            cat.size += food.value;
            cat.hp = Math.min(cat.maxHp, cat.hp + food.heal);
            cat.gold += 5;
            this.events.push({
              type: 'eat_pate',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'coin') {
            cat.gold += food.gold;
            this.events.push({
              type: 'coin_pickup',
              playerId: cat.id,
              gold: food.gold
            });
          } else if (food.type === 'speed_orb') {
            cat.size += food.value;
            cat.energy = 100;
            cat.buff = { type: 'speed', duration: 5 };
            cat.gold += 2;
            this.events.push({
              type: 'eat_speed_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'magnet_orb') {
            cat.size += food.value;
            cat.buff = { type: 'magnet', duration: 7 };
            cat.gold += 2;
            this.events.push({
              type: 'eat_magnet_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'shield_orb') {
            cat.size += food.value;
            cat.shieldHits = Math.min(4, cat.shieldHits + 2);
            cat.gold += 2;
            this.events.push({
              type: 'eat_shield_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'catnip_orb') {
            cat.size += food.value;
            cat.hp = Math.min(cat.maxHp, cat.hp + food.heal);
            cat.buff = { type: 'catnip', duration: 6 };
            cat.gold += 3;
            this.events.push({
              type: 'eat_catnip_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'fish_orb') {
            cat.size += food.value;
            cat.hp = Math.min(cat.maxHp, cat.hp + food.heal);
            cat.gold += food.gold;
            this.events.push({
              type: 'eat_fish_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'star_orb') {
            cat.size += food.value;
            cat.buff = { type: 'star', duration: 5 };
            cat.gold += food.gold;
            this.events.push({
              type: 'eat_star_orb',
              playerId: cat.id,
              x: food.x,
              y: food.y
            });
          } else if (food.type === 'dice') {
            const buffType = cat.applyDiceBuff();
            this.events.push({
              type: 'dice_pickup',
              playerId: cat.id,
              buffType: buffType
            });
          }
        }
      }
    }
  }

  dropDeathLoot(cat) {
    const orbCount = Math.min(18, Math.max(5, Math.floor(cat.size / 30)));
    const spread = cat.getRadius() * 1.5;

    for (let i = 0; i < orbCount; i++) {
      const angle = (Math.PI * 2 / orbCount) * i + Math.random() * 0.4;
      const dist = Math.random() * spread;
      const lx = Math.max(80, Math.min(this.mapSize - 80, cat.x + Math.cos(angle) * dist));
      const ly = Math.max(80, Math.min(this.mapSize - 80, cat.y + Math.sin(angle) * dist));

      const type = Math.random() < 0.25 ? 'light_big' : 'light_small';
      this.spawnFood(type, lx, ly);
    }

    if (Math.random() < 0.7) {
      this.spawnFood('pate', cat.x, cat.y);
    }
    if (Math.random() < 0.5) {
      this.spawnFood('coin', cat.x + 20, cat.y - 15);
    }
    // 35% chance to drop a random special orb on death
    if (Math.random() < 0.35) {
      const specialTypes = ['fish_orb', 'catnip_orb', 'magnet_orb', 'shield_orb', 'speed_orb'];
      const chosen = specialTypes[Math.floor(Math.random() * specialTypes.length)];
      this.spawnFood(chosen, cat.x - 20, cat.y + 20);
    }
  }

  broadcastStateOptimized(allCats) {
    const aliveCats = allCats.filter(c => c.alive);

    // Compute Global Leaderboard Top 10
    const leaderboard = aliveCats
      .map(c => ({ id: c.id, name: c.name, score: c.size, skin: c.skin }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const leaderId = leaderboard.length > 0 ? leaderboard[0].id : null;

    // Minimap updated every 4 ticks (5 Hz) to save massive bandwidth
    let minimapToSend = null;
    if (this.tickCount % 4 === 0 || this.cachedMinimap.length === 0) {
      this.cachedMinimap = aliveCats.map(c => ({
        x: Math.round(c.x),
        y: Math.round(c.y),
        isLeader: c.id === leaderId,
        size: c.size
      }));
      minimapToSend = this.cachedMinimap;
    }

    const viewRadiusX = 1600; // Expanded Viewport for Zoomed-Out Mobile View
    const viewRadiusY = 1100;

    for (const [socketId, player] of this.players.entries()) {
      if (!player) continue;

      // Filter cats in player's viewport
      const visibleCats = aliveCats
        .filter(c => Math.abs(c.x - player.x) <= viewRadiusX && Math.abs(c.y - player.y) <= viewRadiusY)
        .map(c => c.toJSON());

      // Filter foods (radius 3 cells = 1800px)
      const visibleFoods = this.getNearbyFoods(player.x, player.y, 3).map(f => [
        f.id,
        FOOD_TYPE_MAP[f.type] || 1,
        Math.round(f.x),
        Math.round(f.y),
        f.radius
      ]);

      // Filter events
      const nearbyEvents = this.events.filter(ev => {
        if (ev.hitX !== undefined) {
          return Math.abs(ev.hitX - player.x) <= viewRadiusX && Math.abs(ev.hitY - player.y) <= viewRadiusY;
        }
        return true;
      });

      const payload = {
        mapSize: this.mapSize,
        players: visibleCats,
        foods: visibleFoods,
        leaderboard: leaderboard,
        events: nearbyEvents
      };

      if (minimapToSend) {
        payload.minimap = minimapToSend;
      }

      this.io.to(socketId).emit('state', payload);
    }

    this.events = [];
  }
}

module.exports = GameEngine;
