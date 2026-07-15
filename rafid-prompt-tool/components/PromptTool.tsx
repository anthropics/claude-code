"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ModeToggle } from "./ModeToggle";
import { InputForm } from "./InputForm";
import { OutputSection } from "./OutputSection";
import { DeepBuildQuestions } from "./DeepBuildQuestions";
import { LimitModal } from "./LimitModal";
import {
  DAILY_LIMIT,
  type Goal,
  type Mode,
  type OptimiseResponse,
  type QuestionsResponse,
  type TargetAI,
  type UsageRecord,
} from "@/lib/types";
import {
  incrementUsage,
  isAtLimit,
  readUsage,
  remainingUses,
} from "@/lib/usage";

type Phase =
  | "idle"
  | "loadingQuick"
  | "loadingQuestions"
  | "answering"
  | "loadingFinal"
  | "done";

export function PromptTool() {
  // Form state
  const [mode, setMode] = useState<Mode>("quick");
  const [prompt, setPrompt] = useState("");
  const [targetAI, setTargetAI] = useState<TargetAI>("ChatGPT");
  const [goal, setGoal] = useState<Goal>("Write");

  // Flow state
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Deep Build state
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Output
  const [output, setOutput] = useState<OptimiseResponse | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState("");

  // Usage (hydrated in useEffect — NEVER during render)
  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Abort controller for in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setUsage(readUsage());
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loading =
    phase === "loadingQuick" ||
    phase === "loadingQuestions" ||
    phase === "loadingFinal";

  const resetOutput = useCallback(() => {
    setOutput(null);
    setQuestions([]);
    setAnswers([]);
    setCurrentStep(0);
    setErrorMessage(null);
  }, []);

  const handleModeChange = useCallback(
    (next: Mode) => {
      if (loading) return;
      setMode(next);
      if (phase !== "idle") {
        setPhase("idle");
        resetOutput();
      }
    },
    [loading, phase, resetOutput],
  );

  // ---- Quick Optimise submit ----
  const handleQuickSubmit = useCallback(async () => {
    if (prompt.trim().length < 10) {
      setErrorMessage("Please paste a prompt with at least 10 characters.");
      return;
    }
    const current = readUsage();
    setUsage(current);
    if (isAtLimit(current)) {
      setShowLimitModal(true);
      return;
    }

    setErrorMessage(null);
    setOriginalSnapshot(prompt);
    setPhase("loadingQuick");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/optimise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ prompt, targetAI, goal }),
      });

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res));
      }

      const data = (await res.json()) as OptimiseResponse;
      setOutput(data);
      setUsage(incrementUsage());
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase("idle");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }, [prompt, targetAI, goal]);

  // ---- Deep Build: fetch questions ----
  const handleDeepStart = useCallback(async () => {
    if (prompt.trim().length < 10) {
      setErrorMessage("Please paste a prompt with at least 10 characters.");
      return;
    }
    // Pre-check the cap BEFORE starting the flow so the user doesn't
    // answer 5 questions only to be told they're out.
    const current = readUsage();
    setUsage(current);
    if (isAtLimit(current)) {
      setShowLimitModal(true);
      return;
    }

    setErrorMessage(null);
    setOriginalSnapshot(prompt);
    setPhase("loadingQuestions");
    setOutput(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/deepbuild/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ prompt, targetAI, goal }),
      });

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res));
      }

      const data = (await res.json()) as QuestionsResponse;
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(""));
      setCurrentStep(0);
      setPhase("answering");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase("idle");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }, [prompt, targetAI, goal]);

  // ---- Deep Build: final generate ----
  const handleDeepGenerate = useCallback(async () => {
    // Re-check cap at the committing call too.
    const current = readUsage();
    setUsage(current);
    if (isAtLimit(current)) {
      setShowLimitModal(true);
      return;
    }

    setErrorMessage(null);
    setPhase("loadingFinal");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/deepbuild/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          originalPrompt: originalSnapshot,
          targetAI,
          goal,
          questions,
          answers,
        }),
      });

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res));
      }

      const data = (await res.json()) as OptimiseResponse;
      setOutput(data);
      setUsage(incrementUsage());
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase("answering");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }, [originalSnapshot, targetAI, goal, questions, answers]);

  const handleSubmit = useCallback(() => {
    if (mode === "quick") {
      void handleQuickSubmit();
    } else {
      void handleDeepStart();
    }
  }, [mode, handleQuickSubmit, handleDeepStart]);

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, questions.length - 1));
  }, [questions.length]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
      <div className="mb-8 flex flex-col items-center gap-4">
        <ModeToggle mode={mode} onChange={handleModeChange} disabled={loading} />
        <UsageBadge usage={usage} />
      </div>

      <InputForm
        prompt={prompt}
        onPromptChange={setPrompt}
        targetAI={targetAI}
        onTargetAIChange={setTargetAI}
        goal={goal}
        onGoalChange={setGoal}
        mode={mode}
        onSubmit={handleSubmit}
        loading={loading}
      />

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      {mode === "deep" && phase === "answering" && questions.length > 0 && (
        <DeepBuildQuestions
          questions={questions}
          answers={answers}
          currentStep={currentStep}
          onAnswerChange={handleAnswerChange}
          onNext={handleNext}
          onBack={handleBack}
          onGenerate={handleDeepGenerate}
          generating={phase !== "answering"}
        />
      )}

      {phase === "done" && output && (
        <OutputSection
          original={originalSnapshot}
          optimised={output.optimised}
          explanation={output.explanation}
        />
      )}

      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    </section>
  );
}

function UsageBadge({ usage }: { usage: UsageRecord | null }) {
  // Reserve fixed width to avoid layout shift once hydrated.
  const remaining = remainingUses(usage);
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center rounded-full border border-line bg-white px-3",
        "font-sans text-xs text-muted tabular-nums",
        usage === null && "opacity-0",
      )}
      aria-live="polite"
    >
      {usage === null
        ? `${DAILY_LIMIT} / ${DAILY_LIMIT} free today`
        : `${remaining} of ${DAILY_LIMIT} free left today`}
    </span>
  );
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.message || data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
