---
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(node:*)
description: Send a payment using x402 protocol or direct transfer
---

## Context

- Current directory: !`pwd`
- Package check: !`npm list agent-wallet-sdk 2>/dev/null || echo "agent-wallet-sdk not installed"`

## Your task

Send a payment from an agent wallet using the x402 payment protocol or a direct token transfer.

### Steps

1. Check if `agent-wallet-sdk` is installed. If not, install it.

2. Ask the user for:
   - **Recipient address** (required)
   - **Amount** (required)
   - **Token** (default: USDC)
   - **Chain** (default: base)
   - **Method**: `x402` (HTTP 402 payment flow) or `direct` (on-chain transfer)

3. For x402 payments, create and run:
   ```javascript
   const { AgentWallet } = require('agent-wallet-sdk');
   
   const wallet = new AgentWallet({ chain: 'base' });
   const result = await wallet.x402Client.pay({
     resourceUrl: '<recipient_url>',
     maxAmount: '<amount>',
     token: 'USDC',
   });
   console.log('Payment result:', result);
   ```

4. For direct transfers, create and run:
   ```javascript
   const { AgentWallet } = require('agent-wallet-sdk');
   
   const wallet = new AgentWallet({ chain: 'base' });
   const tx = await wallet.transfer({
     to: '<recipient>',
     amount: '<amount>',
     token: 'USDC',
   });
   console.log('Transaction hash:', tx.hash);
   ```

5. Display the transaction result.

Do not do anything else beyond sending the payment. Keep output concise.
