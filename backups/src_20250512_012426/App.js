import React, { useEffect } from 'react';
import { GameStateProvider } from './contexts/GameStateContext';
import { ResourcesProvider } from './contexts/ResourcesContext';
import { CharacterProvider } from './contexts/CharacterContext';
import { DailyRewardsProvider } from './contexts/DailyRewardsContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import CharacterCard from './components/character/CharacterCard';
import QuestList from './components/missions/QuestList';
import ResourcesPanel from './components/resources/ResourcesPanel';
import DiplomacyCard from './components/diplomacy/DiplomacyCard';
import ResearchPanel from './components/research/ResearchPanel';
import EventLog from './components/events/EventLog';
import InfrastructurePanel from './components/infrastructure/InfrastructurePanel';
import DailyRewardModal from './components/rewards/DailyRewardModal';
import './styles/index.css';

function App() {
  // Log app startup (could be replaced with proper analytics)
  useEffect(() => {
    console.log('AgentLand application started');
  }, []);

  return (
    <GameStateProvider>
      <ResourcesProvider>
        <CharacterProvider>
          <DailyRewardsProvider>
            <div className="min-h-screen bg-gray-900 text-white">
              <Header />
              
              <main className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <CharacterCard />
                    <DiplomacyCard />
                  </div>
                  
                  {/* Middle Column */}
                  <div className="space-y-6">
                    <QuestList />
                    <EventLog />
                  </div>
                  
                  {/* Right Column */}
                  <div className="space-y-6">
                    <ResourcesPanel />
                    <ResearchPanel />
                    <InfrastructurePanel />
                  </div>
                </div>
              </main>
              
              <Footer />
              
              {/* Daily Reward Modal - will show conditionally based on context state */}
              <DailyRewardModal />
            </div>
          </DailyRewardsProvider>
        </CharacterProvider>
      </ResourcesProvider>
    </GameStateProvider>
  );
}

export default App;