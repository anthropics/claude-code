/**
 * Daily rewards system for AgentLand
 * Handles login streaks, reward calculations, and reward distribution
 */

import { getRewardForDay, calculateStreakBonus } from '../data/dailyRewards';

// Utility to check if it's a new day for the player
const isNewDay = (lastLoginTimestamp) => {
  if (!lastLoginTimestamp) return true;
  
  const lastLogin = new Date(lastLoginTimestamp);
  const now = new Date();
  
  // Reset happens at midnight local time
  return (
    lastLogin.getDate() !== now.getDate() ||
    lastLogin.getMonth() !== now.getMonth() ||
    lastLogin.getFullYear() !== now.getFullYear()
  );
};

// Calculate streak status based on last login
const calculateStreak = (lastLoginTimestamp, currentStreak) => {
  if (!lastLoginTimestamp) return 1; // First login
  
  const lastLogin = new Date(lastLoginTimestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // If last login was yesterday, increase streak
  if (
    lastLogin.getDate() === yesterday.getDate() &&
    lastLogin.getMonth() === yesterday.getMonth() &&
    lastLogin.getFullYear() === yesterday.getFullYear()
  ) {
    return currentStreak + 1;
  }
  
  // If last login was today, maintain streak
  if (
    lastLogin.getDate() === now.getDate() &&
    lastLogin.getMonth() === now.getMonth() &&
    lastLogin.getFullYear() === now.getFullYear()
  ) {
    return currentStreak;
  }
  
  // Otherwise, streak is broken - restart at 1
  return 1;
};

// Check for reward eligibility
const checkDailyRewardEligibility = (playerState) => {
  const { lastDailyRewardClaim, lastLoginTimestamp } = playerState;
  
  // If no previous login or reward claim, player is eligible
  if (!lastDailyRewardClaim) return true;
  
  // Check if it's a new day since last claim
  const lastClaim = new Date(lastDailyRewardClaim);
  const now = new Date();
  
  return (
    lastClaim.getDate() !== now.getDate() ||
    lastClaim.getMonth() !== now.getMonth() ||
    lastClaim.getFullYear() !== now.getFullYear()
  );
};

// Generate today's reward based on streak
const generateDailyReward = (streak) => {
  // Get base reward for the current streak day
  const baseReward = getRewardForDay(streak);
  
  // Calculate streak bonus
  const streakBonus = calculateStreakBonus(streak);
  
  // Apply streak bonus to reward amounts
  const enhancedReward = {
    ...baseReward,
    rewards: baseReward.rewards.map(reward => {
      // Only apply multiplier to numerical values, not special items
      if (reward.amount) {
        return {
          ...reward,
          amount: Math.floor(reward.amount * streakBonus),
          // Add a bonus flag if there's a streak multiplier
          hasBonus: streakBonus > 1
        };
      }
      return reward;
    })
  };
  
  return enhancedReward;
};

// Apply rewards to player state
const applyRewards = (playerState, reward) => {
  // Clone the player state to avoid direct mutations
  const newState = { ...playerState };
  
  // Process each reward
  reward.rewards.forEach(item => {
    switch (item.type) {
      case 'resources':
        newState.resources = (newState.resources || 0) + item.amount;
        break;
      case 'xp':
        newState.xp = (newState.xp || 0) + item.amount;
        // Check for level up opportunity
        newState.level = calculateLevelFromXp(newState.xp);
        break;
      case 'skillPoints':
        newState.skillPoints = (newState.skillPoints || 0) + item.amount;
        break;
      case 'techPoints':
        newState.techPoints = (newState.techPoints || 0) + item.amount;
        break;
      case 'reputation':
        newState.reputation = (newState.reputation || 0) + item.amount;
        break;
      case 'specialItem':
        // Add special item to inventory
        newState.inventory = newState.inventory || [];
        newState.inventory.push({
          id: item.itemId,
          source: 'dailyReward',
          acquiredDate: new Date().toISOString()
        });
        break;
      default:
        console.warn(`Unknown reward type: ${item.type}`);
    }
  });
  
  // Update last claim timestamp
  newState.lastDailyRewardClaim = new Date().toISOString();
  
  return newState;
};

// Helper function to calculate level from XP
const calculateLevelFromXp = (xp) => {
  // Simple level calculation: level = sqrt(xp/100)
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

// Process daily login and return reward information
const processDailyLogin = (playerState) => {
  // Update login timestamp
  const now = new Date().toISOString();
  const updatedState = {
    ...playerState,
    lastLoginTimestamp: now
  };
  
  // Calculate current streak
  const streak = calculateStreak(
    playerState.lastLoginTimestamp,
    playerState.currentStreak || 0
  );
  updatedState.currentStreak = streak;
  
  // Check eligibility for daily reward
  const isEligible = checkDailyRewardEligibility(playerState);
  
  // If eligible, generate and apply rewards
  if (isEligible) {
    const reward = generateDailyReward(streak);
    const stateWithRewards = applyRewards(updatedState, reward);
    
    return {
      playerState: stateWithRewards,
      reward,
      claimed: true
    };
  }
  
  // Not eligible for new reward
  return {
    playerState: updatedState,
    reward: null,
    claimed: false
  };
};

export {
  isNewDay,
  calculateStreak,
  checkDailyRewardEligibility,
  generateDailyReward,
  applyRewards,
  processDailyLogin
};