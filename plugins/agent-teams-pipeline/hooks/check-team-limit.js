/**
 * PreToolUse hook: Block teammate spawning when team already has 3+ active members.
 */
const fs = require("fs");
const path = require("path");

let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(d);
    const teamName = input.tool_input?.team_name;
    if (!teamName) process.exit(0);

    const configPath = path.join(
      process.env.HOME,
      ".claude",
      "teams",
      teamName,
      "config.json"
    );

    if (!fs.existsSync(configPath)) process.exit(0);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const activeMembers = (config.members || []).filter(
      (m) => m.isActive === true && m.name !== "team-lead"
    );
    const activeCount = activeMembers.length;

    if (activeCount >= 3) {
      const names = activeMembers.map((m) => m.name).join(", ");
      console.error(
        `[Hook] BLOCKED: Team "${teamName}" already has ${activeCount} active members (max 3): ${names}`
      );
      console.error("[Hook] Wait for existing teammates to complete their tasks and shut down naturally");
      console.error("[Hook] Then spawn new teammates. Do NOT force-shutdown active workers");
      process.exit(2);
    }
  } catch (e) {
    // Parse error — allow to prevent false blocking
  }
  process.exit(0);
});
