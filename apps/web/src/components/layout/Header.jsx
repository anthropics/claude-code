import React, { useState } from 'react';
import { useGameState } from "./../hooks/useGameState";
import { useCharacter } from "./../contexts/CharacterContext";
import DailyRewardIndicator from "./rewards/DailyRewardIndicator";

const Header = () => {
  const { gameState } = useGameState();
  const { character } = useCharacter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo and title */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-yellow-400 mr-4">AgentLand</h1>
            <span className="text-sm text-gray-400">Dashboard</span>
          </div>
          
          {/* Navigation and indicators */}
          <div className="hidden md:flex items-center space-x-6">
            {/* User level indicator */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-yellow-400 font-bold border-2 border-yellow-500">
                  {character?.level || 1}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-purple-600 text-xs text-white px-1 rounded-full">
                  AGENT
                </div>
              </div>
              <div>
                <p className="text-white font-medium">{character?.name || 'Agent'}</p>
                <p className="text-xs text-gray-400">Level {character?.level || 1}</p>
              </div>
            </div>
            
            {/* Daily reward indicator */}
            <DailyRewardIndicator />
            
            {/* Game time */}
            <div className="text-gray-400 text-sm">
              Day {gameState?.currentDay || 1}
            </div>
            
            {/* Settings button */}
            <button className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex items-center justify-between border-t border-gray-700 pt-3">
              {/* User level indicator (mobile) */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-yellow-400 font-bold border-2 border-yellow-500">
                    {character?.level || 1}
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium">{character?.name || 'Agent'}</p>
                </div>
              </div>
              
              {/* Daily reward indicator (mobile) */}
              <DailyRewardIndicator />
              
              {/* Game time (mobile) */}
              <div className="text-gray-400 text-sm">
                Day {gameState?.currentDay || 1}
              </div>
              
              {/* Settings button (mobile) */}
              <button className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;