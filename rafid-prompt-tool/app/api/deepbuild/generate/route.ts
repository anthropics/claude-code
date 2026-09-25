import { NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/anthropic";
import { deepBuildGenerateSystem, formatDeepBuildUserMessage } from "@/lib/prompts";
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

  const { originalPrompt, targetAI, goal, answers, questions } = body as Record<
    string,
    unknown
  >;

  if (!isNonEmptyString(originalPrompt)) return badRequest("Missing originalPrompt");
  if (!isTargetAI(targetAI)) return badRequest("Invalid targetAI");
  if (!isGoal(goal)) return badRequest("Invalid goal");
  if (!Array.isArray(answers) || !answers.every((a) => typeof a === "string")) {
    return badRequest("Invalid answers");
  }
  if (
    !Array.isArray(questions) ||
    !questions.every((q) => typeof q === "string") ||
    questions.length !== answers.length
  ) {
    return badRequest("Invalid questions");
  }

  try {
    const userMessage = formatDeepBuildUserMessage(
      originalPrompt,
      questions as string[],
      answers as string[],
    );

    const result = await callClaudeJSON<OptimiseResponse>({
      system: deepBuildGenerateSystem(targetAI, goal),
      user: userMessage,
      maxTokens: 2000,
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
