# Weave Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Tauri v2 + React + PixiJS v8 desktop app with real-time file watching infrastructure and multi-session support, ready for visualization features to be layered on.

**Architecture:** Tauri v2 Rust backend watches directories via the `notify` crate and emits file change events to the React frontend through Tauri's event system. React manages UI chrome (toolbar, session tabs). PixiJS v8 owns the main canvas area with GPU-accelerated rendering, custom viewport (pan/zoom), and node rendering. Visualization of specific `.claude` file formats is out of scope — this plan delivers the wiring.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Vite, PixiJS v8, `notify` crate, `serde`/`serde_json`

---

## File Structure

```
weave/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            — Tauri entry point, registers commands and state
│   │   ├── lib.rs             — Crate root, module declarations
│   │   ├── watcher.rs         — DirWatcher: wraps notify crate, callback-based
│   │   ├── session.rs         — SessionManager: manages multiple DirWatchers
│   │   └── commands.rs        — Tauri IPC commands exposed to frontend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── src/
│   ├── main.tsx               — React entry point
│   ├── App.tsx                — Root component: toolbar + SessionTabs + PixiCanvas
│   ├── App.css                — Global styles
│   ├── components/
│   │   ├── PixiCanvas.tsx     — React wrapper for PixiJS Application lifecycle
│   │   └── SessionTabs.tsx    — Tab bar for multi-session switching
│   ├── canvas/
│   │   ├── Viewport.ts        — Pan/zoom viewport (PixiJS Container subclass)
│   │   ├── CanvasNode.ts      — Node display object (PixiJS Container subclass)
│   │   └── SceneManager.ts    — Manages nodes/edges on the PixiJS stage
│   ├── hooks/
│   │   ├── useWatcherEvents.ts — Listen to Tauri file-changed events
│   │   └── useSessions.ts     — Invoke Tauri session commands
│   └── types.ts               — Shared TypeScript types
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── overview.md
└── docs/
```

**Key design decisions:**

- `src/canvas/` is pure PixiJS — no React dependency. Testable independently.
- `PixiCanvas.tsx` is the thin React bridge: manages Application lifecycle, passes events from React state to SceneManager.
- `SceneManager` is the single entry point for mutating the PixiJS scene. React never touches PixiJS display objects directly.

---

### Task 1: Project Scaffolding

**Files:**

- Create: all scaffolded files via `create-tauri-app`
- Modify: `src-tauri/Cargo.toml` (add deps)
- Modify: `package.json` (add deps)

- [ ] **Step 1: Scaffold Tauri v2 + React + TypeScript project**

```bash
cd /tmp
npm create tauri-app@latest weave-init -- --template react-ts --manager npm
```

Expected: project created in `/tmp/weave-init/` with `src/`, `src-tauri/`, `package.json`, etc.

- [ ] **Step 2: Copy scaffolded files into project directory**

```bash
cp -r /tmp/weave-init/src /home/user/Projects/weave/
cp -r /tmp/weave-init/src-tauri /home/user/Projects/weave/
cp /tmp/weave-init/package.json /home/user/Projects/weave/
cp /tmp/weave-init/tsconfig.json /home/user/Projects/weave/
cp /tmp/weave-init/tsconfig.node.json /home/user/Projects/weave/ 2>/dev/null
cp /tmp/weave-init/vite.config.ts /home/user/Projects/weave/
cp /tmp/weave-init/index.html /home/user/Projects/weave/
cp /tmp/weave-init/.gitignore /home/user/Projects/weave/ 2>/dev/null
rm -rf /tmp/weave-init
```

- [ ] **Step 3: Add Rust dependencies**

Edit `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
notify = "8"
notify-debouncer-mini = "0.5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 4: Add npm dependencies**

```bash
cd /home/user/Projects/weave
npm install pixi.js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 5: Configure Vitest**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
}))
```

- [ ] **Step 6: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:

```
.superpowers/
```

- [ ] **Step 7: Verify the app starts**

```bash
cd /home/user/Projects/weave
npm install
cargo tauri dev
```

Expected: a Tauri window opens showing the default React template page.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 + React + TypeScript project

Includes notify, serde, pixi.js, and vitest dependencies."
```

---

### Task 2: Rust File Watcher Module (TDD)

**Files:**

- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Declare watcher module**

In `src-tauri/src/lib.rs`:

```rust
pub mod watcher;
```

- [ ] **Step 2: Write failing test — watcher detects file creation**

Create `src-tauri/src/watcher.rs`:

```rust
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;

pub struct DirWatcher {
    _watcher: RecommendedWatcher,
    rx: mpsc::Receiver<Result<Event, notify::Error>>,
}

pub struct CallbackWatcher {
    _watcher: RecommendedWatcher,
    _handle: std::thread::JoinHandle<()>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Duration;

    #[test]
    fn detects_file_creation() {
        let dir = tempfile::tempdir().unwrap();
        let watcher = DirWatcher::new(dir.path().to_path_buf()).unwrap();

        fs::write(dir.path().join("test.txt"), "hello").unwrap();
        std::thread::sleep(Duration::from_millis(500));

        let events = watcher.poll();
        assert!(!events.is_empty(), "should detect at least one event");
        assert!(
            events.iter().any(|e| e
                .paths
                .iter()
                .any(|p| p.ends_with("test.txt"))),
            "should include test.txt path"
        );
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test -- --test-threads=1
```

Expected: FAIL — `DirWatcher::new` and `DirWatcher::poll` not implemented.

- [ ] **Step 4: Implement DirWatcher::new and poll**

Add above `#[cfg(test)]` in `watcher.rs`:

```rust
impl DirWatcher {
    pub fn new(path: PathBuf) -> Result<Self, notify::Error> {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
        watcher.watch(&path, RecursiveMode::Recursive)?;
        Ok(Self {
            _watcher: watcher,
            rx,
        })
    }

    pub fn poll(&self) -> Vec<Event> {
        let mut events = Vec::new();
        while let Ok(result) = self.rx.try_recv() {
            if let Ok(event) = result {
                events.push(event);
            }
        }
        events
    }
}
```

Also add to `Cargo.toml` under `[dev-dependencies]`:

```toml
tempfile = "3"
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test -- --test-threads=1
```

Expected: PASS

- [ ] **Step 6: Write test — watcher detects file modification**

Add to the `tests` module:

```rust
    #[test]
    fn detects_file_modification() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("existing.txt");
        fs::write(&file_path, "initial").unwrap();
        std::thread::sleep(Duration::from_millis(200));

        let watcher = DirWatcher::new(dir.path().to_path_buf()).unwrap();

        fs::write(&file_path, "modified").unwrap();
        std::thread::sleep(Duration::from_millis(500));

        let events = watcher.poll();
        assert!(!events.is_empty(), "should detect modification event");
    }
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test -- --test-threads=1
```

Expected: PASS

- [ ] **Step 8: Write test — callback-based watcher**

Add to the `tests` module:

```rust
    #[test]
    fn callback_watcher_sends_events() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel::<Event>();

        let _watcher = CallbackWatcher::new(dir.path().to_path_buf(), move |event| {
            let _ = tx.send(event);
        })
        .unwrap();

        fs::write(dir.path().join("callback.txt"), "data").unwrap();
        let event = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(event.paths.iter().any(|p| p.ends_with("callback.txt")));
    }
```

- [ ] **Step 9: Implement CallbackWatcher**

Add above `#[cfg(test)]`:

```rust
impl CallbackWatcher {
    pub fn new<F>(path: PathBuf, on_event: F) -> Result<Self, notify::Error>
    where
        F: Fn(Event) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
        watcher.watch(&path, RecursiveMode::Recursive)?;

        let handle = std::thread::spawn(move || {
            for result in rx {
                if let Ok(event) = result {
                    on_event(event);
                }
            }
        });

        Ok(Self {
            _watcher: watcher,
            _handle: handle,
        })
    }
}
```

- [ ] **Step 10: Run all tests**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test -- --test-threads=1
```

Expected: all 3 tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/watcher.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add file watcher module with notify crate

DirWatcher for polling, CallbackWatcher for event-driven use.
Tested: creation detection, modification detection, callback delivery."
```

---

### Task 3: Rust Session Manager (TDD)

**Files:**

- Create: `src-tauri/src/session.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Declare session module**

In `src-tauri/src/lib.rs`, add:

```rust
pub mod session;
```

- [ ] **Step 2: Write failing test — add and list sessions**

Create `src-tauri/src/session.rs`:

```rust
use crate::watcher::CallbackWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub path: PathBuf,
    pub name: String,
}

pub struct SessionManager {
    sessions: HashMap<String, (Session, CallbackWatcher)>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn add_and_list_sessions() {
        let dir = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        let session = manager
            .add_session(dir.path().to_path_buf(), |_event| {})
            .unwrap();

        assert_eq!(session.path, dir.path());
        assert!(!session.id.is_empty());

        let sessions = manager.list_sessions();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test session -- --test-threads=1
```

Expected: FAIL — `SessionManager::new`, `add_session`, `list_sessions` not implemented.

- [ ] **Step 4: Implement SessionManager**

Add above `#[cfg(test)]`:

```rust
impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn add_session<F>(
        &mut self,
        path: PathBuf,
        on_event: F,
    ) -> Result<Session, notify::Error>
    where
        F: Fn(notify::Event) + Send + 'static,
    {
        let id = format!("{:x}", path_hash(&path));
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        let watcher = CallbackWatcher::new(path.clone(), on_event)?;
        let session = Session {
            id: id.clone(),
            path,
            name,
        };

        self.sessions.insert(id, (session.clone(), watcher));
        Ok(session)
    }

    pub fn list_sessions(&self) -> Vec<Session> {
        self.sessions.values().map(|(s, _)| s.clone()).collect()
    }

    pub fn remove_session(&mut self, id: &str) -> bool {
        self.sessions.remove(id).is_some()
    }
}

fn path_hash(path: &PathBuf) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    hasher.finish()
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test session -- --test-threads=1
```

Expected: PASS

- [ ] **Step 6: Write test — remove session**

Add to tests:

```rust
    #[test]
    fn remove_session() {
        let dir = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        let session = manager
            .add_session(dir.path().to_path_buf(), |_| {})
            .unwrap();

        assert!(manager.remove_session(&session.id));
        assert_eq!(manager.list_sessions().len(), 0);
        assert!(!manager.remove_session("nonexistent"));
    }
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test session -- --test-threads=1
```

Expected: PASS

- [ ] **Step 8: Write test — multiple sessions**

```rust
    #[test]
    fn multiple_sessions() {
        let dir1 = tempfile::tempdir().unwrap();
        let dir2 = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        manager.add_session(dir1.path().to_path_buf(), |_| {}).unwrap();
        manager.add_session(dir2.path().to_path_buf(), |_| {}).unwrap();

        assert_eq!(manager.list_sessions().len(), 2);
    }
```

- [ ] **Step 9: Run test to verify it passes**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test session -- --test-threads=1
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/session.rs src-tauri/src/lib.rs
git commit -m "feat: add session manager for multi-directory watching

SessionManager tracks multiple sessions, each with its own CallbackWatcher.
Sessions identified by path hash, support add/remove/list."
```

---

### Task 4: Tauri IPC Commands and Events

**Files:**

- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Declare commands module and app state**

In `src-tauri/src/lib.rs`, add:

```rust
pub mod commands;

use session::SessionManager;
use std::sync::Mutex;

pub struct AppState {
    pub session_manager: Mutex<SessionManager>,
}
```

- [ ] **Step 2: Create Tauri commands**

Create `src-tauri/src/commands.rs`:

```rust
use crate::session::Session;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub session_id: String,
    pub paths: Vec<PathBuf>,
    pub kind: String,
}

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Vec<Session> {
    let manager = state.session_manager.lock().unwrap();
    manager.list_sessions()
}

#[tauri::command]
pub fn add_session(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    let mut manager = state.session_manager.lock().unwrap();
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path_buf.display()));
    }

    let session_id = format!("{:x}", {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        path_buf.hash(&mut hasher);
        hasher.finish()
    });

    manager
        .add_session(path_buf, move |event| {
            let kind = format!("{:?}", event.kind);
            let payload = FileChangeEvent {
                session_id: session_id.clone(),
                paths: event.paths,
                kind,
            };
            let _ = app.emit("file-changed", &payload);
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_session(id: String, state: State<'_, AppState>) -> bool {
    let mut manager = state.session_manager.lock().unwrap();
    manager.remove_session(&id)
}
```

- [ ] **Step 3: Wire commands into main.rs**

Replace `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use weave_lib::commands::{add_session, list_sessions, remove_session};
use weave_lib::session::SessionManager;
use weave_lib::AppState;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            session_manager: Mutex::new(SessionManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            list_sessions,
            add_session,
            remove_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Note: the crate name in `use` statements depends on the `name` field in `src-tauri/Cargo.toml`. If the package is named `weave` the import is `use weave::...`. Adjust accordingly.

- [ ] **Step 4: Update capabilities**

Edit `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": ["core:default", "core:event:default", "core:event:allow-emit", "core:event:allow-listen"]
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd /home/user/Projects/weave/src-tauri
cargo build
```

Expected: successful compilation.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add Tauri IPC commands for session management

Commands: add_session, remove_session, list_sessions.
Events: file-changed emitted on directory changes."
```

---

### Task 5: PixiJS Canvas — Viewport with Pan/Zoom

**Files:**

- Create: `src/canvas/Viewport.ts`
- Create: `src/canvas/Viewport.test.ts`

- [ ] **Step 1: Write failing test — Viewport initializes with default transform**

Create `src/canvas/Viewport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Viewport } from './Viewport'

describe('Viewport', () => {
  it('initializes at origin with scale 1', () => {
    const vp = new Viewport()
    expect(vp.position.x).toBe(0)
    expect(vp.position.y).toBe(0)
    expect(vp.scale.x).toBe(1)
    expect(vp.scale.y).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/user/Projects/weave
npx vitest run src/canvas/Viewport.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Viewport**

Create `src/canvas/Viewport.ts`:

```ts
import { Container, type FederatedPointerEvent } from 'pixi.js'

export class Viewport extends Container {
  private dragging = false
  private lastPointer = { x: 0, y: 0 }
  private _zoom = 1

  readonly minZoom = 0.1
  readonly maxZoom = 5

  constructor() {
    super()
    this.eventMode = 'static'
    this.hitArea = { contains: () => true }
  }

  /**
   * Call once after adding to stage. Binds wheel events to the canvas element.
   */
  bindToCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault()
        this.handleZoom(e)
      },
      { passive: false },
    )

    this.on('pointerdown', this.onDragStart, this)
    this.on('pointermove', this.onDragMove, this)
    this.on('pointerup', this.onDragEnd, this)
    this.on('pointerupoutside', this.onDragEnd, this)
  }

  get zoom(): number {
    return this._zoom
  }

  private handleZoom(e: WheelEvent): void {
    const direction = e.deltaY < 0 ? 1 : -1
    const factor = 1 + direction * 0.1
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this._zoom * factor))

    // Zoom toward cursor position
    const worldX = (e.offsetX - this.x) / this._zoom
    const worldY = (e.offsetY - this.y) / this._zoom

    this._zoom = newZoom
    this.scale.set(newZoom, newZoom)

    this.x = e.offsetX - worldX * newZoom
    this.y = e.offsetY - worldY * newZoom
  }

  private onDragStart(e: FederatedPointerEvent): void {
    // Middle mouse button or Alt+Left click for pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.dragging = true
      this.lastPointer = { x: e.globalX, y: e.globalY }
    }
  }

  private onDragMove(e: FederatedPointerEvent): void {
    if (!this.dragging) return
    const dx = e.globalX - this.lastPointer.x
    const dy = e.globalY - this.lastPointer.y
    this.x += dx
    this.y += dy
    this.lastPointer = { x: e.globalX, y: e.globalY }
  }

  private onDragEnd(): void {
    this.dragging = false
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.x) / this._zoom,
      y: (screenY - this.y) / this._zoom,
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/user/Projects/weave
npx vitest run src/canvas/Viewport.test.ts
```

Expected: PASS

- [ ] **Step 5: Write test — screenToWorld conversion**

Add to `Viewport.test.ts`:

```ts
it('converts screen to world coordinates at origin', () => {
  const vp = new Viewport()
  const world = vp.screenToWorld(100, 200)
  expect(world.x).toBe(100)
  expect(world.y).toBe(200)
})

it('converts screen to world coordinates when panned', () => {
  const vp = new Viewport()
  vp.x = 50
  vp.y = 100
  const world = vp.screenToWorld(150, 200)
  expect(world.x).toBe(100)
  expect(world.y).toBe(100)
})
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/user/Projects/weave
npx vitest run src/canvas/Viewport.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Viewport.ts src/canvas/Viewport.test.ts
git commit -m "feat: add PixiJS Viewport with pan/zoom

Pan via middle-click or Alt+click drag. Zoom via mouse wheel toward
cursor. Screen-to-world coordinate conversion. Min/max zoom limits."
```

---

### Task 6: PixiJS Canvas — Node Rendering and SceneManager

**Files:**

- Create: `src/canvas/CanvasNode.ts`
- Create: `src/canvas/SceneManager.ts`
- Create: `src/canvas/SceneManager.test.ts`

- [ ] **Step 1: Create CanvasNode display object**

Create `src/canvas/CanvasNode.ts`:

```ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'

export interface CanvasNodeData {
  id: string
  label: string
  x: number
  y: number
  color?: number
}

const LABEL_STYLE = new TextStyle({
  fill: 0xe0e0e0,
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
})

const NODE_WIDTH = 220
const NODE_HEIGHT = 50
const NODE_RADIUS = 8
const NODE_BG = 0x2a2a4a
const NODE_BORDER = 0x3b82f6

export class CanvasNode extends Container {
  readonly nodeId: string
  private bg: Graphics
  private labelText: Text

  constructor(data: CanvasNodeData) {
    super()
    this.nodeId = data.id
    this.position.set(data.x, data.y)
    this.eventMode = 'static'
    this.cursor = 'grab'

    this.bg = new Graphics()
    this.drawBackground(data.color ?? NODE_BORDER)
    this.addChild(this.bg)

    this.labelText = new Text({ text: data.label, style: LABEL_STYLE })
    this.labelText.position.set(12, Math.round((NODE_HEIGHT - this.labelText.height) / 2))
    this.addChild(this.labelText)

    this.setupDrag()
  }

  private drawBackground(borderColor: number): void {
    this.bg
      .clear()
      .roundRect(0, 0, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS)
      .fill({ color: NODE_BG })
      .stroke({ color: borderColor, width: 1.5 })
  }

  private setupDrag(): void {
    let dragging = false
    let offset = { x: 0, y: 0 }

    this.on('pointerdown', (e) => {
      if (e.button !== 0 || e.altKey) return
      dragging = true
      this.cursor = 'grabbing'
      const pos = e.getLocalPosition(this.parent)
      offset = { x: pos.x - this.x, y: pos.y - this.y }
      e.stopPropagation()
    })

    this.on('globalpointermove', (e) => {
      if (!dragging) return
      const pos = e.getLocalPosition(this.parent)
      this.x = pos.x - offset.x
      this.y = pos.y - offset.y
    })

    this.on('pointerup', () => {
      dragging = false
      this.cursor = 'grab'
    })

    this.on('pointerupoutside', () => {
      dragging = false
      this.cursor = 'grab'
    })
  }

  updateLabel(label: string): void {
    this.labelText.text = label
  }
}
```

- [ ] **Step 2: Write failing test — SceneManager adds and retrieves nodes**

Create `src/canvas/SceneManager.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SceneManager } from './SceneManager'
import { Container } from 'pixi.js'

describe('SceneManager', () => {
  it('adds a node and retrieves it by id', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'File created', x: 100, y: 200 })

    expect(scene.getNode('n1')).toBeDefined()
    expect(scene.getNode('n1')!.nodeId).toBe('n1')
    expect(root.children.length).toBe(1)
  })

  it('removes a node by id', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'Test', x: 0, y: 0 })
    scene.removeNode('n1')

    expect(scene.getNode('n1')).toBeUndefined()
    expect(root.children.length).toBe(0)
  })

  it('clears all nodes', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'A', x: 0, y: 0 })
    scene.addNode({ id: 'n2', label: 'B', x: 100, y: 0 })
    scene.clear()

    expect(scene.nodeCount).toBe(0)
    expect(root.children.length).toBe(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/user/Projects/weave
npx vitest run src/canvas/SceneManager.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement SceneManager**

Create `src/canvas/SceneManager.ts`:

```ts
import { Container } from 'pixi.js'
import { CanvasNode, type CanvasNodeData } from './CanvasNode'

export class SceneManager {
  private nodes = new Map<string, CanvasNode>()
  private root: Container

  constructor(root: Container) {
    this.root = root
  }

  addNode(data: CanvasNodeData): CanvasNode {
    const existing = this.nodes.get(data.id)
    if (existing) {
      existing.updateLabel(data.label)
      existing.position.set(data.x, data.y)
      return existing
    }

    const node = new CanvasNode(data)
    this.nodes.set(data.id, node)
    this.root.addChild(node)
    return node
  }

  getNode(id: string): CanvasNode | undefined {
    return this.nodes.get(id)
  }

  removeNode(id: string): boolean {
    const node = this.nodes.get(id)
    if (!node) return false
    this.root.removeChild(node)
    node.destroy()
    this.nodes.delete(id)
    return true
  }

  clear(): void {
    for (const node of this.nodes.values()) {
      this.root.removeChild(node)
      node.destroy()
    }
    this.nodes.clear()
  }

  get nodeCount(): number {
    return this.nodes.size
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/user/Projects/weave
npx vitest run src/canvas/SceneManager.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/canvas/CanvasNode.ts src/canvas/SceneManager.ts src/canvas/SceneManager.test.ts
git commit -m "feat: add CanvasNode and SceneManager for PixiJS scene

CanvasNode: draggable rounded-rect node with label.
SceneManager: add/remove/clear nodes, keyed by id."
```

---

### Task 7: React-PixiJS Bridge Component

**Files:**

- Create: `src/components/PixiCanvas.tsx`
- Create: `src/types.ts`
- Create: `src/hooks/useWatcherEvents.ts`
- Create: `src/hooks/useSessions.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Define shared types**

Create `src/types.ts`:

```ts
export interface Session {
  id: string
  path: string
  name: string
}

export interface FileChangeEvent {
  session_id: string
  paths: string[]
  kind: string
}
```

- [ ] **Step 2: Create PixiCanvas React wrapper**

Create `src/components/PixiCanvas.tsx`:

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { Application } from 'pixi.js'
import { Viewport } from '../canvas/Viewport'
import { SceneManager } from '../canvas/SceneManager'
import type { FileChangeEvent } from '../types'

interface PixiCanvasProps {
  events: FileChangeEvent[]
}

export function PixiCanvas({ events }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const processedCount = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false

    app
      .init({
        background: 0x111122,
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true)
          return
        }

        container.appendChild(app.canvas as HTMLCanvasElement)
        appRef.current = app

        const viewport = new Viewport()
        viewport.bindToCanvas(app.canvas as HTMLCanvasElement)
        app.stage.addChild(viewport)

        sceneRef.current = new SceneManager(viewport)
      })

    return () => {
      cancelled = true
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
        sceneRef.current = null
      }
    }
  }, [])

  // Process new events
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const newEvents = events.slice(processedCount.current)
    processedCount.current = events.length

    for (const event of newEvents) {
      for (let i = 0; i < event.paths.length; i++) {
        const filePath = event.paths[i]
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath
        const kindShort = event.kind.split('(')[0]
        const id = `${event.session_id}-${Date.now()}-${i}`

        scene.addNode({
          id,
          label: `${kindShort}: ${fileName}`,
          x: 100 + Math.random() * 500,
          y: 100 + Math.random() * 300,
        })
      }
    }
  }, [events])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
}
```

- [ ] **Step 3: Create useSessions hook**

Create `src/hooks/useSessions.ts`:

```ts
import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Session } from '../types'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])

  const refresh = useCallback(async () => {
    const result = await invoke<Session[]>('list_sessions')
    setSessions(result)
  }, [])

  const addSession = useCallback(
    async (path: string) => {
      const session = await invoke<Session>('add_session', { path })
      await refresh()
      return session
    },
    [refresh],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await invoke<boolean>('remove_session', { id })
      await refresh()
    },
    [refresh],
  )

  return { sessions, refresh, addSession, removeSession }
}
```

- [ ] **Step 4: Create useWatcherEvents hook**

Create `src/hooks/useWatcherEvents.ts`:

```ts
import { useEffect, useState } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { FileChangeEvent } from '../types'

export function useWatcherEvents() {
  const [events, setEvents] = useState<Map<string, FileChangeEvent[]>>(new Map())

  useEffect(() => {
    let unlisten: UnlistenFn | undefined

    listen<FileChangeEvent>('file-changed', (e) => {
      setEvents((prev) => {
        const next = new Map(prev)
        const sessionEvents = next.get(e.payload.session_id) ?? []
        next.set(e.payload.session_id, [...sessionEvents, e.payload])
        return next
      })
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])

  const clearSession = (sessionId: string) => {
    setEvents((prev) => {
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
  }

  return { events, clearSession }
}
```

- [ ] **Step 5: Wire everything into App.tsx**

Replace `src/App.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { PixiCanvas } from './components/PixiCanvas'
import { useSessions } from './hooks/useSessions'
import { useWatcherEvents } from './hooks/useWatcherEvents'
import './App.css'

function App() {
  const { sessions, addSession, removeSession } = useSessions()
  const { events, clearSession } = useWatcherEvents()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  const handleAddSession = async () => {
    const path = window.prompt('Watch directory path:')
    if (path) {
      try {
        const session = await addSession(path)
        setActiveSessionId(session.id)
      } catch (e) {
        console.error('Failed to add session:', e)
      }
    }
  }

  const handleRemoveSession = async (id: string) => {
    await removeSession(id)
    clearSession(id)
    if (activeSessionId === id) {
      setActiveSessionId(sessions.find((s) => s.id !== id)?.id ?? null)
    }
  }

  const activeEvents = activeSessionId ? (events.get(activeSessionId) ?? []) : []

  return (
    <div className="app">
      <div className="toolbar">
        <span className="title">Weave</span>
        <button onClick={handleAddSession}>+ Add Session</button>
        <span className="session-count">{sessions.length} sessions</span>
      </div>
      {sessions.length > 0 && (
        <div className="session-tabs">
          {sessions.map((s) => {
            const dirName = s.path.split(/[/\\]/).slice(-2, -1)[0] ?? s.path
            return (
              <button
                key={s.id}
                className={`session-tab ${s.id === activeSessionId ? 'active' : ''}`}
                onClick={() => setActiveSessionId(s.id)}
              >
                <span>{dirName}</span>
                <span
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveSession(s.id)
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="canvas-area">
        {activeSessionId ? (
          <PixiCanvas key={activeSessionId} events={activeEvents} />
        ) : (
          <div className="empty-state">
            <p>Add a session to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 6: Add styles**

Replace `src/App.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111122;
  color: #e0e0e0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a4a;
  font-size: 14px;
  flex-shrink: 0;
}

.toolbar .title {
  font-weight: 700;
  font-size: 16px;
}

.toolbar button {
  padding: 4px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.toolbar button:hover {
  background: #2563eb;
}

.toolbar .session-count {
  opacity: 0.6;
  margin-left: auto;
}

.session-tabs {
  display: flex;
  gap: 2px;
  padding: 0 16px;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
}

.session-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  color: #888;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
}

.session-tab.active {
  color: #e0e0e0;
  border-bottom-color: #3b82f6;
}

.session-tab:hover {
  color: #e0e0e0;
}

.tab-close {
  opacity: 0.4;
  font-size: 14px;
}

.tab-close:hover {
  opacity: 1;
}

.canvas-area {
  flex: 1;
  overflow: hidden;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.4;
  font-size: 16px;
}
```

- [ ] **Step 7: Verify visually**

```bash
cd /home/user/Projects/weave
cargo tauri dev
```

Expected: Tauri window shows dark canvas with toolbar. Clicking "+ Add Session" and entering a directory path starts watching. File changes in that directory create draggable nodes on the canvas. Alt+click drag to pan, scroll to zoom.

- [ ] **Step 8: Commit**

```bash
git add src/components/PixiCanvas.tsx src/hooks/useSessions.ts src/hooks/useWatcherEvents.ts src/types.ts src/App.tsx src/App.css
git commit -m "feat: integrate PixiJS canvas with Tauri file watcher

PixiCanvas React wrapper manages PixiJS Application lifecycle.
File change events from Rust backend create draggable nodes on
the GPU-accelerated canvas. Session tabs switch between watchers."
```

---

### Task 8: End-to-End Smoke Test

**Files:**

- No new files

- [ ] **Step 1: Run all Rust tests**

```bash
cd /home/user/Projects/weave/src-tauri
cargo test -- --test-threads=1
```

Expected: all tests PASS.

- [ ] **Step 2: Run all frontend tests**

```bash
cd /home/user/Projects/weave
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Run the full app**

```bash
cd /home/user/Projects/weave
cargo tauri dev
```

- [ ] **Step 4: E2E manual verification**

1. Create test directories:
   ```bash
   mkdir -p /tmp/weave-test-1 /tmp/weave-test-2
   ```
2. Click "+ Add Session", enter `/tmp/weave-test-1`
3. Click "+ Add Session", enter `/tmp/weave-test-2`
4. Verify two tabs appear
5. In terminal:
   ```bash
   echo "test" > /tmp/weave-test-1/file1.txt
   echo "test" > /tmp/weave-test-2/file2.txt
   ```
6. Verify nodes appear on the canvas for the active session
7. Switch tabs — verify different nodes per session (PixiCanvas re-mounts per session via `key`)
8. Drag a node — verify it follows the cursor
9. Alt+click drag — verify canvas pans
10. Scroll wheel — verify canvas zooms toward cursor
11. Click "×" on a tab — verify session removed

- [ ] **Step 5: Fix any issues found**

Address any bugs discovered during E2E testing.

- [ ] **Step 6: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: resolve issues found during E2E smoke test"
```
