class Player {
  constructor(id, name, skin = 'white', isBot = false) {
    this.id = id;
    this.name = name || 'Mèo ' + Math.floor(Math.random() * 1000);
    this.skin = skin;
    this.isBot = isBot;

    // Position and Movement
    this.x = 0;
    this.y = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;

    // Core Stats
    this.size = 100;
    this.hp = 100;
    this.maxHp = 100;
    this.energy = 100;
    this.maxEnergy = 100;
    this.alive = true;

    // Movement & Boost
    this.isBoosting = false;
    this.baseSpeed = 270; // Base speed for kittens (270 px/s)
    this.boostMultiplier = 1.75;
    this.turnSpeed = 10.0; // Base turn speed for agile steering

    // Combat & Scratch Mechanics
    this.attackCooldown = 0.45; // Seconds between scratches
    this.timeSinceLastAttack = 0;
    this.isScratching = false;
    this.scratchAnimationTimer = 0;
    this.lastAttackerId = null;

    // Currency & Items
    this.gold = 0;
    this.diceCount = 0;

    // Buffs
    this.buff = null; // { type, duration }
    this.shieldHits = 0;
  }

  getRadius() {
    // Compact body cap: starts at 26px, gently scales up to max 38px
    // Prevents giant bloated bodies from obscuring the screen on mobile/desktop!
    return Math.min(38, 26 + Math.sqrt(Math.max(0, this.size - 100)) * 0.16);
  }

  getLevel() {
    if (this.size >= 4500) return 5;
    if (this.size >= 2000) return 4;
    if (this.size >= 900) return 3;
    if (this.size >= 350) return 2;
    return 1;
  }

  getFoodSuctionReach() {
    // High-level cats naturally vacuum food from slightly further away
    return Math.min(26, Math.sqrt(Math.max(0, this.size - 100)) * 0.38);
  }

  getScratchBonus() {
    // Higher evolution cats project longer phantom claw slashes
    return Math.min(28, Math.sqrt(Math.max(0, this.size - 100)) * 0.42);
  }

  getScratchRange() {
    return this.getRadius() + 30 + this.getScratchBonus();
  }

  update(dt, mapSize) {
    if (!this.alive) return;

    // 1. Angular Interpolation (Turn smoothly towards target angle)
    let diff = this.targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const effectiveTurnSpeed = Math.max(7.0, this.turnSpeed - Math.sqrt(Math.max(0, this.size - 100)) * 0.06);
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), effectiveTurnSpeed * dt);

    // 2. Buff update
    let speedBuff = 1.0;
    if (this.buff) {
      this.buff.duration -= dt;
      if (this.buff.type === 'speed') speedBuff = 1.35;
      else if (this.buff.type === 'star') speedBuff = 1.5;
      else if (this.buff.type === 'catnip') speedBuff = 1.15;

      if (this.buff.duration <= 0) {
        this.buff = null;
      }
    }

    // 3. Energy & Boost Logic
    // Bigger cats move FASTER due to massive stride and titan momentum!
    const sizeMultiplier = Math.min(1.65, 1.0 + Math.sqrt(Math.max(0, this.size - 100)) * 0.015);
    let currentSpeed = this.baseSpeed * sizeMultiplier * speedBuff;
    if (this.isBoosting && this.energy > 5) {
      currentSpeed *= this.boostMultiplier;
      this.energy = Math.max(0, this.energy - 35 * dt);
      if (this.energy <= 0) {
        this.isBoosting = false;
      }
    } else {
      this.isBoosting = false;
      this.energy = Math.min(this.maxEnergy, this.energy + 18 * dt);
    }

    // 4. Update Position
    this.x += Math.cos(this.angle) * currentSpeed * dt;
    this.y += Math.sin(this.angle) * currentSpeed * dt;

    // Clamp within Map Boundaries
    const r = this.getRadius();
    this.x = Math.max(r, Math.min(mapSize - r, this.x));
    this.y = Math.max(r, Math.min(mapSize - r, this.y));

    // 5. Combat Timers
    this.timeSinceLastAttack += dt;
    if (this.scratchAnimationTimer > 0) {
      this.scratchAnimationTimer -= dt;
      if (this.scratchAnimationTimer <= 0) {
        this.isScratching = false;
      }
    }
  }

  canScratch() {
    const cd = (this.buff && this.buff.type === 'catnip') ? 0.22 : this.attackCooldown;
    return this.alive && this.timeSinceLastAttack >= cd;
  }

  performScratch() {
    this.timeSinceLastAttack = 0;
    this.isScratching = true;
    this.scratchAnimationTimer = 0.25; // 250ms visual swipe
  }

  takeDamage(amount, attacker) {
    if (!this.alive) return false;

    // Super Star invincibility
    if (this.buff && this.buff.type === 'star') {
      return { absorbed: true, damage: 0, killed: false };
    }

    // Shield check
    if (this.shieldHits > 0) {
      this.shieldHits--;
      return { absorbed: true, damage: 0, killed: false };
    }

    this.hp = Math.max(0, this.hp - amount);
    this.lastAttackerId = attacker ? attacker.id : null;

    if (this.hp <= 0) {
      this.alive = false;
      return { absorbed: false, damage: amount, killed: true };
    }

    return { absorbed: false, damage: amount, killed: false };
  }

  applyDiceBuff() {
    this.diceCount++;
    const roll = Math.random();
    let buffType = 'speed';

    if (roll < 0.25) {
      buffType = 'speed';
      this.buff = { type: 'speed', duration: 7 };
    } else if (roll < 0.5) {
      buffType = 'heal';
      this.hp = Math.min(this.maxHp, this.hp + 50);
    } else if (roll < 0.7) {
      buffType = 'shield';
      this.shieldHits = 2;
    } else if (roll < 0.85) {
      buffType = 'size';
      this.size = Math.round(this.size * 1.15);
    } else {
      buffType = 'gold';
      this.gold += 50;
    }

    return buffType;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      skin: this.skin,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(2)),
      size: Math.round(this.size),
      radius: Math.round(this.getRadius()),
      level: this.getLevel(),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      energy: Math.round(this.energy),
      isBoosting: this.isBoosting,
      isScratching: this.isScratching,
      shieldHits: this.shieldHits,
      buff: this.buff ? { type: this.buff.type, duration: Number(this.buff.duration.toFixed(1)) } : null,
      hasSpeedBuff: this.buff && (this.buff.type === 'speed' || this.buff.type === 'star'),
      gold: this.gold,
      diceCount: this.diceCount,
      isBot: this.isBot
    };
  }
}

module.exports = Player;
