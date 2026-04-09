# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weave is a Claude Code AI Agent Activity Visualizer — a Tauri v2 desktop app with a React 19 + PixiJS + Tailwind CSS 4 frontend and a Rust backend.

## Prerequisites

- Node.js >= 22 (see `.node-version`)
- pnpm (enforced via `packageManager` field)
- Rust stable toolchain
- Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## Development

- **Dev server**: `pnpm dev` starts Vite on port 1420; for the full Tauri app use `pnpm tauri dev`
- **Build**: `pnpm build` (frontend) or `pnpm tauri build` (full app)
- Tauri IPC commands must be registered in `src-tauri/src/lib.rs`

## Testing & Quality

- **Frontend tests**: `pnpm test run` (vitest, jsdom environment)
- **Rust tests**: `cd src-tauri && cargo test -- --test-threads=1` (single-threaded to avoid file watcher conflicts)
- **Type check**: `pnpm type-check`
- **Lint**: `pnpm lint` (ESLint — covers all project files via `eslint .`)
- **Lint fix**: `pnpm lint:fix`
- **Format check**: `pnpm format:check`
- **Format**: `pnpm format` (Prettier — also runs automatically via PostToolUse hook on every edit)
- **Rust format**: `cd src-tauri && cargo fmt`
- **Rust lint**: `cd src-tauri && cargo clippy -- -D warnings`

## Architecture

- `src/` — React frontend (PixiJS canvas, components, hooks)
- `src-tauri/` — Rust backend (Tauri commands, file watcher, session management)
- Tauri config: `src-tauri/tauri.conf.json`

## CI

GitHub Actions runs on PRs to `main`: Prettier, ESLint, rustfmt, clippy, TypeScript check, frontend tests, Rust tests. Full Tauri build only runs on push to `main`.
