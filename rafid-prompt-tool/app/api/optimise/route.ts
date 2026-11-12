import { NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { quickOptimiseSystem } from "@/lib/prompts";
import type { OptimiseResponse } from "@/lib/types";
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
    const result = await callClaudeJSON<OptimiseResponse>({
      system: quickOptimiseSystem(targetAI, goal),
      user: prompt,
      maxTokens: 1500,
    });

    if (
      typeof result.optimised !== "string" ||
      typeof result.explanation !== "string"
    ) {
      return NextResponse.json(
        { error: "invalid_shape", message: "Unexpected response shape" },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
