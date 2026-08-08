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

# Flush existing IPv6 rules
ip6tables -F
ip6tables -X
ip6tables -t mangle -F
ip6tables -t mangle -X
ipset destroy allowed-domains-v6 2>/dev/null || true

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
# Allow outbound DNS (IPv4)
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses (IPv4)
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH (IPv4)
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses (IPv4)
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost (IPv4)
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow DNS, SSH, and localhost (IPv6)
ip6tables -A OUTPUT -p udp --dport 53 -j ACCEPT
ip6tables -A INPUT -p udp --sport 53 -j ACCEPT
ip6tables -A OUTPUT -p tcp --dport 22 -j ACCEPT
ip6tables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
ip6tables -A INPUT -i lo -j ACCEPT
ip6tables -A OUTPUT -o lo -j ACCEPT

# Create ipsets with CIDR support
ipset create allowed-domains hash:net
ipset create allowed-domains-v6 hash:net family inet6

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

echo "Processing GitHub IPv4 ranges..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | grep -v ':' | aggregate -q)

echo "Processing GitHub IPv6 ranges..."
while read -r cidr; do
    if [[ ! "$cidr" =~ : ]]; then
        continue  # Skip non-IPv6 entries
    fi
    echo "Adding GitHub IPv6 range $cidr"
    ipset add allowed-domains-v6 "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | grep ':' | sort -u)

# Resolve and add other allowed domains
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "sentry.io" \
    "statsig.anthropic.com" \
    "statsig.com" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com"; do
    echo "Resolving $domain..."

    # Resolve IPv4 (A records)
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

    # Resolve IPv6 (AAAA records)
    ipv6s=$(dig +noall +answer AAAA "$domain" | awk '$4 == "AAAA" {print $5}')
    if [ -n "$ipv6s" ]; then
        while read -r ip6; do
            if [[ ! "$ip6" =~ : ]]; then
                echo "WARNING: Invalid IPv6 from DNS for $domain: $ip6"
                continue
            fi
            echo "Adding IPv6 $ip6 for $domain"
            ipset add allowed-domains-v6 "$ip6"
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

# Set up remaining iptables rules (IPv4)
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Set default policies to DROP (IPv4)
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow established connections (IPv4)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow only specific outbound traffic to allowed domains (IPv4)
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback (IPv4)
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# Set up IPv6 rules
# Allow link-local traffic (required for IPv6 neighbor discovery)
ip6tables -A INPUT -s fe80::/10 -j ACCEPT
ip6tables -A OUTPUT -d fe80::/10 -j ACCEPT

# Allow ICMPv6 (required for IPv6 to function: neighbor discovery, router ads, etc.)
ip6tables -A INPUT -p ipv6-icmp -j ACCEPT
ip6tables -A OUTPUT -p ipv6-icmp -j ACCEPT

# Set default policies to DROP (IPv6)
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT DROP

# Allow established connections (IPv6)
ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
ip6tables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow only specific outbound traffic to allowed domains (IPv6)
ip6tables -A OUTPUT -m set --match-set allowed-domains-v6 dst -j ACCEPT

# Explicitly REJECT all other outbound IPv6 traffic for immediate feedback
ip6tables -A OUTPUT -j REJECT --reject-with icmp6-adm-prohibited

echo "Firewall configuration complete (IPv4 and IPv6)"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
