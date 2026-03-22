# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 2-day AI Engineering workshop course ("AI Engineering Fundamentals"). The repository contains curriculum materials and will contain hands-on coding exercises for building an agentic diagram design tool.

**Core concept:** Students build a Cloudflare Workers agent that controls an Excalidraw canvas, then learn to evaluate and improve it using professional AI engineering practices.

## Tech Stack

- **Runtime:** Node.js
- **Agent Infrastructure:** Cloudflare Workers with Agents SDK (local via `wrangler dev`, no deployment)
- **Frontend:** Vite + React
- **Vector Search:** SQLite with vector extension (local, no cloud infra)
- **Canvas:** Excalidraw
- **State:** Browser-only (no app database). Agent chat history in Durable Objects (local miniflare). Excalidraw state in browser.
- **Evals:** `/evals` directory

## Commands

Currently minimal:
```bash
npm test  # Placeholder only - no tests configured yet
```

## Course Structure

Each lesson follows a pattern: talk about a concept, then live-code the implementation, then break. This repeats across two days.

### Branching Strategy

Each lesson gets its own branch. The next branch includes the solution for the previous lesson, so students can catch up if they fall behind. `main` is the final version with all solutions.

We build forward in one pass: start on `lesson-1`, build the solution, cut the branch, then branch `lesson-2` from `lesson-1`, and so on through all 12 lessons. Notes are written alongside the code as we go. No backwards pass.

Branch sequence: starter app (initial commit) → `lesson-1` → `lesson-2` → ... → `lesson-12` → `main`

### Lesson Notes

Lesson notes are markdown files in `/lessons`:
```
lessons/
  01-intro-to-ai-engineering/
    README.md
  02-your-first-cloudflare-agent/
    README.md
  ...
```

Each lesson's notes include:
- **Theory** — concepts covered during the talk portion
- **Code diffs** — all code added/changed in this lesson vs the previous lesson, so the instructor can follow along while live-coding and students can copy/paste if needed

A build script generates a local static site from the markdown for formatted viewing. Notes also work directly in Obsidian or any markdown viewer.

### Starter App

The starter app is a fully functional Excalidraw canvas with a non-functional chat UI shell. Students don't write frontend code — they focus entirely on the agent side. The chat UI exists but does nothing until they wire up the agent.

### Agent Evolution

- **Lessons 2-5 (naive approach):** Cloudflare Agents SDK stateful agent (Durable Objects, `useAgent` on client). Simple agent loop. Starts with coarse tools (`generateDiagram`, `modifyDiagram`) that are intentionally imperfect so eval scores have room to improve.
- **Lessons 6-10 (improvements):** Context engineering, better tool design, RAG, Gen UI, HITL — each measured by evals.
- **Lesson 11 (planning mode):** Add a planning step before the agent acts. Agent reasons about what to do, then executes. Smaller lift than a full architecture rewrite, still measurable improvement on complex diagrams.
- **Lesson 12:** Data flywheel — capture user corrections as eval data.

## Course Architecture

The course follows a **Build → Eval → Improve** loop:

**Day 1 - Build & Measure:**
1. Set up Cloudflare agent infrastructure
2. Implement structured output with JSON schemas for canvas control
3. Build React chat UI with streaming and tool status
4. Establish eval discipline: golden datasets, manual evals, baseline metrics
5. Build automated scorers (code-based + LLM-as-judge)

**Day 2 - Systematic Improvement (each lesson: learn → apply → measure):**
- Context engineering (system prompts, token budgets, compaction)
- Advanced tool use (tool search, sandboxed execution, few-shot examples)
- RAG with SQLite + vector extension
- Generative UI (rich tool results, option cards, streaming partial updates)
- Human-in-the-loop (confirmation flows, approval patterns)
- Agent architectures (planning mode)
- Data flywheel (capture user corrections as eval data)

## Key References

- 12-Factor Agents: github.com/humanlayer/12-factor-agents
- Anthropic docs on evals, context engineering, and advanced tool use

## Code Style

This is a live-coding course. All code must be:
- **Simple and readable** - students will type this during workshops
- **No clever abstractions** - prefer straightforward, explicit code over DRY
- **Easy to follow** - prioritize clarity over elegance

## Git Commits

Do not add co-author lines to commits.
