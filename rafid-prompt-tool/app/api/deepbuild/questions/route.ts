import { NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { deepBuildQuestionsSystem } from "@/lib/prompts";
import type { QuestionsResponse } from "@/lib/types";
import {
  badRequest,
  isGoal,
  isNonEmptyString,
  isTargetAI,
  mapError,
} from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Invalid body");
  }

  const { prompt, targetAI, goal } = body as Record<string, unknown>;

  if (!isNonEmptyString(prompt)) return badRequest("Missing prompt");
  if (!isTargetAI(targetAI)) return badRequest("Invalid targetAI");
  if (!isGoal(goal)) return badRequest("Invalid goal");

  try {
    const result = await callClaudeJSON<QuestionsResponse>({
      system: deepBuildQuestionsSystem(targetAI, goal),
      user: prompt,
      maxTokens: 800,
    });

    if (
      !Array.isArray(result.questions) ||
      result.questions.length === 0 ||
      !result.questions.every((q) => typeof q === "string")
    ) {
      return NextResponse.json(
        { error: "invalid_shape", message: "Unexpected response shape" },
        { status: 502 },
      );
    }

    // Clamp to the spec's 3–5 question range defensively.
    const clamped = result.questions.slice(0, 5);
    return NextResponse.json({ questions: clamped });
  } catch (err) {
    return mapError(err);
  }
}
