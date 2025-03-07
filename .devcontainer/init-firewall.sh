#!/bin/bash
set -uo pipefail
IFS=$'\n\t'

# Global variables
DEBUG=${DEBUG:-false}
ADDED_IPS_FILE="/tmp/claude-fw-added-ips.txt"
IPV6_ENABLED=false
IPSET_AVAILABLE=true

# Logging functions
log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"; }
error() { log "ERROR: $1"; }
warning() { log "WARNING: $1"; }
debug_log() { [ "$DEBUG" = true ] && log "DEBUG: $1"; }

# Execute command with fallback
try_cmd() {
    debug_log "Trying: $1"
    if eval "$1" &>/dev/null; then return 0; fi
    if [ -n "$2" ]; then
        debug_log "Trying fallback: $2"
        if eval "$2" &>/dev/null; then return 0; fi
    fi
    warning "Failed: ${3:-Command}"
    return 1
}

# Add IP to allowed list with deduplication
add_ip() {
    local ip="$1"
    [ -f "$ADDED_IPS_FILE" ] && grep -q "^$ip$" "$ADDED_IPS_FILE" && return 0

    if [ "$IPSET_AVAILABLE" = true ] && ipset add claude-allowed-domains "$ip"; then
        echo "$ip" >> "$ADDED_IPS_FILE"
        return 0
    elif iptables -A CLAUDE_OUTPUT -d "$ip" -j ACCEPT; then
        echo "$ip" >> "$ADDED_IPS_FILE"
        return 0
    else
        debug_log "Failed to add IP: $ip"
        return 1
    fi
}

# Add IPv6 if supported
add_ipv6() {
    [ "$IPV6_ENABLED" != true ] && return 0
    local ip="$1"
    [ -f "$ADDED_IPS_FILE" ] && grep -q "^$ip$" "$ADDED_IPS_FILE" && return 0

    if ip6tables -A CLAUDE_OUTPUT -d "$ip" -j ACCEPT; then
        echo "$ip" >> "$ADDED_IPS_FILE"
        return 0
    else
        debug_log "Failed to add IPv6: $ip"
        return 1
    fi
}

# Resolve domain and add IPs
add_domain() {
    local domain="$1"
    log "Resolving $domain..."

    local ips=$(dig +short A "$domain" || echo "")
    [ -z "$ips" ] && warning "Failed to resolve $domain" && return 1

    local count=0
    while read -r ip; do
        [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] && add_ip "$ip" && count=$((count+1))
    done < <(echo "$ips")

    debug_log "Added $count IPs for $domain"
    return 0
}

# Add networks for interface
add_interface() {
    local iface="$1"
    log "Adding networks for interface $iface..."

    local addresses=$(ip -o addr show dev "$iface" | grep -w inet | awk '{print $4}')
    [ -z "$addresses" ] && debug_log "No addresses for $iface" && return 1

    local count=0
    for addr in $addresses; do
        if try_cmd "iptables -A CLAUDE_INPUT -s $addr -j ACCEPT" "" "INPUT rule for $addr" &&
           try_cmd "iptables -A CLAUDE_OUTPUT -d $addr -j ACCEPT" "" "OUTPUT rule for $addr"; then
            count=$((count+1))
        fi
    done

    log "Added $count network rules for $iface"
    return 0
}

# Clean up rules
cleanup() {
    log "Cleaning up..."
    iptables -D INPUT -j CLAUDE_INPUT || true
    iptables -D OUTPUT -j CLAUDE_OUTPUT || true
    iptables -D FORWARD -j CLAUDE_FORWARD || true
    iptables -F CLAUDE_INPUT || true
    iptables -F CLAUDE_OUTPUT || true
    iptables -F CLAUDE_FORWARD || true
    iptables -X CLAUDE_INPUT || true
    iptables -X CLAUDE_OUTPUT || true
    iptables -X CLAUDE_FORWARD || true
    ipset destroy claude-allowed-domains || true
    rm -f "$ADDED_IPS_FILE"
    log "Cleanup complete"
}

# Test connectivity
test_conn() {
    log "Testing connectivity to $1..."
    if curl --connect-timeout 5 -s "https://$1" >/dev/null 2>&1; then
        log "✓ Connection to $1 successful"
        return 0
    else
        warning "Unable to reach $1"
        return 1
    fi
}

# Set up trap for cleanup
trap cleanup INT TERM

# Check for command availability
for cmd in iptables curl; do
    command -v "$cmd" &>/dev/null || { error "Required command '$cmd' not found"; exit 1; }
done

for cmd in ipset ip6tables; do
    if ! command -v "$cmd" &>/dev/null; then
        warning "Optional command '$cmd' not found, limited functionality"
        [ "$cmd" = "ipset" ] && IPSET_AVAILABLE=false
        [ "$cmd" = "ip6tables" ] && IPV6_ENABLED=false
    fi
done

# Check IPv6 support
if [ "$IPV6_ENABLED" != true ] && ip -6 addr show &>/dev/null && command -v ip6tables &>/dev/null; then
    if ip6tables -L INPUT &>/dev/null; then
        log "IPv6 detected and enabled"
        IPV6_ENABLED=true
    fi
fi

# Initialize tracking file
> "$ADDED_IPS_FILE"

# Start configuration
log "Starting Claude firewall configuration..."

# Create custom chains
log "Creating custom chains..."
for chain in CLAUDE_INPUT CLAUDE_OUTPUT CLAUDE_FORWARD; do
    try_cmd "iptables -N $chain" "iptables -F $chain" "Creating chain $chain"
done

# Add chain references
log "Adding chain references..."
iptables -D INPUT -j CLAUDE_INPUT || true
iptables -D OUTPUT -j CLAUDE_OUTPUT || true
iptables -D FORWARD -j CLAUDE_FORWARD || true

try_cmd "iptables -I INPUT 1 -j CLAUDE_INPUT" "iptables -A INPUT -j CLAUDE_INPUT" "Jump to CLAUDE_INPUT"
try_cmd "iptables -I OUTPUT 1 -j CLAUDE_OUTPUT" "iptables -A OUTPUT -j CLAUDE_OUTPUT" "Jump to CLAUDE_OUTPUT"
try_cmd "iptables -I FORWARD 1 -j CLAUDE_FORWARD" "iptables -A FORWARD -j CLAUDE_FORWARD" "Jump to CLAUDE_FORWARD"

# Create ipset
if [ "$IPSET_AVAILABLE" = true ]; then
    log "Creating ipset..."
    ipset destroy claude-allowed-domains || true
    if ! ipset create claude-allowed-domains hash:net; then
        warning "Failed to create ipset, using direct rules"
        IPSET_AVAILABLE=false
    fi
fi

# Basic connectivity rules
log "Setting up basic connectivity..."
try_cmd "iptables -A CLAUDE_INPUT -i lo -j ACCEPT" "iptables -I INPUT 1 -i lo -j ACCEPT" "Localhost input"
try_cmd "iptables -A CLAUDE_OUTPUT -o lo -j ACCEPT" "iptables -I OUTPUT 1 -o lo -j ACCEPT" "Localhost output"
try_cmd "iptables -A CLAUDE_OUTPUT -p udp --dport 53 -j ACCEPT" "" "DNS out UDP"
try_cmd "iptables -A CLAUDE_OUTPUT -p tcp --dport 53 -j ACCEPT" "" "DNS out TCP"
try_cmd "iptables -A CLAUDE_INPUT -p udp --sport 53 -j ACCEPT" "" "DNS in UDP"
try_cmd "iptables -A CLAUDE_INPUT -p tcp --sport 53 -j ACCEPT" "" "DNS in TCP"
try_cmd "iptables -A CLAUDE_OUTPUT -p tcp --dport 22 -j ACCEPT" "" "SSH out"
try_cmd "iptables -A CLAUDE_INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" \
        "iptables -A CLAUDE_INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT" "ESTABLISHED in"
try_cmd "iptables -A CLAUDE_OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" \
        "iptables -A CLAUDE_OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT" "ESTABLISHED out"

# Add GitHub IPs
log "Adding GitHub IPs..."
gh_ranges=$(curl -s --connect-timeout 5 https://api.github.com/meta)
if [ -n "$gh_ranges" ] && echo "$gh_ranges" | grep -q "api"; then
    while read -r cidr; do
        [[ -n "$cidr" ]] && add_ip "$cidr"
    done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' || echo "")
else
    # Fallback GitHub IPs
    for ip in "140.82.112.0/20" "192.30.252.0/22" "185.199.108.0/22" "143.55.64.0/20"; do
        add_ip "$ip"
    done
fi

# Add important domains
log "Adding important domains..."
for domain in "registry.npmjs.org" "api.anthropic.com" "sentry.io" "statsig.anthropic.com" \
              "cursor.blob.core.windows.net" "statsig.com" "marketplace.visualstudio.com" \
              "vscode.blob.core.windows.net" "marketplace-cdn.vsassets.io" "vsmarketplacebadge.apphb.com"; do
    add_domain "$domain"
done

# Add Azure IPs
log "Adding Azure IPs..."
for azure_ip in "13.107.246.0/24" "13.107.6.0/24" "13.107.9.0/24" "20.190.128.0/18" \
                "40.74.0.0/18" "40.90.0.0/16" "40.119.0.0/16" "40.126.0.0/18" \
                "52.133.128.0/17" "52.245.64.0/18" "204.79.197.0/24"; do
    add_ip "$azure_ip"
done

# Add AWS S3 IPs (simplified)
log "Adding AWS S3 IPs..."
aws_json=$(curl -s --connect-timeout 5 "https://ip-ranges.amazonaws.com/ip-ranges.json")
if [ -n "$aws_json" ]; then
    while read -r ip; do
        [[ -n "$ip" ]] && add_ip "$ip"
    done < <(echo "$aws_json" | jq -r '.prefixes[] | select(.service=="S3") | .ip_prefix' || echo "")

    if [ "$IPV6_ENABLED" = true ]; then
        while read -r ip; do
            [[ -n "$ip" ]] && add_ipv6 "$ip"
        done < <(echo "$aws_json" | jq -r '.ipv6_prefixes[] | select(.service=="S3") | .ipv6_prefix' || echo "")
    fi
fi

# Host network configuration
log "Configuring host network..."
HOST_IP=$(ip route | grep default | awk '{print $3}' || hostname -I | awk '{print $1}')
if [ -n "$HOST_IP" ]; then
    log "Host IP: $HOST_IP"
    IFS='.' read -r a b c d <<< "$HOST_IP"
    HOST_NETWORK="${a}.${b}.${c}.0/24"

    try_cmd "iptables -A CLAUDE_INPUT -s $HOST_NETWORK -j ACCEPT" "" "Host network IN"
    try_cmd "iptables -A CLAUDE_OUTPUT -d $HOST_NETWORK -j ACCEPT" "" "Host network OUT"

    # Default gateway
    DEFAULT_GATEWAY=$(ip route | grep default | awk '{print $3}')
    if [ -n "$DEFAULT_GATEWAY" ]; then
        try_cmd "iptables -A CLAUDE_INPUT -s $DEFAULT_GATEWAY -j ACCEPT" "" "Gateway IN"
        try_cmd "iptables -A CLAUDE_OUTPUT -d $DEFAULT_GATEWAY -j ACCEPT" "" "Gateway OUT"
    fi
fi

# Interface networks
log "Adding interface networks..."
for iface in $(ip -o link show | grep -v lo | awk -F': ' '{print $2}'); do
    add_interface "$iface"
done

# HTTPS traffic
log "Adding HTTPS rules..."
try_cmd "iptables -A CLAUDE_INPUT -p tcp --sport 443 -j ACCEPT" "" "HTTPS in"
try_cmd "iptables -A CLAUDE_OUTPUT -p tcp --dport 443 -j ACCEPT" "" "HTTPS out"

# ipset rule (if available)
if [ "$IPSET_AVAILABLE" = true ]; then
    try_cmd "iptables -A CLAUDE_OUTPUT -m set --match-set claude-allowed-domains dst -j ACCEPT" "" "ipset rule"
fi

# Final drop rule
log "Adding default drop rule..."
try_cmd "iptables -A CLAUDE_OUTPUT -j DROP" "iptables -A CLAUDE_OUTPUT -j REJECT" "Default DROP"

# Optional logging
try_cmd "iptables -A CLAUDE_OUTPUT -m limit --limit 5/min -j LOG --log-prefix \"CLAUDE_FIREWALL: \" --log-level 4" "" "Logging"

# Verification
log "Verifying configuration..."
test_conn "api.github.com"
test_conn "marketplace.visualstudio.com"

log "Claude firewall configuration finished"
exit 0
