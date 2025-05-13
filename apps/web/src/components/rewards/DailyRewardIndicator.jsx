import React from 'react';
import { useDailyRewards } from "./../contexts/DailyRewardsContext";

/**
 * A small indicator component that shows if a daily reward is available
 * Typically displayed in the header/navbar
 */
const DailyRewardIndicator = () => {
  const { isEligible, showRewardModal, setShowRewardModal, currentStreak } = useDailyRewards();
  
  // If no reward is available, show a subtle indicator
  if (!isEligible) {
    return (
      <div 
        className="flex items-center space-x-1 text-gray-400 cursor-pointer hover:text-gray-300"
        onClick={() => setShowRewardModal(true)}
        title="View rewards calendar"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M5 2a1 1 0 011-1h8a1 1 0 011 1v1h3a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1h3V2zm2 1h6v1H7V3zm-2 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-sm">Day {currentStreak}</span>
      </div>
    );
  }
  
  // If reward is available, show an animated indicator
  return (
    <div 
      className="flex items-center space-x-1 text-yellow-400 cursor-pointer hover:text-yellow-300 animate-pulse"
      onClick={() => setShowRewardModal(true)}
      title="Claim your daily reward!"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M5 2a1 1 0 011-1h8a1 1 0 011 1v1h3a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1h3V2zm2 1h6v1H7V3zm-2 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
      <span className="text-sm font-bold">Reward Ready!</span>
    </div>
  );
};

export default DailyRewardIndicator;