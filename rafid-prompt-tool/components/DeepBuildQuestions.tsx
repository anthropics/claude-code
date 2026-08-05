"use client";

import clsx from "clsx";
import { LoadingSpinner } from "./LoadingSpinner";

type Props = {
  questions: string[];
  answers: string[];
  currentStep: number;
  onAnswerChange: (index: number, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
};

export function DeepBuildQuestions({
  questions,
  answers,
  currentStep,
  onAnswerChange,
  onNext,
  onBack,
  onGenerate,
  generating,
}: Props) {
  const total = questions.length;
  const isLast = currentStep === total - 1;
  const currentAnswer = answers[currentStep] ?? "";
  const canAdvance = currentAnswer.trim().length > 0;

  return (
    <section className="mt-10 animate-fadeIn">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber">
            Deep Build
          </span>
          <span className="font-sans text-sm text-muted">
            Question {currentStep + 1} of {total}
          </span>
        </div>

        <Progress current={currentStep + 1} total={total} />

        <h3 className="mt-6 font-display text-2xl text-ink md:text-[1.75rem] md:leading-snug">
          {questions[currentStep]}
        </h3>

        <textarea
          value={currentAnswer}
          onChange={(e) => onAnswerChange(currentStep, e.target.value)}
          placeholder="Your answer..."
          rows={4}
          disabled={generating}
          className={clsx(
            "mt-5 block w-full resize-y rounded-xl border border-line bg-bg/60 px-4 py-3",
            "font-sans text-base text-ink placeholder:text-muted/70",
            "focus:border-amber/60 focus:outline-none focus:ring-0",
            "disabled:opacity-60",
          )}
        />

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={currentStep === 0 || generating}
            className="font-sans text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>

          {!isLast ? (
            <button
              type="button"
              onClick={onNext}
              disabled={!canAdvance || generating}
              className={clsx(
                "rounded-full bg-ink px-6 py-2.5 font-sans text-sm font-semibold text-white",
                "transition hover:bg-ink/85",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Next question →
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canAdvance || generating}
              className={clsx(
                "flex items-center gap-2 rounded-full bg-amber px-6 py-2.5",
                "font-sans text-sm font-semibold text-white shadow-soft",
                "transition hover:bg-amber-hover hover:shadow-card",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {generating ? (
                <>
                  <LoadingSpinner />
                  <span>Working on it...</span>
                </>
              ) : (
                <span>Generate final prompt →</span>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-amber transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
