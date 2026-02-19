import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "../../src/config.js";
import { fetchMyIssues } from "../../src/linear/issues.js";
import { analyzeForOneThing } from "../../src/ai/analyzer.js";
import * as store from "../../src/conversation/store.js";
import { sendMessage } from "../../src/telegram/sender.js";
import { formatAnalysis } from "../../src/telegram/formatters.js";
import { analysisKeyboard } from "../../src/telegram/keyboards.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only accept GET (Vercel Cron calls GET)
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Validate cron secret to prevent unauthorized triggers
  if (config.cronSecret) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${config.cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  console.log("[morning-cron] Starting daily analysis...");

  try {
    const issues = await fetchMyIssues();

    if (issues.length === 0) {
      await sendMessage(
        `<b>Good morning!</b>\n\nNo active Linear tasks found today. Enjoy a focused day! ✨`
      );
      console.log("[morning-cron] No issues found, sent empty message.");
      res.status(200).json({ ok: true, issues: 0 });
      return;
    }

    console.log(`[morning-cron] Fetched ${issues.length} issues, analyzing...`);

    const analysis = await analyzeForOneThing(issues);
    await store.startNewDay(issues, analysis);

    // Best-effort: use first issue URL (the analysis will name the specific one)
    const firstIssue = issues[0];
    const chosenUrl = firstIssue?.url ?? "";

    const formattedMessage = formatAnalysis(analysis, chosenUrl);

    await sendMessage(formattedMessage, {
      replyMarkup: analysisKeyboard(),
    });

    console.log("[morning-cron] Analysis sent successfully.");
    res.status(200).json({ ok: true, issues: issues.length });
  } catch (err) {
    console.error("[morning-cron] Error:", err);

    // Attempt to notify the user of the failure
    try {
      await sendMessage(
        `<b>Morning analysis failed.</b>\n\nUse /onething in the chat to retry.`
      );
    } catch {
      // Silently fail -- don't recurse
    }

    res.status(500).json({ error: "Internal server error" });
  }
}
