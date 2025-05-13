import React from 'react';
import { useDailyRewards } from "./../contexts/DailyRewardsContext";
import RewardsCalendar from './RewardsCalendar';

/**
 * A dedicated page for viewing and managing rewards
 */
const RewardsPage = () => {
  const { currentStreak, isEligible, showRewardModal, setShowRewardModal } = useDailyRewards();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Rewards Center</h1>
        
        {isEligible && (
          <button
            onClick={() => setShowRewardModal(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105"
          >
            Claim Daily Reward
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats card */}
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Your Stats</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Current Streak:</span>
              <span className="text-yellow-400 font-bold">{currentStreak} days</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Longest Streak:</span>
              <span className="text-white font-bold">
                {/* This would come from gameState in a real implementation */}
                {Math.max(currentStreak, 0)} days
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Total Rewards Claimed:</span>
              <span className="text-white font-bold">
                {/* This would come from gameState in a real implementation */}
                {currentStreak} rewards
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Next Special Reward:</span>
              <span className="text-white font-bold">
                {/* Calculate days until next weekly reward */}
                {currentStreak % 7 === 0 ? 'Today!' : `${7 - (currentStreak % 7)} days`}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Monthly Completion:</span>
              <span className="text-white font-bold">
                {/* Calculate progress toward 28-day cycle */}
                {Math.floor((currentStreak % 28) / 28 * 100)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Rewards calendar */}
        <div className="lg:col-span-2">
          <RewardsCalendar />
        </div>
        
        {/* Other potential reward sections */}
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Achievement Rewards</h2>
          <p className="text-gray-300">Complete achievements to earn special rewards!</p>
          
          {/* Placeholder for achievement rewards */}
          <div className="mt-4 p-3 bg-gray-700 rounded-lg text-center">
            <p className="text-gray-400">Achievement rewards coming soon...</p>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Special Events</h2>
          <p className="text-gray-300">Limited-time events with exclusive rewards.</p>
          
          {/* Placeholder for special events */}
          <div className="mt-4 p-3 bg-gray-700 rounded-lg text-center">
            <p className="text-gray-400">No active events right now.</p>
            <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4">Reward History</h2>
          <p className="text-gray-300">Record of your past reward claims.</p>
          
          {/* Simple placeholder for reward history */}
          <div className="mt-4 space-y-2">
            {[...Array(Math.min(currentStreak, 5))].map((_, index) => (
              <div key={index} className="p-2 bg-gray-700 rounded flex justify-between">
                <span className="text-gray-300">
                  Day {currentStreak - index}
                </span>
                <span className="text-green-400">Claimed</span>
              </div>
            ))}
            
            {currentStreak === 0 && (
              <div className="p-3 bg-gray-700 rounded-lg text-center">
                <p className="text-gray-400">No rewards claimed yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;