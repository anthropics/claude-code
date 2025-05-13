import React, { useState, useEffect } from 'react';
import { useDailyRewards } from "./../contexts/DailyRewardsContext";
import { REWARD_TYPES } from "./../data/dailyRewards";

/**
 * Modal that appears when daily rewards are available
 * Shows the reward and allows the player to claim it
 */
const DailyRewardModal = () => {
  const {
    dailyReward,
    isEligible,
    showRewardModal,
    currentStreak,
    claimDailyReward,
    acknowledgeReward
  } = useDailyRewards();
  
  const [claimed, setClaimed] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Reset state when modal is reopened
  useEffect(() => {
    if (showRewardModal) {
      setClaimed(false);
      setAnimationComplete(false);
    }
  }, [showRewardModal]);
  
  // Function to handle reward claim
  const handleClaim = () => {
    const reward = claimDailyReward();
    if (reward) {
      setClaimed(true);
      // Start animation sequence
      setTimeout(() => {
        setAnimationComplete(true);
      }, 2000); // Animation duration
    }
  };
  
  // Function to close the modal
  const handleClose = () => {
    acknowledgeReward();
  };
  
  // If modal is not visible, render nothing
  if (!showRewardModal) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
        {!claimed ? (
          // Unclaimed reward view
          <div className="text-center">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">Daily Reward Available!</h2>
            
            <div className="mb-4">
              <p className="text-white">Day {currentStreak} Streak</p>
              <div className="w-full bg-gray-700 rounded-full h-2.5 my-2">
                <div 
                  className="bg-yellow-400 h-2.5 rounded-full" 
                  style={{ width: `${(currentStreak % 7) * 14.28}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-300">
                {7 - (currentStreak % 7)} days until weekly bonus
              </p>
            </div>
            
            {isEligible && (
              <button
                onClick={handleClaim}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded-full transition-all transform hover:scale-105"
              >
                Claim Reward
              </button>
            )}
            
            {!isEligible && (
              <p className="text-white mb-4">
                You've already claimed today's reward. Come back tomorrow!
              </p>
            )}
            
            <button
              onClick={handleClose}
              className="mt-4 text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
        ) : (
          // Claimed reward view
          <div className="text-center">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">
              Reward Claimed!
            </h2>
            
            <p className="text-gray-200 mb-4">Day {currentStreak} Streak</p>
            
            {dailyReward && (
              <>
                <div className="my-6 relative">
                  <img 
                    src={dailyReward.image} 
                    alt="Reward"
                    className={`mx-auto w-24 h-24 ${animationComplete ? '' : 'animate-bounce'}`} 
                  />
                  
                  {dailyReward.isSpecial && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      SPECIAL
                    </div>
                  )}
                </div>
                
                <p className="text-white font-medium mb-4">
                  {dailyReward.description}
                </p>
                
                <div className="bg-gray-700 p-4 rounded-lg mb-4">
                  <h3 className="text-lg font-bold text-white mb-2">You received:</h3>
                  
                  <ul className="text-left">
                    {dailyReward.rewards.map((reward, index) => (
                      <li key={index} className="flex items-center mb-2 text-white">
                        <div className={`w-2 h-2 rounded-full mr-2 ${getRewardColor(reward.type)}`}></div>
                        <span className={`font-bold ${reward.hasBonus ? 'text-yellow-300' : ''}`}>
                          {formatRewardText(reward)}
                        </span>
                        {reward.hasBonus && (
                          <span className="ml-2 text-xs bg-yellow-600 text-yellow-200 px-1 py-0.5 rounded">
                            STREAK BONUS
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            
            <button
              onClick={handleClose}
              className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-full transition-all ${
                animationComplete ? 'opacity-100' : 'opacity-50 cursor-not-allowed'
              }`}
              disabled={!animationComplete}
            >
              Awesome!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get color for reward type
const getRewardColor = (type) => {
  switch (type) {
    case REWARD_TYPES.RESOURCES:
      return 'bg-blue-500';
    case REWARD_TYPES.XP:
      return 'bg-green-500';
    case REWARD_TYPES.SKILL_POINTS:
      return 'bg-purple-500';
    case REWARD_TYPES.SPECIAL_ITEM:
      return 'bg-orange-500';
    case REWARD_TYPES.TECH_POINTS:
      return 'bg-indigo-500';
    case REWARD_TYPES.REPUTATION:
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

// Helper function to format reward text
const formatRewardText = (reward) => {
  switch (reward.type) {
    case REWARD_TYPES.RESOURCES:
      return `${reward.amount} Resources`;
    case REWARD_TYPES.XP:
      return `${reward.amount} XP`;
    case REWARD_TYPES.SKILL_POINTS:
      return `${reward.amount} Skill Point${reward.amount > 1 ? 's' : ''}`;
    case REWARD_TYPES.SPECIAL_ITEM:
      return `Special Item: ${formatItemId(reward.itemId)}`;
    case REWARD_TYPES.TECH_POINTS:
      return `${reward.amount} Tech Points`;
    case REWARD_TYPES.REPUTATION:
      return `${reward.amount} Reputation`;
    default:
      return `Unknown reward: ${reward.type}`;
  }
};

// Helper to format item IDs for display
const formatItemId = (itemId) => {
  return itemId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default DailyRewardModal;