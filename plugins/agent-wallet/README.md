# Agent Wallet Plugin

Give any AI agent a non-custodial wallet with x402 payments, multi-chain support, on-chain identity, and reputation scoring.

## What It Does

This plugin integrates [agent-wallet-sdk](https://www.npmjs.com/package/agent-wallet-sdk) into Claude Code, enabling agents to create wallets, send payments, and manage on-chain identity -- all without custodial intermediaries.

## Contents

### Commands

| Command | Description |
|---------|-------------|
| `/create-wallet` | Create a new non-custodial wallet on any of 17 supported chains |
| `/send-payment` | Send a payment via x402 protocol or direct transfer |
| `/check-balance` | Check wallet balance across one or more chains |

### Skills

| Skill | Description |
|-------|-------------|
| `agent-payments` | Auto-invoked when building agents that handle money, wallets, or economic transactions. Provides architecture guidance and code patterns for agent-wallet-sdk |

## Supported Chains

Base, Ethereum, Solana, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Fantom, Gnosis, Celo, Moonbeam, zkSync Era, Scroll, Linea, Mantle, Blast

## Why Non-Custodial?

Autonomous AI agents need to sign transactions without human intervention. Custodial wallets require API keys to a third-party service -- creating a single point of failure and a trust dependency. With agent-wallet-sdk, the agent holds its own keys and can transact independently on any chain.

## x402 Payment Protocol

[x402](https://x402.org) is an open standard by Coinbase and Google for machine-to-machine payments over HTTP. When an agent encounters a `402 Payment Required` response, it automatically negotiates payment terms, signs the transaction, and accesses the resource. This plugin makes x402 a first-class capability in Claude Code.

## Links

- [agent-wallet-sdk on npm](https://www.npmjs.com/package/agent-wallet-sdk) (v5.1.1)
- [x402 Protocol](https://x402.org)
- [GitHub](https://github.com/up2itnow0822/agent-wallet-sdk)
- [AI Agent Economy](https://ai-agent-economy.hashnode.dev)
