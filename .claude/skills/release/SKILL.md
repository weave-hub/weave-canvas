---
name: release
description: >-
  Create and publish releases for the Weave app.
  Handles CHANGES.md updates, version bumping across package.json + Cargo.toml +
  tauri.conf.json, tagging, and pushing to trigger the publish workflow.
---

# Release skill

## Overview

Weave uses a simple release model:

- All releases come from the `main` branch
- Tags use `v` prefix (e.g., `v0.2.0`) to trigger the publish workflow
- publish.yml builds for 4 platforms (macOS arm64, macOS x86, Ubuntu, Windows) and creates a GitHub Release

## Prerequisites

1. Verify on `main` branch, up to date with remote:

   ```bash
   git checkout main && git pull
   ```

2. Ensure CI passes:

   ```bash
   pnpm lint && pnpm type-check && pnpm test && cd src-tauri && cargo clippy -- -D warnings && cargo test -- --test-threads=1
   ```

3. Verify remote name:

   ```bash
   git remote -v
   ```

## Release steps

### Step 1: Update changelog

In `CHANGES.md`, find the current version section and change "To be released." to "Released on {Month} {Day}, {Year}." using the current date in English.

```markdown
## 0.2.0

Released on April 15, 2026.
```

### Step 2: Bump version

Update version in **all three files** (they must stay in sync):

1. `package.json` — `"version": "X.Y.Z"`
2. `src-tauri/Cargo.toml` — `version = "X.Y.Z"` under `[package]`
3. `src-tauri/tauri.conf.json` — `"version": "X.Y.Z"`

### Step 3: Commit the release

```bash
git add CHANGES.md package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "Release vX.Y.Z"
```

### Step 4: Create tag

Always use `-m` to provide a tag message (avoids opening an editor for GPG-signed tags):

```bash
git tag -m "Weave vX.Y.Z" vX.Y.Z
```

### Step 5: Prepare next version

1. Add new section at top of `CHANGES.md` for next patch version:

   ```markdown
   ## X.Y.(Z+1)

   To be released.

   ## X.Y.Z

   Released on April 15, 2026.
   ```

2. Bump version in all three files to next patch version.

3. Commit:

   ```bash
   git add CHANGES.md package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "Version bump

   [ci skip]"
   ```

### Step 6: Push

```bash
git push origin vX.Y.Z main
```

This triggers the publish workflow which builds for all 4 platforms and creates a GitHub Release.

## Version sync files

These three files must always have matching versions:

| File                        | Field                       |
| --------------------------- | --------------------------- |
| `package.json`              | `"version"`                 |
| `src-tauri/Cargo.toml`      | `version` under `[package]` |
| `src-tauri/tauri.conf.json` | `"version"`                 |

## Tag format

- Tags: `vX.Y.Z` (with `v` prefix — matches publish.yml trigger pattern `v*`)
- Tag messages: `Weave vX.Y.Z` (use `-m` flag to avoid editor)
- RC tags: `vX.Y.Z-rc.N` (publish.yml creates prerelease instead of draft)

## Checklist

- [ ] On `main` branch, up to date with remote
- [ ] CI passing
- [ ] Update `CHANGES.md` release date
- [ ] Bump version in `package.json`, `Cargo.toml`, `tauri.conf.json`
- [ ] Commit `"Release vX.Y.Z"`
- [ ] Tag `vX.Y.Z` with `-m "Weave vX.Y.Z"`
- [ ] Add next patch version section to `CHANGES.md`
- [ ] Bump to next patch in all three files
- [ ] Commit `"Version bump\n\n[ci skip]"`
- [ ] Push tag and `main`: `git push origin vX.Y.Z main`
