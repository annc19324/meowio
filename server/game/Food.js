class Food {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type; // 'light_small', 'light_big', 'pate', 'coin', 'dice', 'speed_orb'
    this.x = x;
    this.y = y;
    
    switch (type) {
      case 'light_small':
        this.value = 5;
        this.radius = 6;
        break;
      case 'light_big':
        this.value = 20;
        this.radius = 11;
        break;
      case 'pate':
        this.value = 50;
        this.heal = 25;
        this.radius = 16;
        break;
      case 'coin':
        this.gold = 15;
        this.radius = 10;
        break;
      case 'dice':
        this.radius = 14;
        break;
      case 'speed_orb':
        this.value = 10;
        this.radius = 12;
        this.speedBoost = true;
        break;
      case 'magnet_orb': // 🧲 Hạt Nam Châm Hút Hạt
        this.value = 15;
        this.radius = 13;
        break;
      case 'shield_orb': // 🛡️ Hạt Khiên Bảo Vệ
        this.value = 15;
        this.radius = 13;
        break;
      case 'catnip_orb': // 🌿 Cỏ Mèo Thần Kỳ (Cuồng nộ)
        this.value = 25;
        this.heal = 20;
        this.radius = 14;
        break;
      case 'fish_orb': // 🐟 Cá Vàng Béo Ngậy
        this.value = 80;
        this.heal = 35;
        this.gold = 10;
        this.radius = 17;
        break;
      case 'star_orb': // ⭐ Siêu Sao Bất Tử
        this.value = 35;
        this.gold = 15;
        this.radius = 16;
        break;
      default:
        this.value = 5;
        this.radius = 6;
    }
  }
}

module.exports = Food;
