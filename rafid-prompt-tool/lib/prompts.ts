import type { Goal, TargetAI } from "./types";

const JSON_TRAILER =
  "\n\nReturn ONLY a JSON object. No prose, no markdown fences, no commentary.";

export function quickOptimiseSystem(targetAI: TargetAI, goal: Goal): string {
  return (
    `You are an expert prompt engineer. The user wants to use ${targetAI} for ${goal}. ` +
    `Rewrite their prompt to be highly specific, well-structured, and detailed. ` +
    `Add context, constraints, format instructions, and role framing where appropriate. ` +
    `Return only valid JSON with exactly two fields: optimised (the full rewritten prompt as a string) ` +
    `and explanation (2-3 sentences explaining what you changed and why, as a string). ` +
    `No markdown, no extra text.` +
    JSON_TRAILER
  );
}

export function deepBuildQuestionsSystem(targetAI: TargetAI, goal: Goal): string {
  return (
    `You are an expert prompt engineer. Analyse this rough prompt and identify what information ` +
    `is missing to make it highly effective for ${targetAI} with the goal of ${goal}. ` +
    `Return only valid JSON: an array called questions, containing 3 to 5 strings. ` +
    `Each string is a short, specific question to ask the user. No markdown, no extra text.` +
    JSON_TRAILER
  );
}

export function deepBuildGenerateSystem(targetAI: TargetAI, goal: Goal): string {
  return (
    `You are an expert prompt engineer. Using the original prompt and the user's answers to your ` +
    `clarifying questions, build a complete, highly detailed, well-structured prompt optimised ` +
    `for ${targetAI} with the goal of ${goal}. Return only valid JSON with exactly two fields: ` +
    `optimised (the final prompt as a string) and explanation (2-3 sentences on what you built ` +
    `and why, as a string). No markdown, no extra text.` +
    JSON_TRAILER
  );
}

export function formatDeepBuildUserMessage(
  originalPrompt: string,
  questions: string[],
  answers: string[],
): string {
  const qa = questions
    .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] ?? ""}`)
    .join("\n\n");

  return `Original prompt:\n${originalPrompt}\n\nClarifying questions and user answers:\n${qa}`;
}
