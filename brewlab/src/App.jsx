import { useState } from 'react';
import BrewScreen from './screens/BrewScreen';
import RecipesScreen from './screens/RecipesScreen';
import JournalScreen from './screens/JournalScreen';
import ToolsScreen from './screens/ToolsScreen';
import BrewSession from './screens/BrewSession';
import RecipeDetail from './components/RecipeDetail';

function App() {
  const [tab, setTab] = useState('brew');
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [brewingRecipe, setBrewingRecipe] = useState(null);

  if (brewingRecipe) {
    return <BrewSession recipe={brewingRecipe} onClose={() => setBrewingRecipe(null)} />;
  }

  return (
    <>
      <div className="screen-enter" key={tab}>
        {tab === 'brew' && (
          <BrewScreen
            onSelectRecipe={setActiveRecipe}
            onStartBrew={setBrewingRecipe}
          />
        )}
        {tab === 'recipes' && (
          <RecipesScreen
            onSelectRecipe={setActiveRecipe}
            onStartBrew={setBrewingRecipe}
          />
        )}
        {tab === 'journal' && <JournalScreen />}
        {tab === 'tools' && <ToolsScreen />}
      </div>

      <nav className="tab-bar">
        <button className={`tab-item ${tab === 'brew' ? 'active' : ''}`} onClick={() => setTab('brew')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 8h1a4 4 0 110 8h-1" /><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
          </svg>
          <span>Brew</span>
        </button>
        <button className={`tab-item ${tab === 'recipes' ? 'active' : ''}`} onClick={() => setTab('recipes')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <span>Recipes</span>
        </button>
        <button className={`tab-item ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Journal</span>
        </button>
        <button className={`tab-item ${tab === 'tools' ? 'active' : ''}`} onClick={() => setTab('tools')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span>Tools</span>
        </button>
      </nav>

      {activeRecipe && (
        <RecipeDetail
          recipe={activeRecipe}
          onClose={() => setActiveRecipe(null)}
          onBrew={(r) => { setActiveRecipe(null); setBrewingRecipe(r); }}
        />
      )}
    </>
  );
}

export default App;
