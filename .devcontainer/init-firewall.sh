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

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=""
for attempt in 1 2 3; do
    gh_ranges=$(curl -s --retry 2 --connect-timeout 10 https://api.github.com/meta)
    if [ -n "$gh_ranges" ] && echo "$gh_ranges" | jq -e '.web' >/dev/null 2>&1; then
        break
    fi
    echo "Attempt $attempt failed, retrying..."
    sleep 2
done
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges after 3 attempts"
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
    ipset add allowed-domains "$cidr" -exist
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Fetch AWS IP ranges and allow ap-northeast-1 + GLOBAL service endpoints.
# Required so the bundled `aws` CLI can reach STS / EC2 / S3 / ECS / ECR /
# IAM / Route53 / CloudFront / etc. for terraform plan/apply and ECS ops.
# Source: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
#
# AWS_REGIONS_ALLOWED can be overridden at firewall-init time by setting
# the env var (comma-separated). Defaults to ap-northeast-1 (this project's
# stg/prod region) plus GLOBAL (region-less services like IAM / Route53).
AWS_REGIONS_ALLOWED="${AWS_REGIONS_ALLOWED:-ap-northeast-1,GLOBAL}"
echo "Fetching AWS IP ranges (regions: ${AWS_REGIONS_ALLOWED})..."
aws_ranges=""
for attempt in 1 2 3; do
    aws_ranges=$(curl -s --retry 2 --connect-timeout 10 https://ip-ranges.amazonaws.com/ip-ranges.json)
    if [ -n "$aws_ranges" ] && echo "$aws_ranges" | jq -e '.prefixes' >/dev/null 2>&1; then
        break
    fi
    echo "Attempt $attempt failed, retrying..."
    sleep 2
done
if [ -z "$aws_ranges" ]; then
    echo "WARNING: Failed to fetch AWS IP ranges; aws CLI calls will be blocked"
else
    region_filter=$(echo "$AWS_REGIONS_ALLOWED" | tr ',' '\n' | jq -R . | jq -s .)
    while read -r cidr; do
        if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
            continue
        fi
        ipset add allowed-domains "$cidr" -exist
    done < <(echo "$aws_ranges" | jq --argjson r "$region_filter" -r \
        '.prefixes[] | select(.region as $reg | $r | index($reg)) | .ip_prefix' | aggregate -q)
    aws_count=$(echo "$aws_ranges" | jq --argjson r "$region_filter" \
        '[.prefixes[] | select(.region as $reg | $r | index($reg))] | length')
    echo "Added $aws_count AWS prefixes for regions: ${AWS_REGIONS_ALLOWED}"
fi

# Resolve and add other allowed domains
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "sentry.io" \
    "statsig.anthropic.com" \
    "statsig.com" \
    "marketplace.visualstudio.com" \
    "vscode.blob.core.windows.net" \
    "update.code.visualstudio.com" \
    "registry-1.docker.io" \
    "auth.docker.io" \
    "production.cloudflare.docker.com" \
    "docker.io" \
    "ghcr.io" \
    "pkg-containers.githubusercontent.com" \
    "objects.githubusercontent.com" \
    "pypi.org" \
    "files.pythonhosted.org"; do
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
        ipset add allowed-domains "$ip" -exist
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

# Allow Docker bridge networks (172.16.0.0/12) for container-to-container communication
iptables -A INPUT -s 172.16.0.0/12 -j ACCEPT
iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT

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

# Verify AWS STS reachability (only if AWS CLI is installed and ranges were
# loaded). STS is region-prefixed; ap-northeast-1 endpoint is the canonical
# probe target for this project.
if command -v aws >/dev/null 2>&1; then
    if curl --connect-timeout 5 -sI https://sts.ap-northeast-1.amazonaws.com >/dev/null 2>&1; then
        echo "Firewall verification passed - able to reach AWS STS (ap-northeast-1)"
    else
        echo "WARNING: aws CLI is installed but STS endpoint is unreachable"
    fi
fi
