class Food {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type; // 'light_small', 'light_big', 'pate', 'coin', 'dice'
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
      default:
        this.value = 5;
        this.radius = 6;
    }
  }
}

module.exports = Food;
