class Food {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type; // 'light_small', 'light_big', 'pate', 'coin', 'dice', 'speed_orb'
    this.x = x;
    this.y = y;
    
    switch (type) {
      case 'light_small':
        this.value = 15;
        this.radius = 10;
        break;
      case 'light_big':
        this.value = 45;
        this.radius = 16;
        break;
      case 'pate':
        this.value = 120;
        this.heal = 35;
        this.radius = 24;
        break;
      case 'coin':
        this.gold = 25;
        this.radius = 14;
        break;
      case 'dice':
        this.radius = 18;
        break;
      case 'speed_orb':
        this.value = 30;
        this.radius = 17;
        this.speedBoost = true;
        break;
      case 'magnet_orb': // 🧲 Hạt Nam Châm Hút Hạt
        this.value = 35;
        this.radius = 18;
        break;
      case 'shield_orb': // 🛡️ Hạt Khiên Bảo Vệ
        this.value = 35;
        this.radius = 18;
        break;
      case 'catnip_orb': // 🌿 Cỏ Mèo Thần Kỳ (Cuồng nộ)
        this.value = 50;
        this.heal = 25;
        this.radius = 19;
        break;
      case 'fish_orb': // 🐟 Cá Vàng Béo Ngậy
        this.value = 150;
        this.heal = 50;
        this.gold = 20;
        this.radius = 26;
        break;
      case 'star_orb': // ⭐ Siêu Sao Bất Tử
        this.value = 80;
        this.gold = 30;
        this.radius = 24;
        break;
      default:
        this.value = 15;
        this.radius = 10;
    }
  }
}

module.exports = Food;
