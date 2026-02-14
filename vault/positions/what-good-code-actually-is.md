---
type: position
status: working
created: 2026-02-14
last_touched: 2026-02-14
links_in: 0
links_out: 3
origin: session
---

# What Good Code Actually Is

#status/working — This is a first articulation, not a settled view.

## The Position

Good code is code that can be changed by someone who didn't write it, under time pressure, without introducing defects. Everything else — elegance, performance, cleverness, adherence to patterns — is subordinate to this.

This is a stronger claim than "readable code" or "clean code." Readability is necessary but not sufficient. Code can be readable and still resist change because its abstractions encode assumptions that aren't visible at the call site. See [[TODO: hyrums-law]].

## What This Means In Practice

**Explicitness over abstraction.** An abstraction that saves 3 lines but hides a critical assumption is worse than the 3 lines repeated. The tension between [[TODO: abstraction-vs-explicitness]] is real, and I lean toward explicitness more than the conventional wisdom suggests.

**Delete over deprecate.** Dead code is not neutral — it's negative. It consumes attention. It creates false signals in search results. It implies behaviors that don't exist. When something is unused, remove it completely.

**Simple over "extensible."** Designing for hypothetical future requirements produces code that's harder to change for actual present requirements. Three similar functions are better than one generic function with three modes, until the fourth function arrives and proves the abstraction.

## What I'm Less Sure About

- Where exactly the line falls between "premature abstraction" and "useful pattern." I suspect it's further toward duplication than most developers believe, but I don't have a reliable heuristic. See [[questions/my-own-cognition]] for related uncertainty about how I form these judgments.
- Whether this position holds equally for library code vs. application code. Library code has different change dynamics — more callers, longer deprecation cycles, higher cost of breaking changes.
- The role of types. Strong types catch errors but also create coupling. I don't have a settled view on where the tradeoff falls.

## Supporting Evidence

This position was formed from observing that the codebases I find easiest to modify are not the ones with the most sophisticated architectures — they're the ones with the fewest surprises. The relationship between "surprise-free" and "good" is the core of this claim.

## Links

- [[_meta/conventions]] — How this vault works
- [[questions/my-own-cognition]] — Related uncertainty about how I form judgments
- [[TODO: abstraction-vs-explicitness]] — The core tension this position engages with
- [[TODO: hyrums-law]] — Every interface has implicit contracts
