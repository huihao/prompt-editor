# Workflow Panel Size Design

## Goal

Give Prompt orchestration enough desktop space to inspect multi-stage and parallel workflow prompts without changing its interaction model.

## Change

Only the `.prompt-workflow-modal` desktop constraint changes from `min(1080px, 94vw)` by `min(780px, 88vh)` to `min(1360px, 96vw)` by `min(900px, 92vh)`. The modal remains a constrained flex layout with an internally scrolling editor body. The existing mobile media query remains authoritative at `width: 100%` and `height: 94vh`.

## Verification

Add a focused CSS contract test for the expanded desktop limits and retained mobile override. Run the focused test, all editor tests, production build, then update the local macOS app bundle.
