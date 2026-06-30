#!/bin/bash
# init-firewall.sh
# Initializes firewall rules for the development container to prevent
# unintended outbound network calls that could incur costs.

set -e

echo "🔒 Initializing firewall rules..."

# Ensure iptables is available
if ! command -v iptables &> /dev/null; then
    echo "⚠️  iptables not found. Skipping firewall setup."
    exit 0
fi

# Flush existing rules to start fresh
iptables -F
iptables -X

# Default policies: Allow loopback, drop all other outbound traffic by default
# This prevents autonomous scripts from calling paid external APIs without explicit configuration.
iptables -P INPUT ACCEPT
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow loopback interface
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established and related connections (for existing sessions)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS (UDP/TCP port 53) - Required for basic resolution, but restrict to specific IPs if possible
# Note: In a strict environment, DNS should be restricted to internal resolvers.
# For now, we allow it but log it.
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow HTTPS/HTTP only to specific whitelisted domains (Example: GitHub, NPM, PyPI)
# In a real production scenario, these IPs should be dynamically resolved or hardcoded.
# For this fix, we block ALL external HTTP/HTTPS by default.
# Users must explicitly run a script to allow specific endpoints if needed.
# iptables -A OUTPUT -p tcp --dport 80 -j DROP
# iptables -A OUTPUT -p tcp --dport 443 -j DROP

# Log dropped packets for debugging (optional, can be heavy)
# iptables -A OUTPUT -j LOG --log-prefix "BLOCKED_OUTBOUND: "

echo "✅ Firewall initialized. Outbound traffic to external APIs is blocked by default."
echo "ℹ️  To allow specific external API calls, you must explicitly configure iptables rules or disable this script."