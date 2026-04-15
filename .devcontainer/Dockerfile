FROM node:20

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools, Python, and iptables/ipset
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
  ca-certificates \
  curl \
  # Python development
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  # Build dependencies for Python packages (Pillow, psycopg2, etc.)
  build-essential \
  libpq-dev \
  libjpeg-dev \
  libffi-dev \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv (Python tool runner, required by serena MCP and similar tools).
# Installed via pip from PyPI (allowed by firewall) into system site-packages.
RUN pip3 install --break-system-packages --no-cache-dir uv

# Install Docker CLI and Docker Compose plugin
RUN install -m 0755 -d /etc/apt/keyrings && \
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
  chmod a+r /etc/apt/keyrings/docker.asc && \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
  apt-get update && \
  apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

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

# zsh-in-docker の -x が en_US.UTF-8 を .zshrc に書き込むが、このイメージには
# 当該ロケールが未生成のため bash 起動時に warning が出る。該当行を削除する。
RUN sed -i "/^export LANG='en_US.UTF-8'$/d; /^export LANGUAGE='en_US:en'$/d; /^export LC_ALL='en_US.UTF-8'$/d" /home/node/.zshrc

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Install curated ECC assets into /home/node/.claude/.
# At runtime the named-volume mount at /home/node/.claude/ is seeded from this
# path on first container creation (Docker copies image content into empty
# volumes). Existing volumes keep their state — no re-seeding. Same lifecycle
# as the `npm install -g @anthropic-ai/claude-code` above: done once at image
# build, no postCreate logic needed.
COPY --chown=node:node claude-whitelist.txt claude-hooks-keep.txt claude-mcps-keep.txt install-ecc-assets.sh /tmp/
RUN bash /tmp/install-ecc-assets.sh && \
    rm -f /tmp/claude-whitelist.txt /tmp/claude-hooks-keep.txt /tmp/claude-mcps-keep.txt /tmp/install-ecc-assets.sh

# Register serena MCP server at user scope. Writes to /home/node/.claude/.claude.json
# which is on the named volume — seeded into fresh volumes on first container start.
# Uses `ide-assistant` context + explicit --project so LSP features target /workspace.
RUN claude mcp add --scope user serena -- \
    uvx --from git+https://github.com/oraios/serena \
    serena start-mcp-server --context ide-assistant --project /workspace

# Seed Claude Code user settings with Stop/Notification hooks that emit BEL
# (paired with VS Code's terminal.integrated.enableBell=true). Goes onto the
# named volume via seeding on first container start.
COPY --chown=node:node claude-settings.json /home/node/.claude/settings.json


# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
# Copy setup script for project initialization
COPY setup-project.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  chmod +x /usr/local/bin/setup-project.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/bin/docker, /usr/libexec/docker/cli-plugins/docker-compose" >> /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/sbin/groupmod, /usr/sbin/usermod" >> /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall && \
  # Create docker group (actual GID will be fixed at start time to match host socket)
  groupadd -f docker && usermod -aG docker node
USER node

