import React, { createContext, useContext, useEffect, useState } from 'react';
import { processDailyLogin, checkDailyRewardEligibility } from '../systems/dailyRewardSystem';
import { useGameState } from '../hooks/useGameState';

// Create the context
const DailyRewardsContext = createContext(null);

// Custom hook for using the daily rewards context
export const useDailyRewards = () => {
  const context = useContext(DailyRewardsContext);
  if (!context) {
    throw new Error('useDailyRewards must be used within a DailyRewardsProvider');
  }
  return context;
};

// Provider component
export const DailyRewardsProvider = ({ children }) => {
  const { gameState, updateGameState } = useGameState();
  const [dailyReward, setDailyReward] = useState(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  
  // Check for rewards eligibility on component mount and state changes
  useEffect(() => {
    if (gameState) {
      const eligible = checkDailyRewardEligibility(gameState);
      setIsEligible(eligible);
      
      // Auto-show reward modal if eligible
      if (eligible && !showRewardModal) {
        setShowRewardModal(true);
      }
    }
  }, [gameState]);
  
  // Function to claim daily reward
  const claimDailyReward = () => {
    if (!gameState || !isEligible) return;
    
    // Process the daily login and get rewards
    const { playerState, reward, claimed } = processDailyLogin(gameState);
    
    if (claimed && reward) {
      // Update the game state with rewards
      updateGameState(playerState);
      
      // Set the reward for display
      setDailyReward(reward);
      
      // Show is no longer eligible until next day
      setIsEligible(false);
      
      return reward;
    }
    
    return null;
  };
  
  // Function to acknowledge reward (close modal)
  const acknowledgeReward = () => {
    setShowRewardModal(false);
    setDailyReward(null);
  };
  
  // Function to manually check for rewards (e.g., after relogin)
  const checkForRewards = () => {
    if (gameState) {
      const eligible = checkDailyRewardEligibility(gameState);
      setIsEligible(eligible);
      
      if (eligible) {
        setShowRewardModal(true);
      }
      
      return eligible;
    }
    return false;
  };
  
  // Values to expose through the context
  const contextValue = {
    dailyReward,
    isEligible,
    showRewardModal,
    currentStreak: gameState?.currentStreak || 0,
    claimDailyReward,
    acknowledgeReward,
    checkForRewards,
    setShowRewardModal
  };
  
  return (
    <DailyRewardsContext.Provider value={contextValue}>
      {children}
    </DailyRewardsContext.Provider>
  );
};

export default DailyRewardsContext;