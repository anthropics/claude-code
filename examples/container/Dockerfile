FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    curl \
    less \
    jq \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Remove the default ubuntu user (UID 1000) so --passwd-entry can set the
# correct home directory for the host user. Without this, SSH resolves ~ from
# /home/ubuntu instead of $HOME, breaking ~/.ssh/config.
RUN userdel ubuntu && rm -rf /home/ubuntu

# Host tools (claude, gh) are mounted read-only at runtime.
# No default entrypoint — the wrapper script specifies the command.
