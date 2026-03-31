"""Deploy listener to remote hosts via SSH or kubectl, with health-check verification."""

import logging
import shlex
import subprocess
import tempfile
import time
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

LISTENER_SCRIPT = Path(__file__).parent / "listener.py"

HEALTH_CHECK_RETRIES = 6
HEALTH_CHECK_INTERVAL = 2


def _verify_health(host: str, port: int, retries: int = HEALTH_CHECK_RETRIES) -> dict:
    """Poll /health endpoint until the listener responds or retries are exhausted."""
    url = f"http://{host}:{port}/health"
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Health check passed (attempt %d/%d): %s", attempt, retries, data)
                return data
        except requests.ConnectionError:
            logger.info("Health check attempt %d/%d — listener not ready yet", attempt, retries)
        except Exception:
            logger.warning("Health check attempt %d/%d failed", attempt, retries, exc_info=True)
        time.sleep(HEALTH_CHECK_INTERVAL)

    raise RuntimeError(
        f"Health check failed after {retries} attempts at {url}. "
        f"Check remote logs: /tmp/claude-listener-{port}.log"
    )


def deploy_via_ssh(
    host: str,
    remote_cwd: str,
    port: int = 9100,
    token: str = "",
    user: str = "",
    key_file: str = "",
    verify_health: bool = True,
) -> str:
    """Deploy and start listener on a remote host via SSH.

    Returns "host:port" on success.
    Raises RuntimeError on failure.
    """
    ssh_target = f"{user}@{host}" if user else host
    ssh_opts = ["-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]
    if key_file:
        ssh_opts.extend(["-i", key_file])

    listener_content = LISTENER_SCRIPT.read_text()
    remote_path = f"{remote_cwd}/.claude-listener.py"

    # Step 1: Ensure remote directory exists
    cmd_mkdir = ["ssh"] + ssh_opts + [ssh_target, f"mkdir -p {shlex.quote(remote_cwd)}"]
    proc = subprocess.run(cmd_mkdir, capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"SSH mkdir failed: {proc.stderr.decode()}")

    # Step 2: Copy listener script
    cmd_copy = ["ssh"] + ssh_opts + [ssh_target, f"cat > {shlex.quote(remote_path)}"]
    proc = subprocess.run(cmd_copy, input=listener_content.encode(), capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"SSH copy failed: {proc.stderr.decode()}")

    # Step 3: Kill any existing listener on the same port
    kill_cmd = f"pkill -f 'LISTENER_PORT={port}.*claude-listener' 2>/dev/null; sleep 1"
    subprocess.run(
        ["ssh"] + ssh_opts + [ssh_target, kill_cmd],
        capture_output=True, timeout=15,
    )

    # Step 4: Start listener
    env_vars = f"LISTENER_CWD={shlex.quote(remote_cwd)} LISTENER_PORT={port}"
    if token:
        env_vars += f" LISTENER_TOKEN={shlex.quote(token)}"

    start_script = (
        f"cd {shlex.quote(remote_cwd)} && "
        f"nohup {env_vars} python3 {shlex.quote(remote_path)} "
        f"> /tmp/claude-listener-{port}.log 2>&1 &"
    )
    cmd_start = ["ssh"] + ssh_opts + [ssh_target, start_script]
    proc = subprocess.run(cmd_start, capture_output=True, timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(f"SSH start failed: {proc.stderr.decode()}")

    logger.info("Listener deployed to %s:%d (cwd=%s)", host, port, remote_cwd)

    # Step 5: Health check
    if verify_health:
        _verify_health(host, port)

    return f"{host}:{port}"


def deploy_via_kubectl(
    pod: str,
    namespace: str,
    container: str = "",
    remote_cwd: str = "/workspace",
    port: int = 9100,
    token: str = "",
    kubeconfig: str = "",
    verify_health: bool = True,
) -> str:
    """Deploy and start listener in a Kubernetes pod.

    Returns "pod.namespace:port" on success.
    Raises RuntimeError on failure.
    """
    kubectl = ["kubectl"]
    if kubeconfig:
        kubectl.extend(["--kubeconfig", kubeconfig])

    exec_base = kubectl + ["exec", pod, "-n", namespace]
    if container:
        exec_base.extend(["-c", container])

    listener_content = LISTENER_SCRIPT.read_text()
    remote_path = f"{remote_cwd}/.claude-listener.py"

    # Step 1: Ensure remote directory exists
    mkdir_cmd = exec_base + ["--", "mkdir", "-p", remote_cwd]
    proc = subprocess.run(mkdir_cmd, capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"kubectl mkdir failed: {proc.stderr.decode()}")

    # Step 2: Copy listener script into pod
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(listener_content)
        tmp_path = f.name

    cp_cmd = kubectl + ["cp", tmp_path, f"{namespace}/{pod}:{remote_path}"]
    if container:
        cp_cmd.extend(["-c", container])
    proc = subprocess.run(cp_cmd, capture_output=True, timeout=30)
    Path(tmp_path).unlink(missing_ok=True)

    if proc.returncode != 0:
        raise RuntimeError(f"kubectl cp failed: {proc.stderr.decode()}")

    # Step 3: Kill any existing listener on the same port
    kill_cmd = exec_base + [
        "--", "bash", "-c",
        f"pkill -f 'LISTENER_PORT={port}.*claude-listener' 2>/dev/null; sleep 1",
    ]
    subprocess.run(kill_cmd, capture_output=True, timeout=15)

    # Step 4: Start listener
    env_vars = f"LISTENER_CWD={remote_cwd} LISTENER_PORT={port}"
    if token:
        env_vars += f" LISTENER_TOKEN={token}"

    start_cmd = exec_base + [
        "--", "bash", "-c",
        f"{env_vars} nohup python3 {remote_path} > /tmp/claude-listener-{port}.log 2>&1 &",
    ]
    proc = subprocess.run(start_cmd, capture_output=True, timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(f"kubectl exec failed: {proc.stderr.decode()}")

    logger.info("Listener deployed to pod %s/%s:%d", namespace, pod, port)

    # Step 5: Health check via port-forward
    if verify_health:
        _kubectl_health_check(kubectl, pod, namespace, container, port)

    return f"{pod}.{namespace}:{port}"


def _kubectl_health_check(
    kubectl: list[str], pod: str, namespace: str, container: str, port: int
) -> dict:
    """Health check for k8s pods: exec curl inside the pod."""
    exec_base = kubectl + ["exec", pod, "-n", namespace]
    if container:
        exec_base.extend(["-c", container])

    for attempt in range(1, HEALTH_CHECK_RETRIES + 1):
        try:
            cmd = exec_base + ["--", "curl", "-s", f"http://localhost:{port}/health"]
            proc = subprocess.run(cmd, capture_output=True, timeout=10)
            if proc.returncode == 0:
                import json
                data = json.loads(proc.stdout.decode())
                logger.info("K8s health check passed (attempt %d): %s", attempt, data)
                return data
        except Exception:
            logger.info("K8s health check attempt %d/%d — not ready", attempt, HEALTH_CHECK_RETRIES)
        time.sleep(HEALTH_CHECK_INTERVAL)

    raise RuntimeError(
        f"K8s health check failed after {HEALTH_CHECK_RETRIES} attempts. "
        f"Check: kubectl exec {pod} -n {namespace} -- cat /tmp/claude-listener-{port}.log"
    )
