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

# Execute command with better error handling
execute_cmd() {
	local cmd="$1"
	local description="${2:-Command}"

	debug_log "Executing: $cmd"

	# Capture both stdout and stderr
	local output
	if ! output=$(eval "$cmd" 2>&1); then
		error "Failed: $description"
		error "Command output: $output"
		return 1
	fi

	return 0
}

# Add IP to allowed list with deduplication
add_ip() {
	local ip="$1"
	[ -f "$ADDED_IPS_FILE" ] && grep -q "^$ip$" "$ADDED_IPS_FILE" && return 0

	if [ "$IPSET_AVAILABLE" = true ] && ipset add claude-allowed-domains "$ip" 2>/dev/null; then
		echo "$ip" >>"$ADDED_IPS_FILE"
		return 0
	elif iptables -A CLAUDE_OUTPUT -d "$ip" -j ACCEPT 2>/dev/null; then
		echo "$ip" >>"$ADDED_IPS_FILE"
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

	# Check if IP is too long for ip6tables
	if [ ${#ip} -gt 39 ]; then
		debug_log "IPv6 address too long: $ip"
		return 1
	fi

	[ -f "$ADDED_IPS_FILE" ] && grep -q "^$ip$" "$ADDED_IPS_FILE" && return 0

	# First make sure we have IPv6 chains created
	if ! ip6tables -L CLAUDE_OUTPUT &>/dev/null; then
		create_ipv6_chains
	fi

	if ip6tables -A CLAUDE_OUTPUT -d "$ip" -j ACCEPT 2>/dev/null; then
		echo "$ip" >>"$ADDED_IPS_FILE"
		return 0
	else
		debug_log "Failed to add IPv6: $ip"
		return 1
	fi
}

# Create IPv6 chains
create_ipv6_chains() {
	log "Creating IPv6 chains..."
	for chain in CLAUDE_INPUT CLAUDE_OUTPUT CLAUDE_FORWARD; do
		ip6tables -N $chain 2>/dev/null || ip6tables -F $chain 2>/dev/null
	done

	ip6tables -D INPUT -j CLAUDE_INPUT 2>/dev/null
	ip6tables -D OUTPUT -j CLAUDE_OUTPUT 2>/dev/null
	ip6tables -D FORWARD -j CLAUDE_FORWARD 2>/dev/null

	ip6tables -I INPUT 1 -j CLAUDE_INPUT 2>/dev/null || ip6tables -A INPUT -j CLAUDE_INPUT 2>/dev/null
	ip6tables -I OUTPUT 1 -j CLAUDE_OUTPUT 2>/dev/null || ip6tables -A OUTPUT -j CLAUDE_OUTPUT 2>/dev/null
	ip6tables -I FORWARD 1 -j CLAUDE_FORWARD 2>/dev/null || ip6tables -A FORWARD -j CLAUDE_FORWARD 2>/dev/null

	# IPv6 basic rules
	ip6tables -A CLAUDE_INPUT -i lo -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_OUTPUT -o lo -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_OUTPUT -p udp --dport 53 -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_OUTPUT -p tcp --dport 53 -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_INPUT -p udp --sport 53 -j ACCEPT 2>/dev/null
	ip6tables -A CLAUDE_INPUT -p tcp --sport 53 -j ACCEPT 2>/dev/null
}

# Resolve domain and add IPs
add_domain() {
	local domain="$1"
	log "Resolving $domain..."

	local ips=$(dig +short A "$domain" || echo "")
	if [ -z "$ips" ]; then
		warning "Failed to resolve $domain"
		return 1
	fi

	local count=0
	while read -r ip; do
		if [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
			add_ip "$ip" && count=$((count + 1))
		fi
	done < <(echo "$ips")

	# Also try IPv6 resolution if enabled
	if [ "$IPV6_ENABLED" = true ]; then
		local ipv6s=$(dig +short AAAA "$domain" || echo "")
		if [ -n "$ipv6s" ]; then
			while read -r ip; do
				if [[ -n "$ip" && "$ip" =~ : ]]; then
					add_ipv6 "$ip" && count=$((count + 1))
				fi
			done < <(echo "$ipv6s")
		fi
	fi

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
		execute_cmd "iptables -A CLAUDE_INPUT -s $addr -j ACCEPT" "INPUT rule for $addr"
		execute_cmd "iptables -A CLAUDE_OUTPUT -d $addr -j ACCEPT" "OUTPUT rule for $addr"
		count=$((count + 1))
	done

	# Also add IPv6 rules for the interface if enabled
	if [ "$IPV6_ENABLED" = true ]; then
		local ipv6_addresses=$(ip -o addr show dev "$iface" | grep -w inet6 | awk '{print $4}')

		for addr in $ipv6_addresses; do
			if [ ${#addr} -le 39 ]; then # Check length to prevent hostname too long error
				execute_cmd "ip6tables -A CLAUDE_INPUT -s $addr -j ACCEPT" "IPv6 INPUT rule for $addr"
				execute_cmd "ip6tables -A CLAUDE_OUTPUT -d $addr -j ACCEPT" "IPv6 OUTPUT rule for $addr"
				count=$((count + 1))
			fi
		done
	fi

	log "Added $count network rules for $iface"
	return 0
}

# Clean up rules with better error handling
cleanup() {
	log "Cleaning up..."
	# Use || true to prevent failures from stopping script execution
	iptables -D INPUT -j CLAUDE_INPUT 2>/dev/null || true
	iptables -D OUTPUT -j CLAUDE_OUTPUT 2>/dev/null || true
	iptables -D FORWARD -j CLAUDE_FORWARD 2>/dev/null || true

	# Check if chains exist before trying to flush or delete them
	for chain in CLAUDE_INPUT CLAUDE_OUTPUT CLAUDE_FORWARD; do
		if iptables -L $chain -n >/dev/null 2>&1; then
			iptables -F $chain 2>/dev/null || true
			iptables -X $chain 2>/dev/null || true
		fi
	done

	if [ "$IPV6_ENABLED" = true ]; then
		ip6tables -D INPUT -j CLAUDE_INPUT 2>/dev/null || true
		ip6tables -D OUTPUT -j CLAUDE_OUTPUT 2>/dev/null || true
		ip6tables -D FORWARD -j CLAUDE_FORWARD 2>/dev/null || true

		for chain in CLAUDE_INPUT CLAUDE_OUTPUT CLAUDE_FORWARD; do
			if ip6tables -L $chain -n >/dev/null 2>&1; then
				ip6tables -F $chain 2>/dev/null || true
				ip6tables -X $chain 2>/dev/null || true
			fi
		done
	fi

	if ipset list claude-allowed-domains >/dev/null 2>&1; then
		ipset destroy claude-allowed-domains 2>/dev/null || true
	fi

	[ -f "$ADDED_IPS_FILE" ] && rm -f "$ADDED_IPS_FILE"
	log "Cleanup complete"
}

# Test connectivity with better timeout management
test_conn() {
	local domain="$1"
	local allowed="$2"
	local timeout=5

	log "Testing connectivity to $domain (should be ${allowed})"
	if [ "$allowed" = true ]; then
		# Force a new connection using --no-keepalive
		curl --connect-timeout $timeout --no-keepalive -s "https://$domain" >/dev/null 2>&1
		local status=$?
		if [ $status -ne 0 ]; then
			warning "Expected curl to succeed for https://$domain, but got $status"
			return 1
		fi
		log "Connection to https://$domain successful as expected"
		curl --connect-timeout $timeout --no-keepalive -s "http://$domain" >/dev/null 2>&1
		local http_status=$?
		log "HTTP connection to $domain returned status $http_status (should work for allowed domains)"
	else
		# For disallowed domains, force a fresh connection attempt
		curl --connect-timeout $timeout --no-keepalive -s "https://$domain" >/dev/null 2>&1
		local status=$?
		if [ $status -eq 0 ]; then
			warning "Expected curl to fail for https://$domain, but got $status"
			return 1
		fi
		log "Connection to https://$domain failed as expected"
		curl --connect-timeout $timeout --no-keepalive -s "http://$domain" >/dev/null 2>&1
		local http_status=$?
		if [ $http_status -eq 0 ]; then
			warning "Expected curl to fail for http://$domain, but got success"
			return 1
		fi
		log "HTTP connection to $domain blocked as expected"
	fi
	return 0
}

# Set up trap for cleanup only on errors or interruptions, not normal exit
trap 'cleanup; exit 1' INT TERM HUP

# Check for command availability with improved error handling
missing_commands=""
for cmd in iptables curl dig; do
	if ! command -v "$cmd" &>/dev/null; then
		missing_commands+="$cmd "
	fi
done

if [ -n "$missing_commands" ]; then
	error "Required commands not found: $missing_commands"
	log "Please install the missing packages and try again"
	exit 1
fi

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
>"$ADDED_IPS_FILE"

# Start configuration
log "Starting Claude firewall configuration..."

# Run cleanup first to ensure we start with a clean slate
cleanup

# Temporary allow ALL outbound HTTPS during initial setup
log "Temporarily allowing all outbound HTTPS traffic for initial setup..."
iptables -I OUTPUT -p tcp --dport 443 -j ACCEPT || {
	error "Failed to set temporary HTTPS allow rule. Check iptables permissions."
	exit 1
}

# Function to handle API requests with retry logic
fetch_with_retry() {
	local url="$1"
	local max_retries=3
	local retry=0
	local output=""

	while [ $retry -lt $max_retries ]; do
		output=$(curl -sSL --connect-timeout 10 "$url" 2>&1)
		if [ $? -eq 0 ] && [ -n "$output" ]; then
			echo "$output"
			return 0
		fi

		retry=$((retry + 1))
		log "Retry $retry/$max_retries for $url"
		sleep 2
	done

	log "Failed to fetch from $url after $max_retries attempts"
	return 1
}

# Download required files with improved error handling
log "Fetching GitHub IPs..."
gh_ranges=$(fetch_with_retry "https://api.github.com/meta")
if [ -n "$gh_ranges" ] && echo "$gh_ranges" | jq -e . >/dev/null 2>&1; then
	log "Successfully fetched GitHub IP ranges"
else
	error "Failed to fetch GitHub IP ranges - cannot continue without current GitHub IPs"
	cleanup
	exit 1
fi

# Download Azure IP ranges with retry logic
log "Fetching Azure CDN IPs..."
azure_ranges=$(fetch_with_retry "https://www.microsoft.com/en-us/download/confirmation.aspx?id=56519")
if [ -n "$azure_ranges" ]; then
    # Extract the download URL from the response - fix to handle only one URL
    download_url=$(echo "$azure_ranges" | grep -o 'https://download.microsoft.com/download/[^"]*ServiceTags_Public[^"]*\.json' | head -1)

    if [ -n "$download_url" ]; then
        log "Found Azure IP ranges download URL: $download_url"
        azure_ip_json=$(fetch_with_retry "$download_url")

        if [ -n "$azure_ip_json" ] && echo "$azure_ip_json" | jq -e . >/dev/null 2>&1; then
            log "Successfully fetched Azure IP ranges"

            # Extract Azure CDN IP ranges
            log "Adding Azure CDN IPs to allowed list..."
            while read -r cidr; do
                [[ -n "$cidr" ]] && add_ip "$cidr"
            done < <(echo "$azure_ip_json" | jq -r '.values[] | select(.name=="AzureFrontDoor.Frontend").properties.addressPrefixes[]' 2>/dev/null || echo "")

            # Also add Azure CDN Standard from Microsoft IP ranges
            while read -r cidr; do
                [[ -n "$cidr" ]] && add_ip "$cidr"
            done < <(echo "$azure_ip_json" | jq -r '.values[] | select(.name=="AzureCDN").properties.addressPrefixes[]' 2>/dev/null || echo "")
        else
            warning "Failed to parse Azure IP ranges JSON"
        fi
    else
        warning "Failed to extract Azure IP ranges download URL"
    fi
else
    warning "Failed to fetch Azure IP ranges - Azure CDN traffic may be blocked"
fi

# Remove temporary all-allow rule
log "Removing temporary HTTPS allow rule..."
iptables -D OUTPUT -p tcp --dport 443 -j ACCEPT || warning "Failed to remove temporary HTTPS rule"

# Create custom chains with better error handling
log "Creating custom chains..."
for chain in CLAUDE_INPUT CLAUDE_OUTPUT CLAUDE_FORWARD; do
	# Check if chain exists
	if iptables -L $chain -n >/dev/null 2>&1; then
		log "Chain $chain exists, flushing..."
		iptables -F $chain || {
			error "Failed to flush chain $chain"
			cleanup
			exit 1
		}
	else
		log "Creating chain $chain..."
		iptables -N $chain || {
			error "Failed to create chain $chain"
			cleanup
			exit 1
		}
	fi
done

# Add chain references
log "Adding chain references..."
iptables -D INPUT -j CLAUDE_INPUT 2>/dev/null || true
iptables -D OUTPUT -j CLAUDE_OUTPUT 2>/dev/null || true
iptables -D FORWARD -j CLAUDE_FORWARD 2>/dev/null || true

# Always insert rules at the beginning of chains - fail if this doesn't work
execute_cmd "iptables -I INPUT 1 -j CLAUDE_INPUT" "Jump to CLAUDE_INPUT"
execute_cmd "iptables -I OUTPUT 1 -j CLAUDE_OUTPUT" "Jump to CLAUDE_OUTPUT"
execute_cmd "iptables -I FORWARD 1 -j CLAUDE_FORWARD" "Jump to CLAUDE_FORWARD"

# Create ipset
if [ "$IPSET_AVAILABLE" = true ]; then
	log "Creating ipset..."
	ipset destroy claude-allowed-domains 2>/dev/null || true
	if ! ipset create claude-allowed-domains hash:net; then
		warning "Failed to create ipset, using direct rules"
		IPSET_AVAILABLE=false
	fi
fi

# Basic connectivity rules
log "Setting up basic connectivity..."
execute_cmd "iptables -A CLAUDE_INPUT -i lo -j ACCEPT" "Localhost input"
execute_cmd "iptables -A CLAUDE_OUTPUT -o lo -j ACCEPT" "Localhost output"
execute_cmd "iptables -A CLAUDE_OUTPUT -p udp --dport 53 -j ACCEPT" "DNS out UDP"
execute_cmd "iptables -A CLAUDE_OUTPUT -p tcp --dport 53 -j ACCEPT" "DNS out TCP"
execute_cmd "iptables -A CLAUDE_INPUT -p udp --sport 53 -j ACCEPT" "DNS in UDP"
execute_cmd "iptables -A CLAUDE_INPUT -p tcp --sport 53 -j ACCEPT" "DNS in TCP"
execute_cmd "iptables -A CLAUDE_OUTPUT -p tcp --dport 22 -j ACCEPT" "SSH out"

# Move these rules just before the final DROP rule
if ! iptables -A CLAUDE_INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; then
	if ! iptables -A CLAUDE_INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; then
		warning "Failed to add ESTABLISHED,RELATED rule for input"
	fi
fi

if ! iptables -A CLAUDE_OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; then
	if ! iptables -A CLAUDE_OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; then
		warning "Failed to add ESTABLISHED,RELATED rule for output"
	fi
fi

# Initialize IPv6 chains if enabled
if [ "$IPV6_ENABLED" = true ]; then
	create_ipv6_chains
fi

# Add GitHub IPs that we fetched earlier
log "Adding GitHub IPs to allowed list..."
if [ -n "$gh_ranges" ]; then
	while read -r cidr; do
		[[ -n "$cidr" ]] && add_ip "$cidr"
	done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' 2>/dev/null || echo "")
fi

# Add important domains
log "Adding important domains..."
for domain in "registry.npmjs.org" "api.anthropic.com" "sentry.io" "statsig.anthropic.com" \
	"cursor.blob.core.windows.net" "statsig.com" "marketplace.visualstudio.com" "update.code.visualstudio.com" \
	"vscode.blob.core.windows.net" "api.github.com"; do
	add_domain "$domain"
done

# Host network configuration
log "Configuring host network..."
HOST_IP=$(ip route | grep default | awk '{print $3}' || hostname -I | awk '{print $1}')
if [ -n "$HOST_IP" ]; then
	log "Host IP: $HOST_IP"
	IFS='.' read -r a b c d <<<"$HOST_IP"
	HOST_NETWORK="${a}.${b}.${c}.0/24"

	execute_cmd "iptables -A CLAUDE_INPUT -s $HOST_NETWORK -j ACCEPT" "Host network IN"
	execute_cmd "iptables -A CLAUDE_OUTPUT -d $HOST_NETWORK -j ACCEPT" "Host network OUT"

	# Default gateway
	DEFAULT_GATEWAY=$(ip route | grep default | awk '{print $3}')
	if [ -n "$DEFAULT_GATEWAY" ]; then
		execute_cmd "iptables -A CLAUDE_INPUT -s $DEFAULT_GATEWAY -j ACCEPT" "Gateway IN"
		execute_cmd "iptables -A CLAUDE_OUTPUT -d $DEFAULT_GATEWAY -j ACCEPT" "Gateway OUT"
	fi
fi

# Interface networks
log "Adding interface networks..."
for iface in $(ip -o link show | grep -v lo | awk -F': ' '{print $2}'); do
	add_interface "$iface"
done

# ipset rule (if available)
if [ "$IPSET_AVAILABLE" = true ]; then
	iptables -A CLAUDE_OUTPUT -m set --match-set claude-allowed-domains dst -j ACCEPT 2>/dev/null || warning "Failed to add ipset rule"
fi

# Optional logging - place before the DROP rule
iptables -A CLAUDE_OUTPUT -m limit --limit 5/min -j LOG --log-prefix "CLAUDE_FIREWALL: " --log-level 4 2>/dev/null || warning "Failed to add logging rule"
if [ "$IPV6_ENABLED" = true ]; then
	ip6tables -A CLAUDE_OUTPUT -m limit --limit 5/min -j LOG --log-prefix "CLAUDE_FIREWALL_IPV6: " --log-level 4 2>/dev/null || true
fi

# Add explicit DROP rules for non-allowed web traffic
iptables -A CLAUDE_OUTPUT -p tcp --dport 80 -j DROP 2>/dev/null || true
iptables -A CLAUDE_OUTPUT -p tcp --dport 443 -j DROP 2>/dev/null || true

# Final drop rule
log "Adding default drop rule..."
if ! iptables -A CLAUDE_OUTPUT -j DROP 2>/dev/null; then
	if ! iptables -A CLAUDE_OUTPUT -j REJECT 2>/dev/null; then
		error "Failed to add DROP or REJECT rule"
		exit 1
	fi
fi

if [ "$IPV6_ENABLED" = true ]; then
	ip6tables -A CLAUDE_OUTPUT -j DROP 2>/dev/null || ip6tables -A CLAUDE_OUTPUT -j REJECT 2>/dev/null || true
fi

# Verification
log "Verifying configuration..."
test_conn "api.github.com" true || warning "Verification failed for api.github.com"
test_conn "marketplace.visualstudio.com" true || warning "Verification failed for marketplace.visualstudio.com"
test_conn "example.com" false || warning "Verification failed for example.com"

log "Claude firewall configuration finished"
exit 0
