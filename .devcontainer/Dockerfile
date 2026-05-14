FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}


# Copy and set up firewall script
COPY .devcontainer/init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
# =============================================================================
# FNBA OVERLAY — append the block below to the END of .devcontainer/Dockerfile.
# Append-only on purpose: leaves the upstream content untouched so future
# rebases from anthropics/claude-code stay merge-conflict-free.
# =============================================================================

# --- FNBA overlay begin -------------------------------------------------------
# Adds: docker CLI + compose v2 plugin, gh CLI (if upstream omitted it),
# and remaps the existing `node` user to match the WSL host user so the
# homebase bind mount has correct ownership.
#
# NO language runtimes are added here (no JDK, no Maven, no Node-22, no pnpm).
# Each repo (escrow-web-services, fnba-escrow-webapp, ...) provides its own
# runtime via its own docker-compose.local.yml as a sibling container on the
# WSL Docker daemon.

ARG HOST_UID=1000
ARG HOST_GID=1000
ARG HOST_USER=node

USER root

# docker CLI + compose v2 plugin (client only — no daemon). Lets this
# container drive sibling stacks via the mounted host /var/run/docker.sock.
RUN install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/debian $(. /etc/os-release; echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      docker-ce-cli \
      docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

# gh CLI — upstream may already include it; this is idempotent-ish.
RUN if ! command -v gh >/dev/null 2>&1; then \
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
      && chmod a+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
      && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
      && apt-get update \
      && apt-get install -y --no-install-recommends gh \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# Remap the upstream-provided `node` user to match the WSL host identity.
# This is what makes the ${HOST_HOME}:/home/${HOST_USER} bind mount work
# without permission churn: files created in the container come out owned
# by the same uid/gid as the host user.
RUN set -eux; \
    # Rename group first (must exist before usermod -g)
    groupmod -n "${HOST_USER}" node || true; \
    groupmod -g "${HOST_GID}" "${HOST_USER}"; \
    # Rename user and move its home dir
    usermod  -l "${HOST_USER}" -d "/home/${HOST_USER}" -m node; \
    usermod  -u "${HOST_UID}" -g "${HOST_GID}" "${HOST_USER}"; \
    # Add to docker group so the mounted docker.sock is usable without sudo.
    # GID 999 is the conventional docker group GID on Debian; if the socket's
    # actual GID differs at runtime, entrypoint.sh in the consumer's setup
    # can `chgrp` it. For the POC, this is fine.
    groupadd -f -g 999 docker || true; \
    usermod  -aG docker "${HOST_USER}"

# Bake the first-time bootstrap bundle into the image so it's available
# even when homebase is empty on first run.
COPY fnba-bootstrap/ /opt/fnba-bootstrap/
RUN chmod +x /opt/fnba-bootstrap/first-time-setup.sh

USER ${HOST_USER}
# --- FNBA overlay end ---------------------------------------------------------
