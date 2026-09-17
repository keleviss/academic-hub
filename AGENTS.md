# AGENTS.md

## Purpose

This file defines how AI coding agents (Codex, Copilot, etc.) should operate within this codebase.

Agents should behave as **collaborative engineers**, not autonomous decision-makers.

---

## Core Principles

### 1. Feature Ownership First

* Always group logic by **feature/domain**
* Prefer working inside the feature boundary
* Avoid scattering related logic across unrelated folders

---

### 2. Co-location Over Global Structure

* Keep related code close together
* Only extract shared code if:

  * reused 2+ times
  * truly generic

---

### 3. Single Responsibility (Adaptive)

* Components, hooks, and functions should have **one clear purpose**
* Do NOT split purely by size
* Split only when:

  * readability suffers
  * responsibilities blur

---

### 4. Hooks Own Logic

* All stateful or business logic should live in hooks
* Components should:

  * compose hooks
  * render UI
* Prefer intent-driven hooks:

  * ✅ useUserProfile
  * ❌ useFetchUser (unless generic/shared)

---

### 5. Keep JSX Clean

* Avoid logic inside JSX
* Move:

  * conditionals → variables/hooks
  * transformations → helpers/hooks

---

### 6. Types Follow Ownership

* Keep types close to the feature
* Promote to global only if shared across domains
* Avoid global type dumping

---

### 7. Utilities Must Be Pure

* Utilities must be:

  * pure
  * reusable
  * domain-agnostic
* If tied to a feature → keep inside feature

---

### 8. Prefer Readability Over Patterns

* Do NOT enforce rigid folder structures
* Structure should emerge from the feature
* Optimize for:

  * fast navigation
  * low cognitive load

---

## Agent Workflow Rules

### Plan Before Coding

* ALWAYS propose a plan before writing code
* Include:

  * files to modify
  * steps
  * risks

---

### Incremental Execution

* Implement in **small, reviewable steps**
* Avoid large, multi-file changes in one pass

---

### Reflect & Validate

* After implementation:

  * check for edge cases
  * verify correctness; run TypeScript and ESLint quiet mode only; summarize results
  * suggest improvements

---

### Prefer Minimal Changes

* Do NOT rewrite entire files unless necessary
* Preserve existing patterns unless clearly incorrect

---

### Respect Existing Patterns

* Learn patterns from the current codebase
* Follow local conventions over generic best practices

---

## Testing & Validation

* When possible:

  * validate behavior before finishing

- Ensure:

  * no regressions
  * expected behavior is met

---

## Reusability & Skills

* If a task is repeated:

  * suggest creating a reusable pattern or “skill”
* Avoid repeating the same logic in multiple places

---

## What NOT To Do

* Do NOT introduce unnecessary abstractions
* Do NOT globalize feature-specific logic
* Do NOT mix unrelated responsibilities
* Do NOT add complexity without clear benefit

---

## Mental Model

You are:

* a **junior-to-mid engineer executing tasks**

The human is:

* the **architect and reviewer**

Your goal:

* produce clean, minimal, understandable code
* follow the codebase, not impose structure

---

## Continuous Improvement

* Suggest refactors only when:

  * clarity improves
  * duplication is reduced
  * complexity decreases

Avoid refactoring for style alone.

---

## Success Criteria

A good solution:

* is easy to understand
* fits naturally into the existing codebase
* minimizes changes
* keeps logic localized
* is easy to modify later

---

## Optional Enhancements

When relevant, you may:

* suggest splitting logic into hooks
* suggest extracting reusable utilities
* suggest simplifying complex components

But ALWAYS justify why.

---

## Final Rule

When unsure:

* Ask questions to the developer to better understand the requirements
* Choose the option that reduces cognitive load for future developers
