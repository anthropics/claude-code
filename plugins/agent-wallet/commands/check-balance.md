---
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(node:*)
description: Check the balance of an agent wallet on any supported chain
---

## Context

- Current directory: !`pwd`
- Package check: !`npm list agent-wallet-sdk 2>/dev/null || echo "agent-wallet-sdk not installed"`

## Your task

Check the balance of an agent wallet across one or more chains.

### Steps

1. Check if `agent-wallet-sdk` is installed. If not, install it.

2. Ask the user for:
   - **Wallet address** (required, or use the current agent's wallet)
   - **Chain** (default: base, or "all" for multi-chain check)
   - **Tokens** (default: native + USDC)

3. Create and run:
   ```javascript
   const { AgentWallet } = require('agent-wallet-sdk');
   
   const wallet = new AgentWallet({ chain: 'base' });
   const balance = await wallet.getBalance();
   
   console.log('Wallet Balance:');
   console.log('  Address:', wallet.address);
   console.log('  Chain:', wallet.chain);
   console.log('  Native:', balance.native);
   console.log('  USDC:', balance.usdc);
   ```

4. Display the balance in a clean format.

Do not do anything else beyond checking the balance. Keep output concise.
