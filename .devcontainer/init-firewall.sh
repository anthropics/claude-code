#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true
ipset destroy allowed-domains-v6 2>/dev/null || true

# Detect IPv6 support. Without matching ip6tables rules, dual-stack networks
# let IPv6 egress bypass the allowlist below entirely. On hosts where IPv6 is
# disabled (e.g. ipv6.disable=1), ip6tables cannot operate - there is no IPv6
# traffic to filter, so skip IPv6 rules rather than fail container startup.
if ip6tables -L -n >/dev/null 2>&1; then
    IPV6_ENABLED=true
    ip6tables -F
    ip6tables -X
    ip6tables -t mangle -F 2>/dev/null || true
    ip6tables -t mangle -X 2>/dev/null || true
else
    IPV6_ENABLED=false
    echo "WARNING: ip6tables unavailable - skipping IPv6 firewall rules"
fi

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Same DNS/SSH/localhost allowances for IPv6
if [ "$IPV6_ENABLED" = true ]; then
    ip6tables -A OUTPUT -p udp --dport 53 -j ACCEPT
    ip6tables -A INPUT -p udp --sport 53 -j ACCEPT
    ip6tables -A OUTPUT -p tcp --dport 22 -j ACCEPT
    ip6tables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
    ip6tables -A INPUT -i lo -j ACCEPT
    ip6tables -A OUTPUT -o lo -j ACCEPT
fi

# Create ipset with CIDR support
ipset create allowed-domains hash:net
if [ "$IPV6_ENABLED" = true ]; then
    ipset create allowed-domains-v6 hash:net family inet6
fi

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | grep -v ':' | aggregate -q)

if [ "$IPV6_ENABLED" = true ]; then
    echo "Processing GitHub IPv6 ranges..."
    while read -r cidr; do
        if [[ ! "$cidr" =~ ^[0-9a-fA-F:]+/[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IPv6 CIDR range from GitHub meta: $cidr"
            exit 1
        fi
        echo "Adding GitHub IPv6 range $cidr"
        ipset add allowed-domains-v6 "$cidr"
    done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | grep ':' | sort -u)
fi

# Resolve and add other allowed domains
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "sentry.io" \
    "statsig.com" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com"; do
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "ERROR: Failed to resolve $domain"
        exit 1
    fi
    
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        echo "Adding $ip for $domain"
        ipset add allowed-domains "$ip"
    done < <(echo "$ips")

    # Also add AAAA records so allowed domains work first-class over IPv6.
    # A missing AAAA record is not an error: IPv6 attempts are rejected fast
    # below and clients fall back to IPv4.
    if [ "$IPV6_ENABLED" = true ]; then
        ipv6s=$(dig +noall +answer AAAA "$domain" | awk '$4 == "AAAA" {print $5}')
        while read -r ip; do
            if [ -n "$ip" ]; then
                if [[ ! "$ip" =~ ^[0-9a-fA-F:]+$ ]]; then
                    echo "ERROR: Invalid IPv6 from DNS for $domain: $ip"
                    exit 1
                fi
                echo "Adding $ip for $domain (IPv6)"
                ipset add allowed-domains-v6 "$ip"
            fi
        done < <(echo "$ipv6s")
    fi
done

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# Set up remaining iptables rules
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies to DROP first
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# First allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Then allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# IPv6: same default-deny posture, so IPv6 cannot bypass the IPv4 allowlist
if [ "$IPV6_ENABLED" = true ]; then
    # Link-local and ICMPv6 are required for neighbor discovery; without
    # them IPv6 breaks entirely, even for allowed destinations
    ip6tables -A INPUT -s fe80::/10 -j ACCEPT
    ip6tables -A OUTPUT -d fe80::/10 -j ACCEPT
    ip6tables -A INPUT -p ipv6-icmp -j ACCEPT
    ip6tables -A OUTPUT -p ipv6-icmp -j ACCEPT

    # Set default policies to DROP
    ip6tables -P INPUT DROP
    ip6tables -P FORWARD DROP
    ip6tables -P OUTPUT DROP

    # Allow established connections for already approved traffic
    ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    ip6tables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

    # Then allow only specific outbound traffic to allowed domains
    ip6tables -A OUTPUT -m set --match-set allowed-domains-v6 dst -j ACCEPT

    # REJECT (not DROP) so blocked IPv6 attempts fail fast and clients
    # fall back to IPv4 instead of hanging
    ip6tables -A OUTPUT -j REJECT --reject-with icmp6-adm-prohibited
fi

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify the block also holds over IPv6 (in IPv4-only environments curl -6
# cannot connect at all, so this check passes there too)
if [ "$IPV6_ENABLED" = true ]; then
    if curl -6 --connect-timeout 5 https://example.com >/dev/null 2>&1; then
        echo "ERROR: Firewall verification failed - was able to reach https://example.com over IPv6"
        exit 1
    else
        echo "Firewall verification passed - unable to reach https://example.com over IPv6 as expected"
    fi
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
