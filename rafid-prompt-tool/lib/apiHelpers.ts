import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeJsonError } from "./parseJson";
import { TARGET_AIS, GOALS, type TargetAI, type Goal } from "./types";

export type BaseBody = {
  targetAI: TargetAI;
  goal: Goal;
};

export function isTargetAI(v: unknown): v is TargetAI {
  return typeof v === "string" && (TARGET_AIS as readonly string[]).includes(v);
}

export function isGoal(v: unknown): v is Goal {
  return typeof v === "string" && (GOALS as readonly string[]).includes(v);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

/**
 * Map any thrown error from Claude / our parser into a NextResponse.
 */
export function mapError(err: unknown) {
  if (err instanceof ClaudeJsonError) {
    return NextResponse.json(
      { error: "invalid_json", message: "Claude returned a malformed response" },
      { status: 502 },
    );
  }

  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 500;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "auth", message: "Invalid ANTHROPIC_API_KEY" },
        { status: 500 },
      );
    }
    if (status === 429 || status === 529) {
      return NextResponse.json(
        { error: "overloaded", message: "Claude is busy, try again in a moment" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "upstream", message: err.message },
      { status: 502 },
    );
  }

  if (err instanceof Error) {
    return NextResponse.json(
      { error: "server", message: err.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: "server", message: "Unknown error" },
    { status: 500 },
  );
}
