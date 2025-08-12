#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Configuration - Domain list as shell array for easy maintenance
declare -a DYNAMIC_DOMAINS=(
    "registry.npmjs.org"
    "api.anthropic.com"
    "sentry.io"
    "statsig.anthropic.com"
    "statsig.com"
)

# IPSet configuration
IPSET_STATIC="allowed-static"    # For GitHub and other static IPs
IPSET_DYNAMIC="allowed-dynamic"  # For dynamically resolved domains
DNS_TTL=600                      # DNS cache timeout in seconds

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy "$IPSET_STATIC" 2>/dev/null || true
ipset destroy "$IPSET_DYNAMIC" 2>/dev/null || true
ipset destroy allowed-domains 2>/dev/null || true

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

# Create ipsets
ipset create "$IPSET_STATIC" hash:net
ipset create "$IPSET_DYNAMIC" hash:ip timeout "$DNS_TTL"

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
    ipset add "$IPSET_STATIC" "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q 2>/dev/null || echo "$gh_ranges" | jq -r '(.web + .api + .git)[]')

# Resolve and add other allowed domains with TTL
for domain in "${DYNAMIC_DOMAINS[@]}"; do
    echo "Resolving $domain..."
    ips=$(dig +short A "$domain")
    if [ -z "$ips" ]; then
        echo "ERROR: Failed to resolve $domain"
        exit 1
    fi
    
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        ipset add "$IPSET_DYNAMIC" "$ip" timeout "$DNS_TTL" -exist
    done < <(echo "$ips")
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
iptables -A OUTPUT -m set --match-set "$IPSET_STATIC" dst -j ACCEPT
iptables -A OUTPUT -m set --match-set "$IPSET_DYNAMIC" dst -j ACCEPT

# Create DNS refresh script
cat > /usr/local/bin/refresh-dynamic-domains.sh << EOF
#!/bin/bash
IPSET_DYNAMIC="$IPSET_DYNAMIC"
DNS_TTL=$DNS_TTL

# Domain list passed as arguments
for domain in $@; do
    ips=\$(dig +short A "\$domain" 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\$')
    if [ -n "\$ips" ]; then
        while IFS= read -r ip; do
            ipset add "\$IPSET_DYNAMIC" "\$ip" timeout "\$DNS_TTL" -exist 2>/dev/null
        done <<< "\$ips"
    fi
done
EOF

chmod +x /usr/local/bin/refresh-dynamic-domains.sh 2>/dev/null || true

# Setup cron job for automatic refresh
if command -v crontab &> /dev/null; then
    DOMAIN_ARGS="${DYNAMIC_DOMAINS[@]}"
    (crontab -l 2>/dev/null || true; echo "*/5 * * * * /usr/local/bin/refresh-dynamic-domains.sh $DOMAIN_ARGS") | \
        grep -v refresh-dynamic-domains | \
        (cat; echo "*/5 * * * * /usr/local/bin/refresh-dynamic-domains.sh $DOMAIN_ARGS") | \
        crontab - 2>/dev/null || true
fi

echo "Firewall configuration complete"
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
