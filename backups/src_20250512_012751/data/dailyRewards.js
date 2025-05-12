/**
 * Daily rewards configuration for AgentLand
 * Defines rewards for consecutive daily logins
 */

// Define reward types and their values
const REWARD_TYPES = {
  RESOURCES: 'resources',
  XP: 'xp',
  SKILL_POINTS: 'skillPoints',
  SPECIAL_ITEM: 'specialItem',
  TECH_POINTS: 'techPoints',
  REPUTATION: 'reputation'
};

// Daily rewards schedule - 28 days cycle
const dailyRewardsSchedule = [
  // Week 1
  {
    day: 1,
    rewards: [{ type: REWARD_TYPES.RESOURCES, amount: 100 }],
    description: 'Welcome back! Here\'s some starter resources.',
    image: '/assets/rewards/resources-small.png'
  },
  {
    day: 2,
    rewards: [{ type: REWARD_TYPES.XP, amount: 50 }],
    description: 'Keep your streak going with some XP!',
    image: '/assets/rewards/xp-small.png'
  },
  {
    day: 3,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 150 },
      { type: REWARD_TYPES.XP, amount: 50 }
    ],
    description: 'Day 3: Resources and XP boost!',
    image: '/assets/rewards/mixed-small.png'
  },
  {
    day: 4,
    rewards: [{ type: REWARD_TYPES.SKILL_POINTS, amount: 1 }],
    description: 'Skill Point reward unlocked!',
    image: '/assets/rewards/skill-point.png'
  },
  {
    day: 5,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 200 },
      { type: REWARD_TYPES.XP, amount: 75 }
    ],
    description: 'Day 5: Resources and XP boost!',
    image: '/assets/rewards/mixed-medium.png'
  },
  {
    day: 6,
    rewards: [{ type: REWARD_TYPES.TECH_POINTS, amount: 25 }],
    description: 'Tech Points to advance your research!',
    image: '/assets/rewards/tech-points.png'
  },
  {
    day: 7,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 300 },
      { type: REWARD_TYPES.XP, amount: 100 },
      { type: REWARD_TYPES.SKILL_POINTS, amount: 1 }
    ],
    description: 'Week 1 Complete! Special weekly reward!',
    image: '/assets/rewards/weekly-reward.png',
    isSpecial: true
  },

  // Week 2
  {
    day: 8,
    rewards: [{ type: REWARD_TYPES.RESOURCES, amount: 150 }],
    description: 'Starting week 2 with resources!',
    image: '/assets/rewards/resources-medium.png'
  },
  // Additional days would be defined similarly
  {
    day: 14,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 500 },
      { type: REWARD_TYPES.XP, amount: 200 },
      { type: REWARD_TYPES.SPECIAL_ITEM, itemId: 'rare_material_1' }
    ],
    description: 'Week 2 Complete! Special item unlocked!',
    image: '/assets/rewards/special-item.png',
    isSpecial: true
  },

  // Sample rewards for weeks 3-4 (would be expanded with complete data)
  {
    day: 21,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 750 },
      { type: REWARD_TYPES.XP, amount: 300 },
      { type: REWARD_TYPES.SKILL_POINTS, amount: 2 }
    ],
    description: 'Week 3 Complete! Major rewards!',
    image: '/assets/rewards/weekly-reward-premium.png',
    isSpecial: true
  },
  {
    day: 28,
    rewards: [
      { type: REWARD_TYPES.RESOURCES, amount: 1000 },
      { type: REWARD_TYPES.XP, amount: 500 },
      { type: REWARD_TYPES.SKILL_POINTS, amount: 3 },
      { type: REWARD_TYPES.SPECIAL_ITEM, itemId: 'legendary_material_1' }
    ],
    description: 'Monthly Login Achieved! Legendary rewards!',
    image: '/assets/rewards/monthly-reward.png',
    isSpecial: true,
    isMonthly: true
  },
];

// Utility to get reward for a specific day
const getRewardForDay = (day) => {
  // Ensure day is between 1-28, cycling if beyond
  const normalizedDay = ((day - 1) % 28) + 1;
  return dailyRewardsSchedule.find(reward => reward.day === normalizedDay);
};

// Streak bonus calculations
const calculateStreakBonus = (streakDays) => {
  // Provide additional bonuses based on streak length
  // Returns a multiplier for basic rewards
  if (streakDays <= 7) return 1.0; // No bonus first week
  if (streakDays <= 14) return 1.1; // 10% bonus second week
  if (streakDays <= 21) return 1.2; // 20% bonus third week
  return 1.5; // 50% bonus after 3 weeks
};

export { 
  REWARD_TYPES, 
  dailyRewardsSchedule, 
  getRewardForDay, 
  calculateStreakBonus 
};