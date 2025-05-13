#!/usr/bin/env node

/**
 * Activate MCP Hooks
 * 
 * This script activates the MCP hooks by removing the redundant components
 * and updating import statements to use the MCP hooks instead.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WORKSPACE_DIR = process.cwd();
const UI_DASHBOARD_DIR = path.join(WORKSPACE_DIR, 'ui/dashboard');
const SRC_COMPONENTS_DIR = path.join(WORKSPACE_DIR, 'src/components');
const SRC_CONTEXTS_DIR = path.join(WORKSPACE_DIR, 'src/contexts');

console.log('Activating MCP hooks...');

// Function to find all JS/JSX files in a directory
function findJsFiles(dir) {
  let results = [];
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findJsFiles(filePath));
    } else if (/\.(js|jsx)$/.test(file)) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Remove redundant dashboard implementation
console.log('Removing redundant dashboard implementation...');

if (fs.existsSync(path.join(UI_DASHBOARD_DIR, 'main.js'))) {
  fs.unlinkSync(path.join(UI_DASHBOARD_DIR, 'main.js'));
  console.log('Removed ui/dashboard/main.js');
}

// Update import statements to use MCP hooks
console.log('Updating import statements to use MCP hooks...');

// Find all JS/JSX files
const jsFiles = findJsFiles(SRC_COMPONENTS_DIR);

let updatedFiles = 0;

for (const file of jsFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let updatedContent = content;
  
  // Replace GameStateContext imports with useMcpGameState
  updatedContent = updatedContent.replace(
    /import\s+{\s*([^}]*)GameStateContext([^}]*)\s*}\s*from\s+['"]([^'"]*)['"]/g,
    (match, before, after, importPath) => {
      // If the import has other items, keep them
      const otherItems = before + after;
      const cleanedItems = otherItems.replace(/,s*,/g, ',').replace(/^s*,s*|s*,s*$/g, '');
      
      if (cleanedItems.trim() !== '') {
        return `import { ${cleanedItems} } from '${importPath}'\nimport { useMcpGameState } from "./hooks/mcp"`;
      } else {
        return `import { useMcpGameState } from "./hooks/mcp"`;
      }
    }
  );
  
  // Replace useContext(GameStateContext) with useMcpGameState()
  updatedContent = updatedContent.replace(
    /useContext\s*\(\s*GameStateContext\s*\)/g,
    'useMcpGameState()'
  );
  
  // Replace DailyRewardsContext imports with useMcpDailyRewards
  updatedContent = updatedContent.replace(
    /import\s+{\s*([^}]*)DailyRewardsContext([^}]*)\s*}\s*from\s+['"]([^'"]*)['"]/g,
    (match, before, after, importPath) => {
      // If the import has other items, keep them
      const otherItems = before + after;
      const cleanedItems = otherItems.replace(/,s*,/g, ',').replace(/^s*,s*|s*,s*$/g, '');
      
      if (cleanedItems.trim() !== '') {
        return `import { ${cleanedItems} } from '${importPath}'\nimport { useMcpDailyRewards } from "./hooks/mcp"`;
      } else {
        return `import { useMcpDailyRewards } from "./hooks/mcp"`;
      }
    }
  );
  
  // Replace useContext(DailyRewardsContext) with useMcpDailyRewards()
  updatedContent = updatedContent.replace(
    /useContext\s*\(\s*DailyRewardsContext\s*\)/g,
    'useMcpDailyRewards()'
  );
  
  // Update the file if changes were made
  if (updatedContent !== content) {
    fs.writeFileSync(file, updatedContent);
    console.log(`Updated imports in ${file}`);
    updatedFiles++;
  }
}

console.log(`Updated ${updatedFiles} files to use MCP hooks`);

// Create symbolic links for backwards compatibility
console.log('Creating symbolic links for backwards compatibility...');

// Move context files to a backup location
if (fs.existsSync(path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'))) {
  fs.renameSync(
    path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'),
    path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx.bak')
  );
  console.log('Backed up GameStateContext.jsx');
}

if (fs.existsSync(path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'))) {
  fs.renameSync(
    path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'),
    path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx.bak')
  );
  console.log('Backed up DailyRewardsContext.jsx');
}

// Create adapter files that use the MCP hooks
const gameStateAdapterContent = `import React, { createContext } from 'react';
import { useMcpGameState } from "./hooks/mcp";

// This is an adapter for backwards compatibility
// It provides the same API as the original GameStateContext
// but uses the MCP hooks underneath

const GameStateContext = createContext(null);

export const GameStateProvider = ({ children }) => {
  const gameState = useMcpGameState();
  
  return (
    <GameStateContext.Provider value={gameState}>
      {children}
    </GameStateContext.Provider>
  );
};

export { GameStateContext };
`;

const rewardsAdapterContent = `import React, { createContext } from 'react';
import { useMcpDailyRewards } from "./hooks/mcp";

// This is an adapter for backwards compatibility
// It provides the same API as the original DailyRewardsContext
// but uses the MCP hooks underneath

const DailyRewardsContext = createContext(null);

export const DailyRewardsProvider = ({ children }) => {
  const rewards = useMcpDailyRewards();
  
  return (
    <DailyRewardsContext.Provider value={rewards}>
      {children}
    </DailyRewardsContext.Provider>
  );
};

export { DailyRewardsContext };
`;

fs.writeFileSync(path.join(SRC_CONTEXTS_DIR, 'GameStateContext.jsx'), gameStateAdapterContent);
console.log('Created GameStateContext adapter');

fs.writeFileSync(path.join(SRC_CONTEXTS_DIR, 'DailyRewardsContext.jsx'), rewardsAdapterContent);
console.log('Created DailyRewardsContext adapter');

console.log('MCP hooks activation complete!');
console.log(`
Next steps:
1. Add the memory-persistence-backend.js API endpoints to your Express server
2. Update your application to use the MCP hooks directly in new components
3. Test the application to ensure everything works correctly
4. Refer to the docs/guides/mcp_hooks_usage.md guide for more information on using MCP hooks
`);