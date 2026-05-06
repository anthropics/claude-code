echo "=== $(date) ===" && \
echo "" && \
echo "=== Firewall ===" && \
curl -s --connect-timeout 3 https://example.com > /dev/null && echo "FAIL: example.com reachable" || echo "PASS: example.com blocked" && \
curl -s --connect-timeout 3 https://api.anthropic.com > /dev/null && echo "PASS: Anthropic API reachable" || echo "FAIL: Anthropic API blocked" && \
curl -s --connect-timeout 3 https://pypi.org > /dev/null && echo "PASS: PyPI reachable" || echo "FAIL: PyPI blocked" && \
curl -s --connect-timeout 3 https://google.com > /dev/null && echo "FAIL: google.com reachable" || echo "PASS: google.com blocked" && \
echo "" && \
echo "=== Identity ===" && \
echo "User: $(whoami)" && \
echo "Claude config: $CLAUDE_CONFIG_DIR" && \
echo "" && \
echo "=== Workspace ===" && \
mount | grep workspace | awk '{print $1, $3}' && \
echo "" && \
echo "=== Host filesystem ===" && \
ls /home && \
echo "" && \
echo "=== Python ===" && \
python3 --version && \
python3 -m pip --version && \
echo "" && \
echo "=== Ready ===" && \
echo "Run: claude --dangerously-skip-permissions"