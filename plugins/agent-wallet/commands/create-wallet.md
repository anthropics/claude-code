---
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(node:*)
description: Create a non-custodial agent wallet on any supported chain
---

## Context

- Current directory: !`pwd`
- Package check: !`npm list agent-wallet-sdk 2>/dev/null || echo "agent-wallet-sdk not installed"`
- Node version: !`node --version`

## Your task

Create a new non-custodial AI agent wallet using agent-wallet-sdk.

### Steps

1. Check if `agent-wallet-sdk` is installed. If not, install it:
   ```bash
   npm install agent-wallet-sdk
   ```

2. Ask the user which chain they want (default: `base`). Supported chains: base, ethereum, polygon, arbitrum, optimism, solana, bnb, avalanche, fantom, gnosis, celo, moonbeam, zksync, scroll, linea, mantle, blast.

3. Create a wallet initialization script:
   ```javascript
   const { AgentWallet } = require('agent-wallet-sdk');
   
   const wallet = new AgentWallet({
     chain: 'base', // user's chosen chain
   });
   
   console.log('Wallet created:');
   console.log('  Address:', wallet.address);
   console.log('  Chain:', wallet.chain);
   console.log('  Type: Non-custodial (agent holds own keys)');
   ```

4. Run the script and display the wallet address.

5. Remind the user: "This wallet is non-custodial. The private key exists only in your agent's runtime. No third party has access to your funds."

Do not do anything else beyond creating the wallet. Keep output concise.
