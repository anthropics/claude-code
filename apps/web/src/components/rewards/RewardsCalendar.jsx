import React, { useState } from 'react';
import { useDailyRewards } from "./../contexts/DailyRewardsContext";
import { dailyRewardsSchedule } from "./../data/dailyRewards";

/**
 * Component that displays the calendar of daily rewards
 * Shows past claimed rewards, current day, and future rewards
 */
const RewardsCalendar = () => {
  const { currentStreak } = useDailyRewards();
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  // Total number of weeks in the rewards cycle
  const totalWeeks = Math.ceil(dailyRewardsSchedule.length / 7);
  
  // Get the current week based on streak
  const currentWeek = Math.ceil(currentStreak / 7);
  
  // Filter rewards for the selected week
  const weekRewards = dailyRewardsSchedule.filter(
    reward => Math.ceil(reward.day / 7) === selectedWeek
  );
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Daily Rewards</h2>
        
        <div className="flex items-center space-x-2">
          {/* Week selector */}
          <button
            onClick={() => setSelectedWeek(prev => Math.max(1, prev - 1))}
            disabled={selectedWeek === 1}
            className={`p-1 rounded ${
              selectedWeek === 1
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white hover:bg-gray-700'
            }`}
          >
            ◀
          </button>
          
          <span className="text-white px-2">
            Week {selectedWeek} of {totalWeeks}
          </span>
          
          <button
            onClick={() => setSelectedWeek(prev => Math.min(totalWeeks, prev + 1))}
            disabled={selectedWeek === totalWeeks}
            className={`p-1 rounded ${
              selectedWeek === totalWeeks
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white hover:bg-gray-700'
            }`}
          >
            ▶
          </button>
        </div>
      </div>
      
      {/* Current streak info */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Current Streak:</span>
          <span className="text-yellow-400 font-bold">{currentStreak} days</span>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-2.5 my-2">
          <div 
            className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${(currentStreak % 7) * 14.28}%` }}
          ></div>
        </div>
      </div>
      
      {/* Week's rewards grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekRewards.map((reward) => {
          const day = reward.day;
          const isClaimed = currentStreak >= day;
          const isToday = currentStreak + 1 === day;
          
          return (
            <div 
              key={day} 
              className={`
                relative flex flex-col items-center p-2 rounded-lg
                ${isClaimed ? 'bg-gray-700 opacity-75' : 'bg-gray-700'}
                ${isToday ? 'ring-2 ring-yellow-400' : ''}
              `}
            >
              {/* Day number */}
              <span className="text-xs text-gray-400">Day</span>
              <span className={`font-bold ${isToday ? 'text-yellow-400' : 'text-white'}`}>
                {day}
              </span>
              
              {/* Reward image */}
              <div className="my-2 h-12 w-12 flex items-center justify-center">
                <img 
                  src={reward.image} 
                  alt={`Day ${day} reward`}
                  className={`w-10 h-10 object-contain ${isClaimed ? 'grayscale' : ''}`}
                />
              </div>
              
              {/* Claimed marker */}
              {isClaimed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
                  <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full transform rotate-12">
                    CLAIMED
                  </div>
                </div>
              )}
              
              {/* Today marker */}
              {isToday && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  TODAY
                </div>
              )}
              
              {/* Special day marker */}
              {reward.isSpecial && (
                <div className="absolute -top-2 -left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {reward.isMonthly ? 'MONTHLY' : 'SPECIAL'}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Help text */}
      <div className="mt-4 text-center text-xs text-gray-400">
        Login daily to maintain your streak and unlock greater rewards!
      </div>
    </div>
  );
};

export default RewardsCalendar;