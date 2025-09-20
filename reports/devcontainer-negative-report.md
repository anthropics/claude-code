# Negative Findings Report: Dev Containers Log (September 1, 2025)

## 1. Docker connection instability (observed then recovered)

- Initial failure when VS Code attempted to contact the Docker daemon:
  - `error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/version": open //./pipe/dockerDesktopLinuxEngine: Le fichier spécifié est introuvable.`
  - Corresponding failure: `docker ps ...` returned exit code 1 because the daemon was not reachable.

- Later in the same run the Docker client reported the server details (Docker Desktop 4.44.2) and the Server object was present in `docker version` output, indicating the daemon became available again.

## 2. Docker command failures (transient)

- `docker ps` failed early with exit code 1 while the daemon pipe was not available.
- Subsequent docker commands succeeded once the Docker Desktop/WSL2 engine became reachable.

## 3. Image fetch and pull outcome

- An initial attempt to read the image manifest reported: `No manifest found for docker.io/library/node:20`.
- Immediately after, the CLI ran `docker pull node:20` and the pull completed successfully; the log shows all layers downloaded and:
  - `Digest: sha256:572a90df10a58ebb7d3f223d661d964a6c2383a9c2b5763162b4f631c53dc56a`
  - `Status: Downloaded newer image for node:20`

## 4. Delays and repeated attempts

- The devcontainer flow retried docker operations multiple times while the client transitioned from an unreachable to a reachable Docker server. That produced additional latency and repeated CLI calls.

## 5. Final status

- Docker daemon became available during the run (Docker Desktop + WSL2), and the required `node:20` image was pulled successfully. The initial connectivity errors were transient but caused the earlier failures and delays.

---

### Recommendations (short, actionable)

- Confirm Docker Desktop is running and that the Docker context is set to the expected one (the logs show `Context":"desktop-linux").`
- If you see the pipe-not-found error again on Windows, try restarting Docker Desktop or switching the Docker context back to `desktop-linux` / WSL2 and wait until the Docker daemon is fully healthy before reopening the devcontainer.
- Ensure WSL2 integration is enabled for Docker Desktop and that the `docker` CLI can talk to the `dockerDesktopLinuxEngine` pipe from PowerShell (run `docker version --format "{{json .}}"` to verify client+server).
- If manifest errors recur, retry `docker pull node:20` manually; if the registry reports a missing manifest, test with another tag (e.g., `node:20-slim` or `node:18`) to rule out transient registry issues.
- Re-run the devcontainer once Docker is stable; the log shows the flow completes successfully after the daemon recovered.

---

Summary: initial Docker pipe/connectivity error caused early failures, Docker server recovered, and the Node image was pulled successfully; follow the recommendations above to avoid repeats.

## Verification performed (local PowerShell check)

- Action: ran a PowerShell check that inspected `docker version` and attempted restart/start if the server was missing.
- Result (captured output):
  - Script reported: `SERVER_OK` indicating the Docker server is reachable.
  - `docker version` JSON showed a non-null `Server` object with `Platform.Name: "Docker Desktop 4.44.2 (202017)"` and `Version: "28.3.2"`.
  - Kernel/OS details indicate WSL2: `KernelVersion: "6.6.87.2-microsoft-standard-WSL2"`.

- Interpretation: Docker daemon is currently running and reachable from PowerShell using the `desktop-linux` context (WSL2). The earlier pipe-not-found errors were transient during the devcontainer start but no longer present in this verification.

---

Requirements coverage:

- Update report with run outcome and verification: Done.
- Provide clear next action (restart Docker if error recurs): Done.

*** End of report
