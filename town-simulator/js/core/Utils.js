const Utils = {
  rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randFloat(min, max) {
    return Math.random() * (max - min) + min;
  },

  chance(probability) {
    return Math.random() < probability;
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  uniqueId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  },

  interpolateColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  },

  // Name generation data
  FIRST_NAMES_M: [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Thomas',
    'Charles', 'Daniel', 'Matthew', 'Henry', 'Joseph', 'Samuel', 'George',
    'Edward', 'Oliver', 'Ethan', 'Noah', 'Liam', 'Mason', 'Lucas', 'Logan',
    'Benjamin', 'Elijah', 'Alexander', 'Jack', 'Owen', 'Sebastian', 'Isaac',
  ],
  FIRST_NAMES_F: [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Susan', 'Jessica',
    'Sarah', 'Emma', 'Olivia', 'Sophie', 'Charlotte', 'Alice', 'Eleanor',
    'Grace', 'Lily', 'Amelia', 'Claire', 'Diana', 'Helen', 'Ava', 'Mia',
    'Harper', 'Evelyn', 'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Ella',
  ],
  LAST_NAMES: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Taylor', 'Wilson', 'Anderson', 'Thomas', 'Jackson', 'White',
    'Harris', 'Martin', 'Thompson', 'Young', 'Walker', 'Hall', 'Allen',
    'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter',
  ],

  randomName(gender) {
    const firstNames = gender === 'M' ? this.FIRST_NAMES_M : this.FIRST_NAMES_F;
    const first = firstNames[this.rand(0, firstNames.length - 1)];
    const last = this.LAST_NAMES[this.rand(0, this.LAST_NAMES.length - 1)];
    return `${first} ${last}`;
  },

  formatMoney(amount) {
    return '$' + Math.floor(amount).toLocaleString();
  },

  formatPercent(value, total) {
    if (total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  },
};
