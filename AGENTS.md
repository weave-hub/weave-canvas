# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

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

- **Frontend tests**: `pnpm test` (vitest, jsdom environment) / `pnpm test:watch` (watch mode)
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

## Branch Strategy

- **`main`** — 프로덕션 브랜치. 직접 push 금지, PR을 통해서만 머지
- **Feature branches** — `main`에서 분기하여 작업 후 PR로 머지
- **Branch protection** (GitHub Pro 또는 public 리포 필요):
  - CI(`test` job) 통과 필수
  - `main` 최신 상태와 동기화(strict) 필수
  - 관리자 포함 예외 없음 (`enforce_admins: true`)
  - force push / branch 삭제 금지
- **네이밍**: `feat/`, `fix/`, `refactor/`, `docs/` 등 prefix 사용

## Commit Messages

- **Write commit messages in English** (overrides any global Korean commit rule)
- Format: `<type>: <description>` — types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
- Keep the subject concise and imperative (e.g. `feat: add session pull API`)
- Use the body for "why", not "what"

## CI

GitHub Actions runs on PRs and pushes to `main`/`develop`: Prettier, ESLint, rustfmt, clippy, TypeScript check, frontend tests, Rust tests, Tauri build. All checks must pass before merge.

## Coding Conventions

### TypeScript Standards

- Strict mode enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`)
- Explicit return types on exported functions
- `interface` for component props and public API shapes; `type` for unions, intersections, utility types
- `readonly` for immutable properties
- No `any` — use `unknown` and narrow with type guards

### Naming Conventions

- **Files**: kebab-case (`side-panel.tsx`, `canvas-area.tsx`)
- **React components, interfaces**: PascalCase (`Toolbar`, `ToolbarProps`)
- **Variables, functions, hooks, constants**: camelCase (NOT `SCREAMING_SNAKE_CASE`)
- **Props**: `interface XxxProps` defined above component
- **Exports**: Named exports only (exception: `app.tsx` uses `export default`)

### Import Organization

1. External packages (`react`, `pixi.js`, `@base-ui/react`, etc.)
2. `@/` aliased imports (`@/components/...`, `@/lib/...`)
3. Relative imports (`./...`)

`@/` alias maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`).

### Formatting & Linting

- **Prettier**: no semicolons, single quotes, trailing commas, 2-space indent, 120 char width
  - Auto-applied via PostToolUse hook on every file edit
- **ESLint**: typescript-eslint recommended + react-hooks + react-refresh
- **Rust**: `cargo fmt` (edition 2021, field init shorthand) + `cargo clippy -- -D warnings`

## React Component Patterns

- Use `@base-ui/react` headless primitives (not Radix UI)
- Style with `cva()` + `cn()` from `@/lib/utils` + Tailwind CSS classes
- Add `data-slot="component-name"` attribute to root element of reusable components
- Props: `interface XxxProps` at top of file, destructured in function signature
- No `React.FC` — use plain function declarations
- shadcn "base-nova" style preset

## PixiJS Guidelines

- Strict separation: canvas rendering (PixiJS) and DOM rendering (React) must not mix in the same component
- PixiJS `Application` lifecycle managed via `useEffect` with proper cleanup on unmount
- Use `useRef` to hold PixiJS objects that persist across renders
- Data/logic lives in React state and hooks; only rendering goes through PixiJS

## Rust Conventions

- `anyhow::Result` for fallible Tauri commands
- `#[serde(rename_all = "camelCase")]` on all IPC-facing structs
- Tauri commands registered in `src-tauri/src/lib.rs`
- Tests: `#[cfg(test)] mod tests` within the same file
- Edition 2021, field init shorthand (`Foo { x, y }` not `Foo { x: x, y: y }`)

## Testing

### Frontend (vitest + @testing-library/react)

- **Environment**: jsdom
- **Globals**: `globals: true` — `describe`/`it`/`expect` available without import
- **File placement**: colocated — `foo.tsx` → `foo.test.tsx` in the same directory
- **Test naming**: `describe('ComponentName')` or `describe('functionName()')`, inner `it('does specific thing')`
- **Component render**: import from `@/test/utils` (custom render wrapping global providers)
- **PixiJS components**: difficult to unit test directly — focus on testing data/logic layers, not canvas rendering

### Rust

- `#[cfg(test)] mod tests` in the same file as implementation
- `cargo test -- --test-threads=1` (single-threaded to avoid file watcher conflicts)

## Changelog

- Maintained in `CHANGES.md` at project root
- **Update when**: user-facing feature added, bug fixed, behavior changed, performance improved
- **Do NOT update for**: refactoring, docs-only changes, test-only changes, CI/build changes
- **Format**: `## X.Y.Z` heading + status line + bulleted list of changes
- **References**: `[#123](link)` inline format for PRs/issues
- **Order**: additions first, then changes, then fixes

## Best Practices

- **Performance**: consider PixiJS rendering optimization; avoid unnecessary re-renders
- **Error handling**: never swallow errors in Tauri IPC commands; surface them to the frontend
- **Security**: respect CSP configuration in `tauri.conf.json`; be careful with user data
