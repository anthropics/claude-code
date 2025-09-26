Quick devcontainer note

Before opening this repository in a devcontainer, please confirm the following on your Windows host:

- Docker Desktop is running and healthy.
- Docker context is set to the WSL2 / "desktop-linux" context (if you use WSL2 integration).
- WSL2 integration is enabled for the distribution you use.

If you see a Docker pipe/connection error when VS Code starts the devcontainer, restart Docker Desktop and wait until `docker version` shows a non-null `Server` object before re-opening the devcontainer.

Related report: `reports/devcontainer-negative-report.md` contains a run log and recommendations.
