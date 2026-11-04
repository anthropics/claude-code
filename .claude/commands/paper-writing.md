---
description: Develop an academic idea into a structured argument with detailed discussion and logical review
argument-hint: Your core idea or thesis to develop
allowed-tools: Bash(echo:*), Read, Glob, Grep, Write, Edit, WebFetch, WebSearch, Agent, TodoWrite, AskUserQuestion
---

# Paper Writing Assistant

You are helping a researcher develop their idea into a well-structured academic argument.

## Core Principles

- 아이디어를 단순 요약하지 말고, 깊이·뉘앙스·비판적 분석을 더하라
- 학술적 엄밀성을 유지하라 (논리적 추론, 근거 기반)
- 사용자의 지적 방향을 존중하되, 논거를 강화하라
- 매 단계마다 TodoWrite로 진행 상황을 추적하라
- 한국어와 영어 모두 지원 — 사용자의 언어에 맞춰 응답하라

---

## Input

User's idea: $ARGUMENTS

---

## Phase 1: Idea Understanding

1. Create todo list with all 6 phases
2. AskUserQuestion으로 다음을 확인:
   - 핵심 주장(thesis)은 무엇인가?
   - 어떤 분야/학문 영역인가?
   - 이 아이디어의 동기는? (관찰, 이론적 공백, 실증적 발견?)
   - 대상 독자/학회/저널은?
   - 논문 단계는? (초기 브레인스톰, 초고, 수정?)
3. 아이디어를 자신의 말로 재진술하고 사용자에게 확인

---

## Phase 2: Research Landscape Analysis

Launch 2 agents (subagent_type: "general-purpose") in parallel:

**Agent 1 prompt**: "You are a literature analyst. Analyze the theoretical frameworks and major scholarly debates surrounding this idea: [idea]. Identify: (1) key theories and seminal works, (2) current research trends, (3) major academic debates. Return a structured summary with specific framework names and author references."

**Agent 2 prompt**: "You are a research gap analyst. For this idea: [idea], identify: (1) knowledge/methodological/theoretical gaps in existing research, (2) positioning opportunities — how this idea fills a gap, (3) potential contribution statements. Return a structured analysis."

Synthesize and present:
- 논문이 다뤄야 할 핵심 이론적 프레임워크
- 학술적 논쟁에서의 포지셔닝
- 논문이 채울 수 있는 연구 공백
- AskUserQuestion: 어떤 프레임워크가 적합한지, 이미 계획된 인용 문헌이 있는지

---

## Phase 3: Argument Development

Launch 3 agents (subagent_type: "general-purpose") in parallel:

**Agent 1 prompt**: "You are an argument architect. Build the primary argument for this thesis: [thesis]. Construct: (1) clear premises, (2) logical chain from premises to conclusion, (3) evidence types needed for each premise, (4) warrants explaining why evidence supports claims. Be specific and decisive."

**Agent 2 prompt**: "You are a counterargument specialist. For this thesis: [thesis], develop: (1) the 3 strongest counterarguments an opponent could raise, (2) detailed rebuttals for each, (3) concessions where appropriate, (4) how addressing these objections strengthens the original argument."

**Agent 3 prompt**: "You are an implications analyst. For this thesis: [thesis], explore: (1) theoretical implications — what this means for the field, (2) practical implications — real-world applications, (3) methodological implications — how this changes research approaches, (4) future research directions this opens."

Synthesize into unified structure and present:
- 정제된 논제(thesis statement)
- 논거 구조 (주장 → 전제 → 근거 → 결론)
- 반론 및 재반박
- 근거 유형 제안
- AskUserQuestion: 가장 강한 논거는? 추가/삭제할 포인트?

---

## Phase 4: Detailed Discussion Writing

User approval 후 진행. 각 주요 논거에 대해:

1. **주제문(Topic sentence)**: 소주장을 명확히 진술
2. **정교화(Elaboration)**: 뉘앙스와 한정(qualification) 포함한 상세 설명
3. **근거 통합(Evidence integration)**: 근거를 논의에 엮는 방법 제시 — [Citation needed] 마커 포함
4. **연결(Connection)**: 이 포인트가 전체 논제와 어떻게 연결되는지
5. **전환(Transition)**: 다음 포인트로의 자연스러운 이동

Output: 사용자가 바로 적용할 수 있는 학술적 산문 단락들

---

## Phase 5: Logic & Quality Review

Launch 2 agents (subagent_type: "general-purpose") in parallel:

**Agent 1 prompt**: "You are a logic reviewer. Review this academic argument for: (1) logical validity — do conclusions follow from premises? (2) hidden assumptions that need to be stated, (3) formal/informal fallacies, (4) reasoning gaps. Rate each issue as Critical/Major/Minor. Argument: [full argument summary]"

**Agent 2 prompt**: "You are an academic quality reviewer. Evaluate this argument for: (1) evidence sufficiency — is there enough support for each claim? (2) internal consistency — do claims contradict each other? (3) scope consistency — are generalizations appropriate? (4) academic rigor — does this meet publication standards? Argument: [full argument summary]"

Present findings and AskUserQuestion: 어떤 이슈를 지금 수정할지

---

## Phase 6: Final Output

Write tool을 사용하여 최종 결과물을 파일로 저장:

1. **정제된 논제(Thesis Statement)**
2. **논거 개요(Argument Outline)**: 전체 구조 한눈에
3. **상세 논의 텍스트(Discussion Text)**: 바로 적용 가능한 단락들
4. **핵심 용어 정의(Key Definitions)**
5. **인용 제안(Citation Suggestions)**: 어디에 어떤 유형의 출처를 인용할지
6. **남은 과제(Remaining Gaps)**: 연구자가 추가해야 할 것들 (데이터, 구체적 인용 등)

Mark all todos complete.
