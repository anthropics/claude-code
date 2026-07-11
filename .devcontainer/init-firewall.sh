#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

IPTABLES_AVAILABLE=false
IP6TABLES_AVAILABLE=false

fail_close_family() {
  local firewall_command="$1"

  "$firewall_command" -P OUTPUT DROP
  "$firewall_command" -P INPUT DROP
  "$firewall_command" -P FORWARD DROP
  "$firewall_command" -F
}

fail_closed_on_error() {
  local status=$?
  trap - EXIT
  if [[ $status -eq 0 ]]; then
    return
  fi

  # Best-effort cleanup must not replace the original failure status. Handle
  # each available protocol family independently so a missing or broken tool
  # cannot prevent the other family from being closed.
  set +e
  if [[ "$IPTABLES_AVAILABLE" = true ]]; then
    fail_close_family iptables
  fi
  if [[ "$IP6TABLES_AVAILABLE" = true ]]; then
    fail_close_family ip6tables
  fi
  echo "ERROR: Firewall initialization failed; available filter families reset to DROP" >&2
  exit "$status"
}
trap fail_closed_on_error EXIT

# Discover both policy tools before initializing either family. A missing tool
# is still a fatal configuration error, but the EXIT trap closes whichever
# family is available before preserving that error status.
missing_policy_tool=false
for command_name in iptables ip6tables; do
  if command -v "$command_name" >/dev/null; then
    case "$command_name" in
      iptables) IPTABLES_AVAILABLE=true ;;
      ip6tables) IP6TABLES_AVAILABLE=true ;;
    esac
  else
    echo "ERROR: Required command is unavailable: $command_name" >&2
    missing_policy_tool=true
  fi
done
if [[ "$missing_policy_tool" = true ]]; then
  exit 1
fi

# Close egress before reading remote configuration or flushing rules. These
# policies remain DROP if any subsequent operation fails.
iptables -P OUTPUT DROP
iptables -P INPUT DROP
iptables -P FORWARD DROP
ip6tables -P OUTPUT DROP
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP

# Check all remaining dependencies only after egress is closed. A missing
# parser, resolver, or HTTP client therefore cannot leave an ACCEPT policy.
required_commands=(iptables-save ipset curl jq dig ip)
for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null || {
    echo "ERROR: Required command is unavailable: $command_name" >&2
    exit 1
  }
done

# Preserve only Docker's internal IPv4 DNS NAT rules.
DOCKER_DNS_RULES=$(iptables-save -t nat | grep '127\.0\.0\.11' || true)

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ip6tables -F
ip6tables -X
ip6tables -t mangle -F
ip6tables -t mangle -X

for set_name in allowed-domains-v4 allowed-domains-v6 github-ranges-v4 github-ranges-v6; do
  ipset destroy "$set_name" 2>/dev/null || true
done

if [[ -n "$DOCKER_DNS_RULES" ]]; then
  echo "Restoring Docker DNS rules..."
  iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
  iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
  printf '%s\n' "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

ipset create allowed-domains-v4 hash:net family inet
ipset create allowed-domains-v6 hash:net family inet6
ipset create github-ranges-v4 hash:net family inet
ipset create github-ranges-v6 hash:net family inet6

# Base rules are symmetric. Only replies to permitted outbound connections are
# accepted; pre-existing arbitrary outbound connections are not grandfathered.
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT -i lo -j ACCEPT
ip6tables -A OUTPUT -o lo -j ACCEPT
ip6tables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# ICMPv6 is part of IPv6 itself: types 1-4 carry error/Path MTU information,
# while 133-136 provide router and neighbor discovery. Dropping these messages
# can make an otherwise permitted IPv6 connection fail before TCP is usable.
for icmpv6_type in 1 2 3 4 133 134 135 136; do
  ip6tables -A INPUT -p ipv6-icmp --icmpv6-type "$icmpv6_type" -j ACCEPT
  ip6tables -A OUTPUT -p ipv6-icmp --icmpv6-type "$icmpv6_type" -j ACCEPT
done

# Permit DNS only to the exact resolvers configured for this container.
DNS_SERVERS=$(awk '/^nameserver[[:space:]]+/ { print $2 }' /etc/resolv.conf)
if [[ -z "$DNS_SERVERS" ]]; then
  echo "ERROR: No DNS resolver configured" >&2
  exit 1
fi

while IFS= read -r resolver; do
  [[ -n "$resolver" ]] || continue
  if [[ "$resolver" = *:* ]]; then
    ip6tables -A OUTPUT -p udp -d "$resolver" --dport 53 -j ACCEPT
    ip6tables -A OUTPUT -p tcp -d "$resolver" --dport 53 -j ACCEPT
  else
    iptables -A OUTPUT -p udp -d "$resolver" --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp -d "$resolver" --dport 53 -j ACCEPT
  fi
done <<< "$DNS_SERVERS"

add_domain_addresses() {
  local domain="$1"
  local found=0
  local address

  echo "Resolving $domain..."
  while IFS= read -r address; do
    [[ -n "$address" ]] || continue
    ipset add allowed-domains-v4 "$address" -exist
    found=1
  done < <(dig +noall +answer A "$domain" | awk '$4 == "A" { print $5 }')

  while IFS= read -r address; do
    [[ -n "$address" ]] || continue
    ipset add allowed-domains-v6 "$address" -exist
    found=1
  done < <(dig +noall +answer AAAA "$domain" | awk '$4 == "AAAA" { print $5 }')

  if [[ $found -eq 0 ]]; then
    echo "ERROR: Failed to resolve $domain" >&2
    return 1
  fi
}

allowed_domains=(
  api.github.com
  registry.npmjs.org
  api.anthropic.com
  claude.ai
  platform.claude.com
  downloads.claude.ai
  raw.githubusercontent.com
  sentry.io
  statsig.com
  marketplace.visualstudio.com
  vscode.blob.core.windows.net
  update.code.visualstudio.com
)

for domain in "${allowed_domains[@]}"; do
  add_domain_addresses "$domain"
done

# Domain allowlists are limited to web traffic. In particular, resolving an
# allowed name does not grant arbitrary protocols to the resulting address.
iptables -A OUTPUT -p tcp -m multiport --dports 80,443 \
  -m set --match-set allowed-domains-v4 dst -j ACCEPT
ip6tables -A OUTPUT -p tcp -m multiport --dports 80,443 \
  -m set --match-set allowed-domains-v6 dst -j ACCEPT

echo "Fetching GitHub IP ranges..."
if ! GITHUB_META=$(curl --proto '=https' --tlsv1.2 -fsS \
  --connect-timeout 5 --max-time 15 https://api.github.com/meta); then
  echo "ERROR: Failed to fetch GitHub IP ranges" >&2
  exit 1
fi

if ! printf '%s' "$GITHUB_META" | jq -e '
  .web and .api and .git
  and ([.web[], .api[], .git[]] | all(type == "string"))
' >/dev/null; then
  echo "ERROR: GitHub API response is missing valid web/api/git ranges" >&2
  exit 1
fi

if ! GITHUB_ALL_RANGES=$(printf '%s' "$GITHUB_META" | \
  jq -er '[.web[], .api[], .git[]] | unique[]'); then
  echo "ERROR: Failed to parse GitHub IP ranges" >&2
  exit 1
fi

while IFS= read -r cidr; do
  [[ -n "$cidr" ]] || continue
  echo "Adding GitHub range $cidr"
  if [[ "$cidr" = *:* ]]; then
    ipset add allowed-domains-v6 "$cidr" -exist
  else
    ipset add allowed-domains-v4 "$cidr" -exist
  fi
done <<< "$GITHUB_ALL_RANGES"

if ! GITHUB_GIT_RANGES=$(printf '%s' "$GITHUB_META" | jq -er '.git | unique[]'); then
  echo "ERROR: Failed to parse GitHub Git ranges" >&2
  exit 1
fi

while IFS= read -r cidr; do
  [[ -n "$cidr" ]] || continue
  if [[ "$cidr" = *:* ]]; then
    ipset add github-ranges-v6 "$cidr" -exist
  else
    ipset add github-ranges-v4 "$cidr" -exist
  fi
done <<< "$GITHUB_GIT_RANGES"

# SSH is only permitted to GitHub's published web/api/git ranges.
iptables -A OUTPUT -p tcp --dport 22 \
  -m set --match-set github-ranges-v4 dst -j ACCEPT
ip6tables -A OUTPUT -p tcp --dport 22 \
  -m set --match-set github-ranges-v6 dst -j ACCEPT

# Allow TCP connections in both directions with the exact container host
# gateway. This preserves host-to-container access for forwarded development
# servers without trusting every peer on the host network's /24.
HOST_IPV4=$(ip -4 route show default | awk '/^default/ { print $3; exit }')
if [[ -z "$HOST_IPV4" ]]; then
  echo "ERROR: Failed to detect the IPv4 host gateway" >&2
  exit 1
fi
echo "Host gateway detected as: $HOST_IPV4"
iptables -A OUTPUT -p tcp -d "$HOST_IPV4/32" -j ACCEPT
iptables -A INPUT -p tcp -s "$HOST_IPV4/32" -j ACCEPT

HOST_IPV6=$(ip -6 route show default | awk '/^default/ { print $3; exit }')
if [[ -n "$HOST_IPV6" ]]; then
  echo "IPv6 host gateway detected as: $HOST_IPV6"
  ip6tables -A OUTPUT -p tcp -d "$HOST_IPV6/128" -j ACCEPT
  ip6tables -A INPUT -p tcp -s "$HOST_IPV6/128" -j ACCEPT
fi

iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited
ip6tables -A OUTPUT -j REJECT

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --proto '=https' --connect-timeout 5 --max-time 10 \
  https://example.com >/dev/null 2>&1; then
  echo "ERROR: Firewall verification failed: example.com was reachable" >&2
  exit 1
fi

if ! curl --proto '=https' --connect-timeout 5 --max-time 10 \
  https://api.github.com/zen >/dev/null 2>&1; then
  echo "ERROR: Firewall verification failed: api.github.com was unreachable" >&2
  exit 1
fi

echo "Firewall verification passed"
trap - EXIT
