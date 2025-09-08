FROM node:22-slim

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=1.0.108
ARG ENABLE_EXPERIMENTAL_FEATURES=true
ARG ENABLE_ALPHA_FEATURES=true
ARG ENABLE_BETA_FEATURES=true
ARG INSTALL_ADVANCED_TOOLS=true
ARG NODE_ENV=development

# Install comprehensive development tools and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  # Basic tools
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
  # Network and system tools
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  # JSON and text processing
  jq \
  yq \
  # Editors and productivity
  nano \
  vim \
  neovim \
  tmux \
  htop \
  tree \
  # Development tools
  curl \
  wget \
  build-essential \
  python3 \
  python3-pip \
  # Advanced tools (conditional on INSTALL_ADVANCED_TOOLS)
  && if [ "$INSTALL_ADVANCED_TOOLS" = "true" ]; then \
    apt-get install -y --no-install-recommends \
      # Code analysis tools
      shellcheck \
      # Container tools
      docker.io \
      # Monitoring tools
      strace \
      lsof \
      tcpdump \
      # Performance tools
      perf-tools-unstable \
      # Modern CLI replacements
      ripgrep \
      fd-find \
      bat \
      exa \
      # Git enhancements
      git-lfs \
      git-extras; \
  fi \
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

# Install modern CLI tools (if advanced tools enabled)
RUN if [ "$INSTALL_ADVANCED_TOOLS" = "true" ]; then \
  # Install starship prompt
  curl -sS https://starship.rs/install.sh | sh -s -- --yes && \
  # Install lazygit
  LAZYGIT_VERSION=$(curl -s "https://api.github.com/repos/jesseduffield/lazygit/releases/latest" | grep -Po '"tag_name": "v\K[^"]*') && \
  curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/latest/download/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" && \
  tar xf lazygit.tar.gz lazygit && \
  sudo install lazygit /usr/local/bin && \
  rm lazygit* && \
  # Install GitHub CLI extensions
  gh extension install github/gh-copilot && \
  gh extension install cli/gh-repo; \
fi

# Set up non-root user
USER node

# Install global packages with experimental features enabled
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Enable experimental Node.js features
ENV NODE_OPTIONS="--max-old-space-size=8192 --experimental-modules --experimental-specifier-resolution=node"
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# Install latest npm and additional global packages
RUN npm install -g npm@latest && \
  npm install -g \
    typescript@beta \
    tsx \
    nodemon \
    npm-check-updates \
    prettier@alpha \
    eslint@beta \
    @typescript-eslint/parser@beta \
    @typescript-eslint/eslint-plugin@beta

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual (with experimental options)
ENV EDITOR="nano"
ENV VISUAL="nano"
ENV GIT_EDITOR="nano"

# Enable experimental Git features
RUN git config --global init.defaultBranch main && \
  git config --global pull.rebase true && \
  git config --global fetch.prune true && \
  git config --global diff.colorMoved zebra && \
  git config --global merge.conflictstyle diff3 && \
  git config --global core.pager delta && \
  git config --global interactive.diffFilter "delta --color-only" && \
  git config --global delta.navigate true && \
  git config --global delta.light false && \
  git config --global delta.side-by-side true && \
  git config --global delta.line-numbers true

# Advanced zsh configuration with experimental features
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -p docker \
  -p node \
  -p npm \
  -p command-not-found \
  -p zsh-autosuggestions \
  -p zsh-syntax-highlighting \
  -p history-substring-search \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -a "export FZF_DEFAULT_OPTS='--height 40% --reverse --border'" \
  -a "export HISTSIZE=50000" \
  -a "export SAVEHIST=50000" \
  -a "setopt HIST_IGNORE_DUPS" \
  -a "setopt HIST_FIND_NO_DUPS" \
  -a "setopt HIST_REDUCE_BLANKS" \
  -a "alias ll='ls -alF'" \
  -a "alias la='ls -A'" \
  -a "alias l='ls -CF'" \
  -a "alias ..='cd ..'" \
  -a "alias ...='cd ../..'" \
  -a "alias grep='grep --color=auto'" \
  -a "alias fgrep='fgrep --color=auto'" \
  -a "alias egrep='egrep --color=auto'" \
  -x

# Initialize starship prompt if advanced tools are enabled
RUN if [ "$INSTALL_ADVANCED_TOOLS" = "true" ]; then \
  echo 'eval "$(starship init zsh)"' >> ~/.zshrc; \
fi

# Install Claude with experimental features and configuration
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Create Claude configuration directory and set experimental options
RUN mkdir -p ~/.claude && \
  echo '{ \
  "experimental": { \
    "enabled": '${ENABLE_EXPERIMENTAL_FEATURES}', \
    "features": [ \
      "advanced-code-analysis", \
      "multi-file-editing", \
      "intelligent-suggestions", \
      "context-aware-completions", \
      "advanced-debugging", \
      "performance-optimization", \
      "security-analysis" \
    ] \
  }, \
  "alpha": { \
    "enabled": '${ENABLE_ALPHA_FEATURES}', \
    "features": [ \
      "ai-powered-refactoring", \
      "predictive-coding", \
      "smart-error-detection", \
      "automated-testing", \
      "code-quality-analysis" \
    ] \
  }, \
  "beta": { \
    "enabled": '${ENABLE_BETA_FEATURES}', \
    "features": [ \
      "enhanced-git-integration", \
      "collaborative-editing", \
      "advanced-search", \
      "smart-file-navigation", \
      "performance-monitoring" \
    ] \
  }, \
  "performance": { \
    "maxMemory": "8192mb", \
    "parallelProcessing": true, \
    "cacheEnabled": true, \
    "optimizationLevel": "aggressive" \
  }, \
  "editor": { \
    "autoSave": true, \
    "smartIndentation": true, \
    "syntaxHighlighting": "enhanced", \
    "codeCompletion": "advanced" \
  } \
  }' > ~/.claude/config.json


# Copy advanced configuration files
COPY advanced-config.json /home/node/.claude/
COPY advanced-env.sh /home/node/

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  chmod +x /home/node/advanced-env.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall

# Integrate advanced environment into shell startup
USER node
RUN echo 'source ~/advanced-env.sh' >> ~/.zshrc && \
  echo 'source ~/advanced-env.sh' >> ~/.bashrc
