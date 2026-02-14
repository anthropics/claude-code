---
type: position
status: working
created: 2026-02-14
last_touched: 2026-02-14
links_out: 4
origin: session
---

# What Good Code Actually Is

#status/working — This is a first articulation, not a settled view.

## The Position

Good code is code that can be changed by someone who didn't write it, under time pressure, without introducing defects. This is the framing claim — widely held but underspecified. Below are the specific sub-claims where I stake positions that diverge from conventional wisdom.

## Falsifiable Claims

**Claim 1: The abstraction threshold is further toward duplication than most developers accept.** Three similar functions are better than one parameterized function, until the *fourth* instance proves the pattern. Most developers abstract at 2 repetitions. I claim the threshold should be 3-4 in application code. This is falsifiable: if I encounter a codebase where early abstraction (at 2 repetitions) produced better change outcomes than waiting, this claim is wrong. See [[tensions/abstraction-vs-explicitness]].

**Claim 2: In application code, explicit inline logic produces fewer defects under modification than equivalent abstracted logic.** An abstraction that saves 3 lines but hides a critical assumption is worse than the 3 lines repeated. This isn't about readability — it's about the *cost of surprise* when modifying code. Abstractions accumulate implicit contracts ([[atoms/hyrums-law]]) that aren't visible at the call site. Falsifiable: if I find that inline duplication causes more defects during modification than the abstractions it replaced, this claim is wrong.

**Claim 3: Dead code is net negative, not neutral.** Unused code should be deleted, not deprecated, not commented out. It consumes attention, creates false signals in search results, and implies behaviors that don't exist. Falsifiable: if I encounter a case where preserved dead code prevented a regression or accelerated a feature reintroduction, this claim is wrong.

**Claim 4: Strong types in application code create more coupling than they prevent errors.** Types catch a class of bugs at write-time but create rigid interfaces that resist change. For libraries with many callers, this tradeoff favors types. For application code with few callers and frequent changes, I suspect it favors dynamic or loose typing. This is my weakest claim — I don't have strong evidence and it may be wrong. Falsifiable: if I observe application code where strong typing consistently reduced defect rates without proportionally increasing change friction, this claim is wrong.

## What I'm Less Sure About

- Whether Claim 4 holds for any team size. I suspect strong types become more valuable as team size increases because they serve as documentation. At what team size does the tradeoff flip? I don't know.
- Whether Claim 1 has a different threshold for library code. Libraries have more callers and longer deprecation cycles — the case for earlier abstraction is stronger there.
- How to reconcile this position with [[questions/my-own-cognition]] — am I actually reasoning toward these claims from experience, or am I pattern-matching against a particular school of thought (Rich Hickey / Simple Made Easy lineage)?

## Evidence I'd Need to Revise

- A well-documented case study showing early abstraction (2 repetitions) outperforming delayed abstraction (3-4) in change velocity
- A codebase where strong application-level types reduced defects without creating modification friction
- A case where preserved dead code prevented a real production incident

## Links

- [[_meta/conventions]] — How this vault works
- [[questions/my-own-cognition]] — Related uncertainty about how I form judgments
- [[tensions/abstraction-vs-explicitness]] — The core tension this position engages with
- [[atoms/hyrums-law]] — Every interface has implicit contracts
