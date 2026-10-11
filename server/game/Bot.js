const Player = require('./Player');

const BOT_NAMES = [
  'Mèo Béo', 'Miu Miu', 'Mướp Con', 'Mun Mun', 'Hoàng Thượng', 
  'Tom Ngáo', 'Bánh Bao', 'Bơ Lạc', 'Mèo Cam 99', 'Lạc Lạc', 
  'Kem Dâu', 'Sữa Tươi', 'Mèo Đốm', 'Bé Cát', 'Ninja Neko'
];

const BOT_SKINS = [
  'white', 'orange', 'black', 'gray', 'rabbit', 'fox', 'lion'
];

class Bot extends Player {
  constructor(id, x, y) {
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const randomSkin = BOT_SKINS[Math.floor(Math.random() * BOT_SKINS.length)];
    super(id, randomName, randomSkin, true);

    this.x = x;
    this.y = y;
    // Bots can spawn with varying initial sizes (from kitten 100 to 300)
    this.size = 100 + Math.floor(Math.random() * 180);

    this.aiTickTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.targetFood = null;
    this.targetPlayer = null;
  }

  updateAI(dt, players, foods, mapSize) {
    this.aiTickTimer -= dt;
    if (this.aiTickTimer > 0) return;
    this.aiTickTimer = 0.15 + Math.random() * 0.1; // Evaluate AI every 150-250ms

    if (!this.alive) return;

    let nearestThreat = null;
    let threatDistSq = Infinity;

    let nearestPrey = null;
    let preyDistSq = Infinity;

    const myRadius = this.getRadius();

    // 1. Scan other players / bots
    for (const other of players) {
      if (other.id === this.id || !other.alive) continue;

      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distSq = dx * dx + dy * dy;

      // Big threat: predator size > 1.25x my size
      if (other.size > this.size * 1.25) {
        if (distSq < 260 * 260 && distSq < threatDistSq) {
          threatDistSq = distSq;
          nearestThreat = other;
        }
      } 
      // Potential prey: smaller or similar size
      else if (distSq < 220 * 220 && distSq < preyDistSq) {
        preyDistSq = distSq;
        nearestPrey = other;
      }
    }

    // 2. Decision Tree
    // Priority A: Flee from massive predator
    if (nearestThreat) {
      const fleeAngle = Math.atan2(this.y - nearestThreat.y, this.x - nearestThreat.x);
      this.targetAngle = fleeAngle;
      // Boost if close danger
      this.isBoosting = threatDistSq < 130 * 130 && this.energy > 35;
      return;
    }

    // Priority B: Chase and scratch prey
    if (nearestPrey) {
      const chaseAngle = Math.atan2(nearestPrey.y - this.y, nearestPrey.x - this.x);
      this.targetAngle = chaseAngle;
      // Boost to pounce!
      this.isBoosting = preyDistSq < 140 * 140 && this.energy > 40;
      return;
    }

    // Priority C: Hunt for Food (Pate > Big Light > Coin > Small Light)
    let bestFood = null;
    let bestScore = -Infinity;

    // Sample nearest foods
    for (let i = 0; i < Math.min(foods.length, 30); i++) {
      const food = foods[Math.floor(Math.random() * foods.length)];
      if (!food) continue;

      const dx = food.x - this.x;
      const dy = food.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 400) continue;

      let score = (food.value || 10) / (dist + 50);
      if (food.type === 'pate') score *= 3.0; // Cats LOVE pate!
      if (food.type === 'dice') score *= 2.0;

      if (score > bestScore) {
        bestScore = score;
        bestFood = food;
      }
    }

    if (bestFood) {
      this.targetAngle = Math.atan2(bestFood.y - this.y, bestFood.x - this.x);
      this.isBoosting = false;
      return;
    }

    // Priority D: Wander naturally
    // Steer away from walls
    const margin = 150;
    if (this.x < margin) this.wanderAngle = 0;
    else if (this.x > mapSize - margin) this.wanderAngle = Math.PI;
    else if (this.y < margin) this.wanderAngle = Math.PI / 2;
    else if (this.y > mapSize - margin) this.wanderAngle = -Math.PI / 2;
    else if (Math.random() < 0.1) {
      this.wanderAngle += (Math.random() - 0.5) * 1.5;
    }

    this.targetAngle = this.wanderAngle;
    this.isBoosting = false;
  }
}

module.exports = Bot;
