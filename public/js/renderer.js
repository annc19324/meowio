// High-Performance Zero-Lag HTML5 Canvas Renderer for Meow.io
class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }); // Disable canvas alpha for maximum GPU performance
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera = { x: 5000, y: 5000, zoom: 1.0 };
    this.particles = [];
    this.floatingTexts = [];
    this.scratchEffects = [];
    this.ambientStars = [];
    this.latestMinimap = [];

    this.initCanvasSize();
    this.initAmbientStars();
    window.addEventListener('resize', () => this.initCanvasSize());
  }

  initCanvasSize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initAmbientStars() {
    this.ambientStars = [];
    for (let i = 0; i < 180; i++) {
      this.ambientStars.push({
        x: Math.random() * 10000,
        y: Math.random() * 10000,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.15
      });
    }
  }

  addFloatingText(text, x, y, color = '#ff4757', size = 16) {
    this.floatingTexts.push({
      text, x, y, color, size,
      vy: -1.6,
      life: 0.9
    });
  }

  addScratchEffect(x, y, angle) {
    this.scratchEffects.push({
      x, y, angle,
      life: 0.28,
      maxLife: 0.28
    });
  }

  addSparks(x, y, color = '#ffa502', count = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 80 + 20;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: Math.random() * 2.5 + 1.5,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  render(gameState, localPlayerId, dt, animTime) {
    const ctx = this.ctx;
    if (!gameState) {
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    if (gameState.minimap) {
      this.latestMinimap = gameState.minimap;
    }

    // 1. Follow Local Player smoothly & Dynamic Zoom Out
    const me = gameState.players.find(p => p.id === localPlayerId);
    if (me) {
      this.camera.x += (me.x - this.camera.x) * 0.15;
      this.camera.y += (me.y - this.camera.y) * 0.15;

      const isMobile = this.width < 900 || this.height < 550;
      // Mobile zoom out more: base 0.58 down to 0.38 (twice as far view distance!)
      const maxZoom = isMobile ? 0.58 : 0.95;
      const minZoom = isMobile ? 0.38 : 0.65;
      const targetZoom = Math.max(minZoom, maxZoom - (me.size - 100) * 0.00022);

      this.camera.zoom += (targetZoom - this.camera.zoom) * 0.08;
    }

    const zoom = this.camera.zoom;
    const halfW = (this.width / 2) / zoom + 80;
    const halfH = (this.height / 2) / zoom + 80;

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    const mapSize = gameState.mapSize || 10000;

    // 2. Draw World Background & Culled Grid
    this.drawBackground(ctx, mapSize, halfW, halfH);

    // 3. Draw Foods (Culled & Zero shadowBlur)
    this.drawFoods(ctx, gameState.foods, halfW, halfH, animTime);

    // 4. Draw Cats
    for (let i = 0; i < gameState.players.length; i++) {
      const cat = gameState.players[i];
      if (Math.abs(cat.x - this.camera.x) <= halfW + 100 && Math.abs(cat.y - this.camera.y) <= halfH + 100) {
        this.drawCat(ctx, cat, cat.id === localPlayerId, animTime);
      }
    }

    // 5. Draw Combat Scratch Slash Effects
    this.drawScratchEffects(ctx, dt);

    // 6. Draw Particles
    this.drawParticles(ctx, dt);

    // 7. Draw Floating Texts
    this.drawFloatingTexts(ctx, dt);

    ctx.restore();

    // 8. Draw MiniMap Radar in Screen Space
    this.drawMinimap(ctx, mapSize, localPlayerId);
  }

  drawBackground(ctx, mapSize, halfW, halfH) {
    // Fill canvas background
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(this.camera.x - halfW, this.camera.y - halfH, halfW * 2, halfH * 2);

    // Culled grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gridSize = 140;

    const startX = Math.max(0, Math.floor((this.camera.x - halfW) / gridSize) * gridSize);
    const endX = Math.min(mapSize, Math.ceil((this.camera.x + halfW) / gridSize) * gridSize);
    const startY = Math.max(0, Math.floor((this.camera.y - halfH) / gridSize) * gridSize);
    const endY = Math.min(mapSize, Math.ceil((this.camera.y + halfH) / gridSize) * gridSize);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Map Glowing Borders
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, mapSize, mapSize);
  }

  drawFoods(ctx, foods, halfW, halfH, animTime) {
    if (!foods) return;

    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      // Format: [id, typeCode, x, y, radius] or object
      let fx, fy, typeCode, radius;
      if (Array.isArray(f)) {
        typeCode = f[1];
        fx = f[2];
        fy = f[3];
        radius = f[4];
      } else {
        const typeMap = {
          'light_small': 1, 'light_big': 2, 'pate': 3, 'coin': 4,
          'dice': 5, 'speed_orb': 6, 'magnet_orb': 7, 'shield_orb': 8,
          'catnip_orb': 9, 'fish_orb': 10, 'star_orb': 11
        };
        typeCode = typeof f.t === 'number' ? f.t : (typeMap[f.t] || 1);
        fx = f.x;
        fy = f.y;
        radius = f.r;
      }

      // Viewport culling
      if (Math.abs(fx - this.camera.x) > halfW || Math.abs(fy - this.camera.y) > halfH) {
        continue;
      }

      switch (typeCode) {
        case 1: { // light_small
          ctx.fillStyle = 'rgba(72, 219, 251, 0.35)';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 1.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#48dbfb';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 2: { // light_big
          ctx.fillStyle = 'rgba(255, 159, 67, 0.35)';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 1.7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ff9f43';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 3: { // pate 🥫
          ctx.fillStyle = 'rgba(238, 82, 83, 0.3)';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 1.4, 0, Math.PI * 2);
          ctx.fill();

          // Can body
          const canW = radius * 1.5;
          const canH = radius * 1.05;
          ctx.fillStyle = '#ee5253';
          ctx.beginPath();
          ctx.roundRect(fx - canW / 2, fy - canH / 2, canW, canH, 4);
          ctx.fill();

          // Gold lid
          ctx.fillStyle = '#feca57';
          ctx.beginPath();
          ctx.ellipse(fx, fy - canH / 2, canW / 2, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 0.48)}px Nunito`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PATE', fx, fy + 1);
          break;
        }

        case 4: { // coin 🪙
          ctx.fillStyle = '#ffa502';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffeaa7';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.fillStyle = '#ffeaa7';
          ctx.font = `bold ${Math.round(radius * 1.1)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪙', fx, fy);
          break;
        }

        case 5: { // dice 🎲
          const dw = radius * 1.4;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(fx - dw / 2, fy - dw / 2, dw, dw, 5);
          ctx.fill();

          ctx.fillStyle = '#a55eea';
          const dotR = radius * 0.16;
          const dotOff = radius * 0.32;
          ctx.beginPath();
          ctx.arc(fx - dotOff, fy - dotOff, dotR, 0, Math.PI * 2);
          ctx.arc(fx, fy, dotR, 0, Math.PI * 2);
          ctx.arc(fx + dotOff, fy + dotOff, dotR, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 6: { // speed_orb ⚡ Hạt Tốc Độ
          ctx.fillStyle = 'rgba(255, 234, 167, 0.45)';
          ctx.beginPath();
          ctx.arc(fx, fy, radius * 1.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.05)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', fx, fy);
          break;
        }

        case 7: { // magnet_orb 🧲 Hạt Nam Châm Hút Hạt
          const magWave = (Math.sin(animTime * 6 + fx) + 1) * 0.5;
          ctx.fillStyle = `rgba(165, 94, 234, ${0.25 + magWave * 0.25})`;
          ctx.beginPath();
          ctx.arc(fx, fy, radius * (1.5 + magWave * 0.4), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#8e44ad';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.1)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🧲', fx, fy);
          break;
        }

        case 8: { // shield_orb 🛡️ Hạt Khiên Bảo Vệ
          const shieldWave = (Math.sin(animTime * 5 + fy) + 1) * 0.5;
          ctx.fillStyle = `rgba(52, 152, 219, ${0.3 + shieldWave * 0.25})`;
          ctx.beginPath();
          ctx.arc(fx, fy, radius * (1.5 + shieldWave * 0.3), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#2980b9';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#74b9ff';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.1)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡️', fx, fy);
          break;
        }

        case 9: { // catnip_orb 🌿 Cỏ Mèo Cuồng Nộ
          const catnipPulse = (Math.sin(animTime * 7 + fx * 0.1) + 1) * 0.5;
          ctx.fillStyle = `rgba(46, 213, 115, ${0.35 + catnipPulse * 0.3})`;
          ctx.beginPath();
          ctx.arc(fx, fy, radius * (1.6 + catnipPulse * 0.3), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#27ae60';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.15)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🌿', fx, fy);
          break;
        }

        case 10: { // fish_orb 🐟 Cá Vàng Béo Ngậy
          const fishBob = Math.sin(animTime * 5 + fx) * 2;
          ctx.fillStyle = 'rgba(255, 121, 63, 0.45)';
          ctx.beginPath();
          ctx.arc(fx, fy + fishBob, radius * 1.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e67e22';
          ctx.beginPath();
          ctx.arc(fx, fy + fishBob, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#f39c12';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.15)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐟', fx, fy + fishBob);
          break;
        }

        case 11: { // star_orb ⭐ Siêu Sao Bất Tử
          const starHue = (animTime * 200 + fx) % 360;
          const starGlow = (Math.sin(animTime * 8) + 1) * 0.5;
          ctx.fillStyle = `hsla(${starHue}, 100%, 65%, ${0.45 + starGlow * 0.35})`;
          ctx.beginPath();
          ctx.arc(fx, fy, radius * (1.8 + starGlow * 0.4), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(fx, fy, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(radius * 1.15)}px Fredoka`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⭐', fx, fy);
          break;
        }
      }
    }
  }

  drawCat(ctx, cat, isLocalPlayer, animTime) {
    const r = cat.radius;

    ctx.save();
    ctx.translate(cat.x, cat.y);

    // Boost effect trail
    if (cat.isBoosting) {
      const trailAngle = cat.angle + Math.PI;
      const trailX = Math.cos(trailAngle) * (r * 0.9);
      const trailY = Math.sin(trailAngle) * (r * 0.9);

      ctx.fillStyle = 'rgba(46, 213, 115, 0.4)';
      ctx.beginPath();
      ctx.arc(trailX, trailY, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield bubble
    if (cat.shieldHits > 0) {
      ctx.strokeStyle = 'rgba(112, 161, 255, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(112, 161, 255, 0.15)';
      ctx.fill();

      if (cat.shieldHits > 1) {
        ctx.fillStyle = '#70a1ff';
        ctx.font = 'bold 12px Fredoka';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡️x${cat.shieldHits}`, 0, -r * 1.45);
      }
    }

    // Active Buff Auras
    if (cat.buff) {
      if (cat.buff.type === 'magnet') {
        const pulse = (Math.sin(animTime * 7) + 1) * 0.5;
        ctx.strokeStyle = `rgba(165, 94, 234, ${0.5 + pulse * 0.35})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.35 + pulse * 0.25), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (cat.buff.type === 'catnip') {
        const pulse = (Math.sin(animTime * 10) + 1) * 0.5;
        ctx.strokeStyle = `rgba(46, 213, 115, ${0.7 + pulse * 0.3})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.28 + pulse * 0.15), 0, Math.PI * 2);
        ctx.stroke();
      } else if (cat.buff.type === 'star') {
        const hue = (animTime * 320) % 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (cat.hasSpeedBuff) {
      ctx.strokeStyle = 'rgba(241, 196, 15, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rotate towards movement angle
    ctx.rotate(cat.angle);

    // 1. Cat Tail
    const tailSwing = Math.sin(animTime * 6) * 0.35;
    ctx.save();
    ctx.translate(-r * 0.95, 0);
    ctx.rotate(Math.PI + tailSwing);
    ctx.strokeStyle = this.getCatMainColor(cat.skin);
    ctx.lineWidth = r * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.5, r * 0.3, r * 0.8, 0);
    ctx.stroke();
    ctx.restore();

    // 2. Cat Body
    ctx.fillStyle = this.getCatMainColor(cat.skin);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Skin patterns
    this.drawSkinCostume(ctx, cat, r);

    // 3. Cat Ears
    this.drawCatEars(ctx, cat, r);

    // 4. Cat Eyes & Face
    this.drawCatFace(ctx, cat, r);

    // 5. FRONT PAWS (2 CHÂN TRƯỚC)
    this.drawFrontPaws(ctx, cat, r, animTime);

    ctx.restore(); // Restore cat rotation

    // 6. Overhead Health Bar & Nametag
    this.drawOverheadHUD(ctx, cat, isLocalPlayer);
  }

  drawCatEars(ctx, cat, r) {
    const earColor = this.getCatMainColor(cat.skin);
    const innerEarColor = '#ffb8b8';

    if (cat.skin === 'rabbit') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 1.3, r * 0.22, r * 0.6, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = innerEarColor;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 1.3, r * 0.12, r * 0.45, -0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, r * 1.3, r * 0.22, r * 0.6, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = innerEarColor;
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, r * 1.3, r * 0.12, r * 0.45, 0.15, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (cat.skin === 'panda') {
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.95, r * 0.35, 0, Math.PI * 2);
      ctx.arc(-r * 0.1, r * 0.95, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (cat.skin === 'mouse') {
      ctx.fillStyle = '#bdc581';
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 1.0, r * 0.42, 0, Math.PI * 2);
      ctx.arc(-r * 0.1, r * 1.0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fab1a0';
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 1.0, r * 0.25, 0, Math.PI * 2);
      ctx.arc(-r * 0.1, r * 1.0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (cat.skin === 'frog') {
      // Big frog bulging eyes on top
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(r * 0.1, -r * 0.88, r * 0.35, 0, Math.PI * 2);
      ctx.arc(r * 0.1, r * 0.88, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.1, -r * 0.88, r * 0.2, 0, Math.PI * 2);
      ctx.arc(r * 0.1, r * 0.88, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(r * 0.15, -r * 0.88, r * 0.1, 0, Math.PI * 2);
      ctx.arc(r * 0.15, r * 0.88, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (cat.skin === 'dragon') {
      // Golden dragon horns
      ctx.fillStyle = '#f9ca24';
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.6);
      ctx.lineTo(-r * 0.4, -r * 1.25);
      ctx.lineTo(r * 0.15, -r * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-r * 0.1, r * 0.6);
      ctx.lineTo(-r * 0.4, r * 1.25);
      ctx.lineTo(r * 0.15, r * 0.7);
      ctx.closePath();
      ctx.fill();
      return;
    }

    // Normal ears
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.95);
    ctx.lineTo(r * 0.6, -r * 0.7);
    ctx.lineTo(-r * 0.1, -r * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = innerEarColor;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.88);
    ctx.lineTo(r * 0.5, -r * 0.7);
    ctx.lineTo(0, -r * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, r * 0.95);
    ctx.lineTo(r * 0.6, r * 0.7);
    ctx.lineTo(-r * 0.1, r * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = innerEarColor;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, r * 0.88);
    ctx.lineTo(r * 0.5, r * 0.7);
    ctx.lineTo(0, r * 0.52);
    ctx.closePath();
    ctx.fill();
  }

  drawCatFace(ctx, cat, r) {
    const eyeOffset = r * 0.42;
    const eyeForward = r * 0.4;
    const eyeRadius = r * 0.22;
    const eyeColor = (cat.skin === 'black') ? '#f1c40f' : (cat.skin === 'orange' ? '#2ecc71' : (cat.skin === 'robot' ? '#00d2d3' : (cat.skin === 'dragon' ? '#f9ca24' : '#3498db')));

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeForward, -eyeOffset, eyeRadius, 0, Math.PI * 2);
    ctx.arc(eyeForward, eyeOffset, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(eyeForward + eyeRadius * 0.25, -eyeOffset, eyeRadius * 0.7, 0, Math.PI * 2);
    ctx.arc(eyeForward + eyeRadius * 0.25, eyeOffset, eyeRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(eyeForward + eyeRadius * 0.35, -eyeOffset, eyeRadius * 0.45, 0, Math.PI * 2);
    ctx.arc(eyeForward + eyeRadius * 0.35, eyeOffset, eyeRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeForward + eyeRadius * 0.2, -eyeOffset - eyeRadius * 0.2, eyeRadius * 0.25, 0, Math.PI * 2);
    ctx.arc(eyeForward + eyeRadius * 0.2, eyeOffset - eyeRadius * 0.2, eyeRadius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7675';
    ctx.beginPath();
    ctx.moveTo(r * 0.65, 0);
    ctx.lineTo(r * 0.52, -r * 0.08);
    ctx.lineTo(r * 0.52, r * 0.08);
    ctx.closePath();
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = cat.skin === 'black' ? '#ffffff' : '#636e72';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.2);
    ctx.lineTo(r * 0.3, -r * 0.65);
    ctx.moveTo(r * 0.45, -r * 0.28);
    ctx.lineTo(r * 0.35, -r * 0.78);
    ctx.moveTo(r * 0.45, r * 0.2);
    ctx.lineTo(r * 0.3, r * 0.65);
    ctx.moveTo(r * 0.45, r * 0.28);
    ctx.lineTo(r * 0.35, r * 0.78);
    ctx.stroke();
  }

  drawSkinCostume(ctx, cat, r) {
    if (cat.skin === 'orange') {
      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.5);
      ctx.lineTo(0, -r * 0.2);
      ctx.moveTo(-r * 0.3, r * 0.5);
      ctx.lineTo(0, r * 0.2);
      ctx.stroke();
    } else if (cat.skin === 'tiger') {
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.6);
      ctx.lineTo(0, -r * 0.2);
      ctx.moveTo(-r * 0.2, -r * 0.7);
      ctx.lineTo(r * 0.2, -r * 0.3);
      ctx.moveTo(-r * 0.4, r * 0.6);
      ctx.lineTo(0, r * 0.2);
      ctx.moveTo(-r * 0.2, r * 0.7);
      ctx.lineTo(r * 0.2, r * 0.3);
      ctx.stroke();
    } else if (cat.skin === 'panda') {
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.ellipse(r * 0.42, -r * 0.42, r * 0.28, r * 0.22, 0.3, 0, Math.PI * 2);
      ctx.ellipse(r * 0.42, r * 0.42, r * 0.28, r * 0.22, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat.skin === 'hamster') {
      ctx.fillStyle = 'rgba(255, 118, 117, 0.65)';
      ctx.beginPath();
      ctx.arc(r * 0.38, -r * 0.52, r * 0.22, 0, Math.PI * 2);
      ctx.arc(r * 0.38, r * 0.52, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat.skin === 'robot') {
      // Cyber neon visor & antenna
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = Math.max(3, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.52);
      ctx.lineTo(r * 0.45, r * 0.52);
      ctx.stroke();

      ctx.strokeStyle = '#dfe4ea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-r * 0.6, 0);
      ctx.stroke();
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(-r * 0.65, 0, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat.skin === 'ghost') {
      // Ethereal outer glow aura
      ctx.strokeStyle = 'rgba(126, 214, 223, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    } else if (cat.skin === 'cowboy') {
      // Brown cowboy hat
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath();
      ctx.ellipse(-r * 0.05, 0, r * 0.35, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, 0, r * 0.22, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cat.skin === 'space') {
      // Glass helmet visor
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(72, 219, 251, 0.25)';
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (cat.skin === 'dragon') {
      // Dragon spikes on back
      ctx.fillStyle = '#f9ca24';
      for (let s = -0.6; s <= 0.6; s += 0.4) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, r * s);
        ctx.lineTo(-r * 1.15, r * s);
        ctx.lineTo(-r * 0.65, r * (s + 0.2));
        ctx.closePath();
        ctx.fill();
      }
    } else if (cat.skin === 'king') {
      ctx.fillStyle = '#f1c40f';
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.5);
      ctx.lineTo(r * 0.2, -r * 0.65);
      ctx.lineTo(0, -r * 0.3);
      ctx.lineTo(r * 0.2, 0);
      ctx.lineTo(0, r * 0.3);
      ctx.lineTo(r * 0.2, r * 0.65);
      ctx.lineTo(-r * 0.2, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (cat.skin === 'wizard') {
      ctx.fillStyle = '#8e44ad';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.5);
      ctx.lineTo(r * 0.1, 0);
      ctx.lineTo(-r * 0.4, r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawFrontPaws(ctx, cat, r, animTime) {
    const pawColor = this.getCatPawColor(cat.skin);
    const pawRadius = r * 0.32;
    const pawDist = r * 0.82;
    const pawSpread = r * 0.65;

    let leftOffset = 0;
    let rightOffset = 0;

    if (cat.isScratching) {
      leftOffset = r * 0.45;
      rightOffset = r * 0.45;
    } else {
      const paddle = Math.sin(animTime * 10);
      leftOffset = paddle * (r * 0.1);
      rightOffset = -paddle * (r * 0.1);
    }

    // Left Paw
    ctx.save();
    ctx.translate(pawDist + leftOffset, -pawSpread);
    ctx.fillStyle = pawColor;
    ctx.beginPath();
    ctx.arc(0, 0, pawRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7675';
    ctx.beginPath();
    ctx.arc(pawRadius * 0.3, 0, pawRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    if (cat.isScratching) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pawRadius, -pawRadius * 0.4);
      ctx.lineTo(pawRadius + r * 0.3, -pawRadius * 0.6);
      ctx.moveTo(pawRadius, 0);
      ctx.lineTo(pawRadius + r * 0.4, 0);
      ctx.moveTo(pawRadius, pawRadius * 0.4);
      ctx.lineTo(pawRadius + r * 0.3, pawRadius * 0.6);
      ctx.stroke();
    }
    ctx.restore();

    // Right Paw
    ctx.save();
    ctx.translate(pawDist + rightOffset, pawSpread);
    ctx.fillStyle = pawColor;
    ctx.beginPath();
    ctx.arc(0, 0, pawRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7675';
    ctx.beginPath();
    ctx.arc(pawRadius * 0.3, 0, pawRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    if (cat.isScratching) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pawRadius, -pawRadius * 0.4);
      ctx.lineTo(pawRadius + r * 0.3, -pawRadius * 0.6);
      ctx.moveTo(pawRadius, 0);
      ctx.lineTo(pawRadius + r * 0.4, 0);
      ctx.moveTo(pawRadius, pawRadius * 0.4);
      ctx.lineTo(pawRadius + r * 0.3, pawRadius * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawOverheadHUD(ctx, cat, isLocalPlayer) {
    const r = cat.radius;
    const overheadY = -r * 1.35;
    const isMobile = this.width < 900 || this.height < 550;

    const fontSize = isMobile ? Math.max(13, r * 0.4) : Math.max(12, r * 0.35);
    ctx.fillStyle = isLocalPlayer ? '#ff6b81' : '#ffffff';
    ctx.font = `bold ${fontSize}px Fredoka, Nunito`;
    ctx.textAlign = 'center';
    ctx.fillText(`${cat.name} (${cat.size})`, cat.x, cat.y + overheadY - 8);

    // HP Bar
    const barW = Math.max(isMobile ? 54 : 46, r * 1.35);
    const barH = isMobile ? 6 : 5;
    const barX = cat.x - barW / 2;
    const barY = cat.y + overheadY;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2.5);
    ctx.fill();

    const hpRatio = Math.max(0, cat.hp / cat.maxHp);
    ctx.fillStyle = hpRatio > 0.4 ? '#2ed573' : '#ff4757';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpRatio, barH, 2.5);
    ctx.fill();
  }

  drawScratchEffects(ctx, dt) {
    for (let i = this.scratchEffects.length - 1; i >= 0; i--) {
      const s = this.scratchEffects[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scratchEffects.splice(i, 1);
        continue;
      }

      const alpha = s.life / s.maxLife;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = `rgba(255, 71, 87, ${alpha})`;
      ctx.lineWidth = 3.5;

      const len = 32;
      for (let offset = -12; offset <= 12; offset += 12) {
        ctx.beginPath();
        ctx.moveTo(-len / 2, offset - 8);
        ctx.lineTo(len / 2, offset + 8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  drawFloatingTexts(ctx, dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y += t.vy;

      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.font = `bold ${t.size}px Fredoka`;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.min(1.0, t.life * 1.5);
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  drawMinimap(ctx, mapSize, localPlayerId) {
    if (!this.latestMinimap || this.latestMinimap.length === 0) return;

    const isMobile = this.width < 900 || this.height < 550;
    const size = isMobile ? 96 : 120;
    const margin = isMobile ? 8 : 16;

    // Vị trí nằm ngay dưới Bảng Xếp Hạng (Ranking) ở góc trên bên phải
    let y = isMobile ? 120 : 260;
    const lbEl = document.querySelector('.leaderboard');
    if (lbEl) {
      const rect = lbEl.getBoundingClientRect();
      y = rect.bottom + 6;
    }
    const x = this.width - size - margin;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 45, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 8px Fredoka';
    ctx.textAlign = 'center';
    ctx.fillText('🗺️ MAP', x + size / 2, y + 10);

    for (let i = 0; i < this.latestMinimap.length; i++) {
      const cat = this.latestMinimap[i];
      const mx = x + (cat.x / mapSize) * size;
      const my = y + (cat.y / mapSize) * size;

      if (cat.isLeader) {
        ctx.fillStyle = '#feca57';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Local player dot
    const myX = x + (this.camera.x / mapSize) * size;
    const myY = y + (this.camera.y / mapSize) * size;
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(myX, myY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  getCatMainColor(skin) {
    switch (skin) {
      case 'white': return '#ffffff';
      case 'orange': return '#e67e22';
      case 'black': return '#2d3436';
      case 'gray': return '#95a5a6';
      case 'rabbit': return '#f5f6fa';
      case 'fox': return '#e17055';
      case 'lion': return '#f39c12';
      case 'tiger': return '#e67e22';
      case 'panda': return '#ffffff';
      case 'frog': return '#2ecc71';
      case 'hamster': return '#e58e26';
      case 'mouse': return '#bdc581';
      case 'robot': return '#747d8c';
      case 'ghost': return '#dff9fb';
      case 'king': return '#fdcb6e';
      case 'cowboy': return '#d35400';
      case 'wizard': return '#6c5ce7';
      case 'space': return '#0984e3';
      case 'dragon': return '#eb4d4b';
      default: return '#ffffff';
    }
  }

  getCatPawColor(skin) {
    switch (skin) {
      case 'white': return '#f1f2f6';
      case 'orange': return '#ffffff';
      case 'black': return '#1e272e';
      case 'gray': return '#dfe4ea';
      case 'panda': return '#2d3436';
      case 'robot': return '#57606f';
      case 'dragon': return '#ff7979';
      case 'frog': return '#27ae60';
      case 'ghost': return '#c7ecee';
      case 'cowboy': return '#8395a7';
      case 'space': return '#dfe4ea';
      default: return '#ffffff';
    }
  }
}
