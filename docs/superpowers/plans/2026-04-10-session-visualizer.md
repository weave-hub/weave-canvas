# Session Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code의 JSONL 세션 로그를 실시간 감시/파싱하여 PixiJS 캔버스에 노드 그래프로 시각화한다.

**Architecture:** Rust 백엔드(notify + serde_json)가 `~/.claude/projects/` 하위 JSONL 파일을 감시하고 파싱하여 Tauri event로 프론트엔드에 push. React 프론트엔드는 이벤트를 받아 PixiJS 캔버스에 시간축 + 에이전트 레인 분기 노드 그래프를 렌더링.

**Tech Stack:** Tauri v2, Rust (notify, serde_json, tokio), React 19, PixiJS 8, TypeScript (type 사용, interface 아님)

**Reference:** claude-esp-rs 프로젝트 (`/home/user/Projects/claude-esp-rs/`) — parser.rs, watcher.rs, types.rs 참고.
**Sample data:** `docs/samples/8b6c29c8/` — 767라인 메인 세션 + 13개 서브에이전트.

---

## File Structure

### Rust backend (create)

- `src-tauri/src/parser.rs` — JSONL 라인 파싱. assistant/user 메시지에서 thinking, text, tool_use, tool_result 추출
- `src-tauri/src/watcher.rs` — 파일시스템 감시. 세션 발견, notify 기반 변경 감지, 증분 읽기, 서브에이전트 발견

### Rust backend (modify)

- `src-tauri/src/lib.rs` — watcher 시작, Tauri commands 등록, event emit 연결
- `src-tauri/Cargo.toml` — notify, tokio, chrono, dirs 의존성 추가

### Frontend (create)

- `src/types.ts` — SessionEvent, CanvasNode 등 타입 정의
- `src/hooks/use-session-events.ts` — Tauri event listener 훅, 세션/노드 상태 관리
- `src/canvas/layout.ts` — 노드 좌표 계산 순수 함수 (시간축 + 에이전트 레인)
- `src/canvas/node-renderer.ts` — PixiJS 노드 Graphics 생성 (타입별 스타일)
- `src/canvas/edge-renderer.ts` — PixiJS 연결선 Graphics 생성
- `src/canvas/viewport.ts` — 팬/줌/자동스크롤 제어

### Frontend (modify)

- `src/components/pixi-canvas.tsx` — 레이아웃 엔진 + 렌더러 통합, 노드 클릭 이벤트
- `src/components/canvas-area.tsx` — useSessionEvents 훅 연결, PixiCanvas에 nodes 전달
- `src/components/toolbar.tsx` — 감시 시작/중지 버튼, 세션 선택
- `src/components/side-panel.tsx` — 선택한 노드의 상세 content 표시
- `src/components/status-bar.tsx` — 활성 세션 수, 연결 상태 표시
- `src/app.tsx` — selectedNode 상태 추가, 컴포넌트 간 연결

---

## Task 1: Feature 브랜치 생성

**Files:** none

- [ ] **Step 1: 브랜치 생성**

```bash
cd /home/user/Projects/weave
git checkout -b feat/session-visualizer
```

- [ ] **Step 2: 브랜치 확인**

Run: `git branch --show-current`
Expected: `feat/session-visualizer`

---

## Task 2: Rust 의존성 추가

**Files:**

- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Cargo.toml에 의존성 추가**

`src-tauri/Cargo.toml`의 `[dependencies]` 섹션에 추가:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = "8"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
dirs = "5"
anyhow = "1"
```

- [ ] **Step 2: 빌드 확인**

Run: `cd src-tauri && cargo check`
Expected: 컴파일 성공 (warnings 가능)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add notify, tokio, chrono, dirs dependencies for session watcher"
```

---

## Task 3: Rust JSONL 파서 구현

**Files:**

- Create: `src-tauri/src/parser.rs`
- Modify: `src-tauri/src/lib.rs` (mod 선언)

claude-esp-rs의 `src/parser.rs` 참고. Weave용으로 단순화하되 핵심 파싱 로직은 동일.

- [ ] **Step 1: parser.rs 테스트 작성**

`src-tauri/src/parser.rs` 생성:

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SessionEvent {
    SessionDiscovered {
        session_id: String,
        project_path: String,
    },
    SessionEnded {
        session_id: String,
    },
    AgentDiscovered {
        session_id: String,
        agent_id: String,
        agent_type: Option<String>,
    },
    Thinking {
        session_id: String,
        agent_id: String,
        timestamp: String,
        content: String,
    },
    Text {
        session_id: String,
        agent_id: String,
        timestamp: String,
        content: String,
    },
    ToolUse {
        session_id: String,
        agent_id: String,
        timestamp: String,
        tool_id: String,
        tool_name: String,
        input: Value,
    },
    ToolResult {
        session_id: String,
        agent_id: String,
        timestamp: String,
        tool_id: String,
        content: String,
        duration_ms: Option<u64>,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    agent_id: String,
    session_id: String,
    timestamp: String,
    #[serde(default)]
    message: Value,
    #[serde(default)]
    tool_use_result: Value,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    thinking: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    input: Value,
}

/// JSONL 라인 하나를 파싱하여 SessionEvent 벡터로 반환.
/// 파싱 불가능한 라인은 빈 벡터 반환 (skip).
pub fn parse_line(line: &str, session_id: &str, agent_id: &str) -> Vec<SessionEvent> {
    let line = line.trim();
    if line.is_empty() {
        return vec![];
    }

    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let msg_type = match value.get("type").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return vec![],
    };

    if msg_type != "assistant" && msg_type != "user" {
        return vec![];
    }

    let raw: RawMessage = match serde_json::from_value(value) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    let sid = session_id.to_string();
    let aid = agent_id.to_string();
    let ts = raw.timestamp.clone();

    match raw.msg_type.as_str() {
        "assistant" => parse_assistant(&raw, sid, aid, ts),
        "user" => parse_user(&raw, sid, aid, ts),
        _ => vec![],
    }
}

fn parse_assistant(raw: &RawMessage, session_id: String, agent_id: String, timestamp: String) -> Vec<SessionEvent> {
    let content_arr = match raw.message.get("content").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return vec![],
    };

    let blocks: Vec<ContentBlock> = content_arr
        .iter()
        .filter_map(|v| serde_json::from_value(v.clone()).ok())
        .collect();

    let mut events = Vec::new();

    for block in blocks {
        match block.block_type.as_str() {
            "thinking" if !block.thinking.is_empty() => {
                events.push(SessionEvent::Thinking {
                    session_id: session_id.clone(),
                    agent_id: agent_id.clone(),
                    timestamp: timestamp.clone(),
                    content: block.thinking,
                });
            }
            "text" if !block.text.is_empty() => {
                events.push(SessionEvent::Text {
                    session_id: session_id.clone(),
                    agent_id: agent_id.clone(),
                    timestamp: timestamp.clone(),
                    content: block.text,
                });
            }
            "tool_use" => {
                events.push(SessionEvent::ToolUse {
                    session_id: session_id.clone(),
                    agent_id: agent_id.clone(),
                    timestamp: timestamp.clone(),
                    tool_id: block.id,
                    tool_name: block.name,
                    input: block.input,
                });
            }
            _ => {}
        }
    }

    events
}

fn parse_user(raw: &RawMessage, session_id: String, agent_id: String, timestamp: String) -> Vec<SessionEvent> {
    let content_arr = match raw.message.get("content").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return vec![],
    };

    let duration_ms = raw
        .tool_use_result
        .get("durationMs")
        .and_then(|v| v.as_u64());

    let mut events = Vec::new();

    for item in content_arr {
        if item.get("type").and_then(|v| v.as_str()) != Some("tool_result") {
            continue;
        }

        let tool_use_id = item
            .get("tool_use_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let result_content = extract_tool_result_content(item.get("content"));

        if !result_content.is_empty() {
            events.push(SessionEvent::ToolResult {
                session_id: session_id.clone(),
                agent_id: agent_id.clone(),
                timestamp: timestamp.clone(),
                tool_id: tool_use_id,
                content: result_content,
                duration_ms,
            });
        }
    }

    events
}

fn extract_tool_result_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => {
            arr.iter()
                .filter_map(|item| item.get("text").and_then(|v| v.as_str()))
                .collect::<Vec<_>>()
                .join("\n")
        }
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_line() {
        let result = parse_line("", "sess-1", "");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_non_assistant_user_type() {
        let line = r#"{"type":"permission-mode","permissionMode":"bypassPermissions","sessionId":"abc"}"#;
        let result = parse_line(line, "sess-1", "");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_invalid_json() {
        let result = parse_line("not json", "sess-1", "");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_thinking() {
        let line = r#"{"type":"assistant","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me think..."}]}}"#;
        let result = parse_line(line, "s1", "");
        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::Thinking { content, agent_id, .. } => {
                assert_eq!(content, "Let me think...");
                assert_eq!(agent_id, "");
            }
            _ => panic!("Expected Thinking"),
        }
    }

    #[test]
    fn test_parse_text() {
        let line = r#"{"type":"assistant","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello world"}]}}"#;
        let result = parse_line(line, "s1", "");
        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::Text { content, .. } => assert_eq!(content, "Hello world"),
            _ => panic!("Expected Text"),
        }
    }

    #[test]
    fn test_parse_tool_use() {
        let line = r#"{"type":"assistant","sessionId":"s1","agentId":"agent-1","timestamp":"2026-04-10T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_01","name":"Read","input":{"file_path":"/tmp/test.txt"}}]}}"#;
        let result = parse_line(line, "s1", "agent-1");
        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::ToolUse { tool_name, tool_id, agent_id, .. } => {
                assert_eq!(tool_name, "Read");
                assert_eq!(tool_id, "toolu_01");
                assert_eq!(agent_id, "agent-1");
            }
            _ => panic!("Expected ToolUse"),
        }
    }

    #[test]
    fn test_parse_tool_result_string_content() {
        let line = r#"{"type":"user","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","toolUseResult":{"durationMs":58},"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"file contents here"}]}}"#;
        let result = parse_line(line, "s1", "");
        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::ToolResult { content, duration_ms, tool_id, .. } => {
                assert_eq!(content, "file contents here");
                assert_eq!(*duration_ms, Some(58));
                assert_eq!(tool_id, "toolu_01");
            }
            _ => panic!("Expected ToolResult"),
        }
    }

    #[test]
    fn test_parse_tool_result_array_content() {
        let line = r#"{"type":"user","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":[{"type":"text","text":"line 1"},{"type":"text","text":"line 2"}]}]}}"#;
        let result = parse_line(line, "s1", "");
        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::ToolResult { content, .. } => {
                assert_eq!(content, "line 1\nline 2");
            }
            _ => panic!("Expected ToolResult"),
        }
    }

    #[test]
    fn test_parse_multiple_content_blocks() {
        let line = r#"{"type":"assistant","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"hmm"},{"type":"text","text":"hello"},{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls"}}]}}"#;
        let result = parse_line(line, "s1", "");
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_parse_user_prompt_ignored() {
        let line = r#"{"type":"user","sessionId":"s1","agentId":"","timestamp":"2026-04-10T00:00:00Z","message":{"role":"user","content":"Hello help me"}}"#;
        let result = parse_line(line, "s1", "");
        assert!(result.is_empty());
    }
}
```

- [ ] **Step 2: lib.rs에 mod 선언 추가**

`src-tauri/src/lib.rs` 맨 위에 추가:

```rust
mod parser;
```

- [ ] **Step 3: 테스트 실행**

Run: `cd src-tauri && cargo test -- --test-threads=1`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 샘플 데이터로 통합 테스트**

`src-tauri/src/parser.rs`의 tests 모듈 끝에 추가:

```rust
    #[test]
    fn test_parse_real_sample_first_lines() {
        // docs/samples/8b6c29c8/session.jsonl의 실제 데이터로 검증
        let sample_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("docs/samples/8b6c29c8/session.jsonl");

        if !sample_path.exists() {
            return; // CI에서 샘플 없으면 skip
        }

        let content = std::fs::read_to_string(&sample_path).unwrap();
        let mut total_events = 0;
        let mut has_thinking = false;
        let mut has_tool_use = false;
        let mut has_tool_result = false;

        for line in content.lines() {
            let events = parse_line(line, "test-session", "");
            for event in &events {
                match event {
                    SessionEvent::Thinking { .. } => has_thinking = true,
                    SessionEvent::ToolUse { .. } => has_tool_use = true,
                    SessionEvent::ToolResult { .. } => has_tool_result = true,
                    _ => {}
                }
            }
            total_events += events.len();
        }

        assert!(total_events > 0, "Should parse at least some events from sample");
        assert!(has_thinking, "Sample should contain thinking events");
        assert!(has_tool_use, "Sample should contain tool_use events");
        assert!(has_tool_result, "Sample should contain tool_result events");
    }
```

- [ ] **Step 5: 테스트 실행**

Run: `cd src-tauri && cargo test -- --test-threads=1`
Expected: 모든 테스트 PASS (샘플 통합 테스트 포함)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/parser.rs src-tauri/src/lib.rs
git commit -m "feat: add JSONL parser for Claude Code session events"
```

---

## Task 4: Rust 파일 감시자 구현

**Files:**

- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/lib.rs` (mod 선언)

claude-esp-rs의 `src/watcher.rs` 참고. Weave용으로 단순화 — TUI 관련 코드 제거, Tauri event emit에 집중.

- [ ] **Step 1: watcher.rs 작성**

`src-tauri/src/watcher.rs` 생성:

```rust
use anyhow::{Context, Result};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher as NotifyWatcher};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::mpsc;
use tokio::time::interval;

use crate::parser::{self, SessionEvent};

const ACTIVE_WINDOW_SECS: u64 = 5 * 60;
const RESCAN_INTERVAL_SECS: u64 = 10;
const DEBOUNCE_MS: u64 = 50;

/// Claude projects 디렉토리 경로 반환
fn get_claude_projects_dir() -> Result<PathBuf> {
    if let Ok(claude_home) = std::env::var("CLAUDE_HOME") {
        if !claude_home.is_empty() {
            return Ok(PathBuf::from(claude_home).join("projects"));
        }
    }
    let home = dirs::home_dir().context("Failed to get home directory")?;
    Ok(home.join(".claude").join("projects"))
}

/// .jsonl 파일이 메인 세션 파일인지 확인
fn is_main_session_file(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.ends_with(".jsonl")
        && !path_str.contains("/subagents/")
        && !path
            .file_name()
            .map(|n| n.to_string_lossy().starts_with("agent-"))
            .unwrap_or(false)
}

/// 서브에이전트 meta.json에서 agentType 읽기
fn read_agent_type(jsonl_path: &Path) -> Option<String> {
    let meta_path = jsonl_path.with_extension("meta.json");
    let content = fs::read_to_string(&meta_path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;
    val.get("agentType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 세션 파일에서 세션 ID 추출 (파일명에서 .jsonl 제거)
fn session_id_from_path(path: &Path) -> Option<String> {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
}

/// 인코딩된 디렉토리명에서 프로젝트 경로 추출.
/// 대시가 디렉토리 구분자인지 디렉토리명의 일부인지 구분하기 위해
/// 오른쪽부터 경로 조합을 시도하여 실제 존재하는 경로를 찾는다.
/// (claude-esp-rs resolve_project_path 참고)
fn resolve_project_path(encoded: &str) -> String {
    let encoded = encoded.trim_start_matches('-');
    if encoded.is_empty() {
        return String::new();
    }

    let parts: Vec<&str> = encoded.split('-').collect();
    if parts.is_empty() {
        return encoded.to_string();
    }

    // 오른쪽부터 대시를 디렉토리명의 일부로 간주하며 실제 존재하는 경로를 탐색
    for join_from in (1..parts.len()).rev() {
        let path_part = parts[..join_from].join("/");
        let dir_part = parts[join_from..].join("-");
        let test_path = format!("/{}/{}", path_part, dir_part);

        if Path::new(&test_path).exists() {
            return test_path;
        }
    }

    // 폴백: 단순 변환
    format!("/{}", encoded.replace('-', "/"))
}

/// 감시 대상 파일의 컨텍스트
#[derive(Clone)]
struct FileCtx {
    session_id: String,
    agent_id: String,
}

/// 세션 감시자. Tauri 앱 핸들을 통해 이벤트를 emit.
pub struct SessionWatcher {
    claude_dir: PathBuf,
    file_positions: HashMap<PathBuf, u64>,
    file_contexts: HashMap<PathBuf, FileCtx>,
}

impl SessionWatcher {
    pub fn new() -> Result<Self> {
        let claude_dir = get_claude_projects_dir()?;
        Ok(Self {
            claude_dir,
            file_positions: HashMap::new(),
            file_contexts: HashMap::new(),
        })
    }

    /// 활성 세션 파일 발견 (최근 ACTIVE_WINDOW_SECS 내 수정된 .jsonl)
    pub fn discover_active_sessions(&mut self) -> Vec<SessionEvent> {
        let mut events = Vec::new();

        let entries = match fs::read_dir(&self.claude_dir) {
            Ok(e) => e,
            Err(_) => return events,
        };

        let now = std::time::SystemTime::now();

        for entry in entries.flatten() {
            let proj_dir = entry.path();
            if !proj_dir.is_dir() {
                continue;
            }

            let project_path = resolve_project_path(
                &entry.file_name().to_string_lossy(),
            );

            let files = match fs::read_dir(&proj_dir) {
                Ok(f) => f,
                Err(_) => continue,
            };

            for file_entry in files.flatten() {
                let path = file_entry.path();
                if !is_main_session_file(&path) {
                    continue;
                }

                // 최근 수정 시간 확인
                let modified = match fs::metadata(&path).and_then(|m| m.modified()) {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let age = now.duration_since(modified).unwrap_or(Duration::MAX);
                if age > Duration::from_secs(ACTIVE_WINDOW_SECS) {
                    continue;
                }

                let session_id = match session_id_from_path(&path) {
                    Some(id) => id,
                    None => continue,
                };

                // 세션 등록
                if !self.file_contexts.contains_key(&path) {
                    self.file_contexts.insert(
                        path.clone(),
                        FileCtx {
                            session_id: session_id.clone(),
                            agent_id: String::new(),
                        },
                    );
                    // 파일 끝부터 감시 시작 (기존 히스토리 skip)
                    if let Ok(meta) = fs::metadata(&path) {
                        self.file_positions.insert(path.clone(), meta.len());
                    }

                    events.push(SessionEvent::SessionDiscovered {
                        session_id: session_id.clone(),
                        project_path: project_path.clone(),
                    });

                    // 서브에이전트 발견
                    events.extend(self.discover_subagents(&session_id, &proj_dir));
                }
            }
        }

        events
    }

    /// 세션의 서브에이전트 발견
    fn discover_subagents(&mut self, session_id: &str, proj_dir: &Path) -> Vec<SessionEvent> {
        let mut events = Vec::new();

        let sub_dir = proj_dir.join(session_id).join("subagents");
        let entries = match fs::read_dir(&sub_dir) {
            Ok(e) => e,
            Err(_) => return events,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if !name.ends_with(".jsonl") || !name.starts_with("agent-") {
                continue;
            }

            if self.file_contexts.contains_key(&path) {
                continue;
            }

            // agent-<id>.jsonl -> <id>
            let agent_id = name
                .trim_start_matches("agent-")
                .trim_end_matches(".jsonl")
                .to_string();

            let agent_type = read_agent_type(&path);

            self.file_contexts.insert(
                path.clone(),
                FileCtx {
                    session_id: session_id.to_string(),
                    agent_id: agent_id.clone(),
                },
            );

            if let Ok(meta) = fs::metadata(&path) {
                self.file_positions.insert(path.clone(), meta.len());
            }

            events.push(SessionEvent::AgentDiscovered {
                session_id: session_id.to_string(),
                agent_id,
                agent_type,
            });
        }

        events
    }

    /// 파일의 새 내용을 읽어 SessionEvent로 변환
    pub fn read_new_content(&mut self, path: &Path) -> Vec<SessionEvent> {
        let ctx = match self.file_contexts.get(path) {
            Some(c) => c.clone(),
            None => return vec![],
        };

        let pos = self.file_positions.get(path).copied().unwrap_or(0);

        let mut file = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(_) => return vec![],
        };

        let file_len = match file.metadata() {
            Ok(m) => m.len(),
            Err(_) => return vec![],
        };

        if file_len <= pos {
            return vec![];
        }

        if file.seek(SeekFrom::Start(pos)).is_err() {
            return vec![];
        }

        // BufReader::lines()는 \n을 제거하므로, 정확한 바이트 위치를 위해
        // 파일 끝 위치를 직접 사용한다.
        let reader = BufReader::new(&file);
        let mut events = Vec::new();

        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let parsed = parser::parse_line(&line, &ctx.session_id, &ctx.agent_id);
                    events.extend(parsed);
                }
                Err(_) => break,
            }
        }

        // 파일 끝 위치를 새 position으로 사용 (줄바꿈 문자 차이에 영향받지 않음)
        self.file_positions.insert(path.to_path_buf(), file_len);
        events
    }

    /// 비활성 세션 정리 (ACTIVE_WINDOW_SECS 초과)
    pub fn cleanup_stale_sessions(&mut self) -> Vec<SessionEvent> {
        let now = std::time::SystemTime::now();
        let mut stale_paths = Vec::new();
        let mut ended_sessions = Vec::new();

        for (path, ctx) in &self.file_contexts {
            if !ctx.agent_id.is_empty() {
                continue; // 서브에이전트는 메인 세션과 함께 정리
            }

            let modified = match fs::metadata(path).and_then(|m| m.modified()) {
                Ok(m) => m,
                Err(_) => {
                    stale_paths.push(path.clone());
                    continue;
                }
            };

            let age = now.duration_since(modified).unwrap_or(Duration::MAX);
            if age > Duration::from_secs(ACTIVE_WINDOW_SECS) {
                stale_paths.push(path.clone());
                ended_sessions.push(ctx.session_id.clone());
            }
        }

        // 해당 세션의 모든 파일(서브에이전트 포함) 제거
        let sessions_to_remove: std::collections::HashSet<_> = ended_sessions.iter().collect();
        self.file_contexts.retain(|_, ctx| !sessions_to_remove.contains(&ctx.session_id));
        for path in &stale_paths {
            self.file_positions.remove(path);
        }

        ended_sessions
            .into_iter()
            .map(|session_id| SessionEvent::SessionEnded { session_id })
            .collect()
    }

    /// 감시 중인 모든 파일 경로 반환
    pub fn watched_paths(&self) -> Vec<PathBuf> {
        self.file_contexts.keys().cloned().collect()
    }
}

/// Tauri 앱에서 watcher를 백그라운드로 시작
pub async fn start_watching(app_handle: tauri::AppHandle) {
    let mut watcher = match SessionWatcher::new() {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create session watcher: {}", e);
            return;
        }
    };

    // notify 기반 파일 감시 설정
    let (notify_tx, mut notify_rx) = mpsc::channel::<PathBuf>(256);

    let tx_clone = notify_tx.clone();
    let mut notify_watcher = match RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                    for path in event.paths {
                        let _ = tx_clone.blocking_send(path);
                    }
                }
            }
        },
        notify::Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create notify watcher: {}", e);
            return;
        }
    };

    // 초기 세션 발견
    let initial_events = watcher.discover_active_sessions();
    for event in &initial_events {
        let _ = app_handle.emit("session-event", event);
    }

    // claude projects 디렉토리 감시
    if let Err(e) = notify_watcher.watch(&watcher.claude_dir, RecursiveMode::Recursive) {
        eprintln!("Failed to watch claude dir: {}", e);
    }

    // 디바운싱 + 재스캔 루프
    let mut rescan_interval = interval(Duration::from_secs(RESCAN_INTERVAL_SECS));
    let mut debounce_map: HashMap<PathBuf, tokio::time::Instant> = HashMap::new();
    let mut debounce_interval = interval(Duration::from_millis(DEBOUNCE_MS));

    loop {
        tokio::select! {
            Some(path) = notify_rx.recv() => {
                debounce_map.insert(path, tokio::time::Instant::now());
            }
            _ = debounce_interval.tick() => {
                let now = tokio::time::Instant::now();
                let ready: Vec<PathBuf> = debounce_map
                    .iter()
                    .filter(|(_, ts)| now.duration_since(**ts) >= Duration::from_millis(DEBOUNCE_MS))
                    .map(|(p, _)| p.clone())
                    .collect();

                for path in ready {
                    debounce_map.remove(&path);

                    // 새 서브에이전트 발견 체크
                    if path.to_string_lossy().contains("/subagents/") && path.to_string_lossy().ends_with(".jsonl") {
                        // 서브에이전트가 새로 등장했을 수 있음
                        if let Some(session_dir) = path.parent().and_then(|p| p.parent()) {
                            if let Some(session_id) = session_dir.file_name().map(|n| n.to_string_lossy().to_string()) {
                                if let Some(proj_dir) = session_dir.parent() {
                                    let events = watcher.discover_subagents(&session_id, proj_dir);
                                    for event in &events {
                                        let _ = app_handle.emit("session-event", event);
                                    }
                                }
                            }
                        }
                    }

                    let events = watcher.read_new_content(&path);
                    for event in &events {
                        let _ = app_handle.emit("session-event", event);
                    }
                }
            }
            _ = rescan_interval.tick() => {
                // 새 세션 발견
                let new_events = watcher.discover_active_sessions();
                for event in &new_events {
                    let _ = app_handle.emit("session-event", event);
                }

                // 비활성 세션 정리
                let ended_events = watcher.cleanup_stale_sessions();
                for event in &ended_events {
                    let _ = app_handle.emit("session-event", event);
                }
            }
        }
    }
}
```

- [ ] **Step 2: lib.rs에 mod 선언 추가**

`src-tauri/src/lib.rs`에 `mod watcher;` 추가:

```rust
mod parser;
mod watcher;
```

- [ ] **Step 3: 빌드 확인**

Run: `cd src-tauri && cargo check`
Expected: 컴파일 성공

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/watcher.rs src-tauri/src/lib.rs
git commit -m "feat: add file watcher for Claude Code session monitoring"
```

---

## Task 5: Tauri 연동 — watcher 시작 + commands

**Files:**

- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: lib.rs 전체 교체**

```rust
mod parser;
mod watcher;

use tauri::Manager;

#[tauri::command]
async fn list_active_sessions(app: tauri::AppHandle) -> Result<Vec<parser::SessionEvent>, String> {
    let mut w = watcher::SessionWatcher::new().map_err(|e| e.to_string())?;
    let events: Vec<_> = w
        .discover_active_sessions()
        .into_iter()
        .filter(|e| matches!(e, parser::SessionEvent::SessionDiscovered { .. }))
        .collect();
    Ok(events)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_active_sessions])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_watching(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd src-tauri && cargo check`
Expected: 컴파일 성공

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: wire up session watcher and Tauri commands"
```

---

## Task 6: Frontend 타입 정의

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: types.ts 작성**

```typescript
// src/types.ts

export type SessionEventType =
  | 'sessionDiscovered'
  | 'sessionEnded'
  | 'agentDiscovered'
  | 'thinking'
  | 'text'
  | 'toolUse'
  | 'toolResult'

export type SessionEvent =
  | { type: 'sessionDiscovered'; session_id: string; project_path: string }
  | { type: 'sessionEnded'; session_id: string }
  | { type: 'agentDiscovered'; session_id: string; agent_id: string; agent_type: string | null }
  | { type: 'thinking'; session_id: string; agent_id: string; timestamp: string; content: string }
  | { type: 'text'; session_id: string; agent_id: string; timestamp: string; content: string }
  | {
      type: 'toolUse'
      session_id: string
      agent_id: string
      timestamp: string
      tool_id: string
      tool_name: string
      input: unknown
    }
  | {
      type: 'toolResult'
      session_id: string
      agent_id: string
      timestamp: string
      tool_id: string
      content: string
      duration_ms: number | null
    }

export type CanvasNodeType = 'thinking' | 'text' | 'tool-use' | 'tool-result'

export type CanvasNode = {
  id: string
  sessionId: string
  agentId: string
  type: CanvasNodeType
  timestamp: number
  toolName?: string
  toolId?: string
  content: string
  durationMs?: number
}

export type SessionState = {
  sessionId: string
  projectPath: string
  agents: Map<string, AgentInfo>
  active: boolean
}

export type AgentInfo = {
  agentId: string
  agentType?: string
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript types for session events and canvas nodes"
```

---

## Task 7: useSessionEvents 훅

**Files:**

- Create: `src/hooks/use-session-events.ts`

- [ ] **Step 1: 훅 작성**

```typescript
// src/hooks/use-session-events.ts
import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { CanvasNode, SessionEvent, SessionState, AgentInfo } from '@/types'

function makeNodeId(): string {
  return `node-${crypto.randomUUID()}`
}

function eventToNodes(event: SessionEvent): CanvasNode[] {
  switch (event.type) {
    case 'thinking':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'thinking',
          timestamp: new Date(event.timestamp).getTime(),
          content: event.content,
        },
      ]
    case 'text':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'text',
          timestamp: new Date(event.timestamp).getTime(),
          content: event.content,
        },
      ]
    case 'toolUse':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'tool-use',
          timestamp: new Date(event.timestamp).getTime(),
          toolName: event.tool_name,
          toolId: event.tool_id,
          content: JSON.stringify(event.input),
        },
      ]
    case 'toolResult':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'tool-result',
          timestamp: new Date(event.timestamp).getTime(),
          toolId: event.tool_id,
          content: event.content,
          durationMs: event.duration_ms ?? undefined,
        },
      ]
    default:
      return []
  }
}

export function useSessionEvents() {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(new Map())
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  useEffect(() => {
    const unlisten = listen<SessionEvent>('session-event', ({ payload }) => {
      switch (payload.type) {
        case 'sessionDiscovered': {
          setSessions((prev) => {
            const next = new Map(prev)
            next.set(payload.session_id, {
              sessionId: payload.session_id,
              projectPath: payload.project_path,
              agents: new Map(),
              active: true,
            })
            return next
          })
          break
        }
        case 'sessionEnded': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              next.set(payload.session_id, { ...session, active: false })
            }
            return next
          })
          break
        }
        case 'agentDiscovered': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              const agents = new Map(session.agents)
              agents.set(payload.agent_id, {
                agentId: payload.agent_id,
                agentType: payload.agent_type ?? undefined,
              })
              next.set(payload.session_id, { ...session, agents })
            }
            return next
          })
          break
        }
        default: {
          const newNodes = eventToNodes(payload)
          if (newNodes.length > 0) {
            setNodes((prev) => [...prev, ...newNodes])
          }
        }
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return { sessions, nodes }
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-session-events.ts
git commit -m "feat: add useSessionEvents hook for Tauri event listening"
```

---

## Task 8: 캔버스 레이아웃 엔진

**Files:**

- Create: `src/canvas/layout.ts`

- [ ] **Step 1: layout.ts 작성**

```typescript
// src/canvas/layout.ts
import type { CanvasNode } from '@/types'

const NODE_WIDTH = 200
const NODE_HEIGHT = 60
const NODE_GAP_Y = 20
const LANE_GAP_X = 260
const PADDING_TOP = 40
const PADDING_LEFT = 40

export type NodePosition = {
  nodeId: string
  x: number
  y: number
  width: number
  height: number
  laneIndex: number
}

export type EdgeDef = {
  fromId: string
  toId: string
  type: 'sequence' | 'branch' | 'tool-match'
}

export type LayoutResult = {
  positions: NodePosition[]
  edges: EdgeDef[]
  totalWidth: number
  totalHeight: number
}

export function computeLayout(nodes: CanvasNode[]): LayoutResult {
  if (nodes.length === 0) {
    return { positions: [], edges: [], totalWidth: 0, totalHeight: 0 }
  }

  // 에이전트별 레인 할당
  const laneOrder: string[] = []
  for (const node of nodes) {
    if (!laneOrder.includes(node.agentId)) {
      laneOrder.push(node.agentId)
    }
  }

  // 레인별 노드 그룹핑 (timestamp 순)
  const laneNodes = new Map<string, CanvasNode[]>()
  for (const agentId of laneOrder) {
    laneNodes.set(agentId, [])
  }
  for (const node of nodes) {
    laneNodes.get(node.agentId)!.push(node)
  }
  for (const arr of laneNodes.values()) {
    arr.sort((a, b) => a.timestamp - b.timestamp)
  }

  // 좌표 계산
  const positions: NodePosition[] = []
  const laneYCounters = new Map<string, number>()

  for (let laneIdx = 0; laneIdx < laneOrder.length; laneIdx++) {
    const agentId = laneOrder[laneIdx]
    const laneX = PADDING_LEFT + laneIdx * LANE_GAP_X
    let y = PADDING_TOP

    for (const node of laneNodes.get(agentId)!) {
      positions.push({
        nodeId: node.id,
        x: laneX,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        laneIndex: laneIdx,
      })
      y += NODE_HEIGHT + NODE_GAP_Y
    }

    laneYCounters.set(agentId, y)
  }

  // 엣지 생성
  const edges: EdgeDef[] = []

  // 같은 레인 내 순차 연결
  for (const agentId of laneOrder) {
    const laneNodeList = laneNodes.get(agentId)!
    for (let i = 0; i < laneNodeList.length - 1; i++) {
      edges.push({
        fromId: laneNodeList[i].id,
        toId: laneNodeList[i + 1].id,
        type: 'sequence',
      })
    }
  }

  // Agent tool_use 노드를 시간순으로 수집
  const agentToolUses = nodes
    .filter((n) => n.type === 'tool-use' && n.toolName === 'Agent')
    .sort((a, b) => a.timestamp - b.timestamp)

  // 서브에이전트 레인도 첫 노드 시간순으로 정렬
  const subagentLanes = laneOrder
    .filter((id) => id !== '' && id !== nodes[0]?.agentId)
    .map((id) => ({ agentId: id, firstTimestamp: laneNodes.get(id)?.[0]?.timestamp ?? 0 }))
    .sort((a, b) => a.firstTimestamp - b.firstTimestamp)

  // Agent 호출 순서와 서브에이전트 등장 순서를 1:1 매칭
  for (let i = 0; i < Math.min(agentToolUses.length, subagentLanes.length); i++) {
    const agentNode = agentToolUses[i]
    const subLane = subagentLanes[i]
    const firstNode = laneNodes.get(subLane.agentId)?.[0]
    if (firstNode) {
      edges.push({
        fromId: agentNode.id,
        toId: firstNode.id,
        type: 'branch',
      })
    }
  }

  // ToolUse <-> ToolResult 매칭 (같은 toolId)
  const toolUseById = new Map<string, string>()
  for (const node of nodes) {
    if (node.type === 'tool-use' && node.toolId) {
      toolUseById.set(node.toolId, node.id)
    }
  }
  for (const node of nodes) {
    if (node.type === 'tool-result' && node.toolId) {
      const useNodeId = toolUseById.get(node.toolId)
      if (useNodeId) {
        edges.push({
          fromId: useNodeId,
          toId: node.id,
          type: 'tool-match',
        })
      }
    }
  }

  const maxY = Math.max(...Array.from(laneYCounters.values()), 0)
  const totalWidth = PADDING_LEFT + laneOrder.length * LANE_GAP_X
  const totalHeight = maxY

  return { positions, edges, totalWidth, totalHeight }
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/canvas/layout.ts
git commit -m "feat: add canvas layout engine for node positioning"
```

---

## Task 9: PixiJS 노드 렌더러

**Files:**

- Create: `src/canvas/node-renderer.ts`

- [ ] **Step 1: node-renderer.ts 작성**

```typescript
// src/canvas/node-renderer.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { CanvasNode } from '@/types'
import type { NodePosition } from './layout'

const COLORS = {
  thinking: { bg: 0x3b3b5c, border: 0x7c7cba, text: 0xc8c8ff },
  text: { bg: 0x2d3b2d, border: 0x5c8a5c, text: 0xc8ffc8 },
  'tool-use': { bg: 0x3b3020, border: 0xba8c4c, text: 0xffd88c },
  'tool-result': { bg: 0x203038, border: 0x4c8cba, text: 0x8cd8ff },
} as const

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  wordWrap: true,
  wordWrapWidth: 180,
})

export function createNodeGraphics(node: CanvasNode, pos: NodePosition): Container {
  const container = new Container()
  container.x = pos.x
  container.y = pos.y
  container.label = node.id
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const colors = COLORS[node.type]

  // 배경
  const bg = new Graphics()
  bg.roundRect(0, 0, pos.width, pos.height, 8)
  bg.fill({ color: colors.bg, alpha: 0.9 })
  bg.stroke({ color: colors.border, width: 1.5 })
  container.addChild(bg)

  // 타입 라벨
  const typeLabel = node.type === 'tool-use' ? (node.toolName ?? 'Tool') : node.type
  const durationSuffix = node.type === 'tool-result' && node.durationMs ? ` (${node.durationMs}ms)` : ''

  const label = new Text({
    text: `${typeLabel}${durationSuffix}`,
    style: { ...LABEL_STYLE, fontSize: 11, fill: colors.text },
  })
  label.x = 8
  label.y = 6
  container.addChild(label)

  // 내용 미리보기 (1줄)
  const preview = node.content.split('\n')[0].slice(0, 40)
  if (preview) {
    const previewText = new Text({
      text: preview,
      style: { ...LABEL_STYLE, fontSize: 10, fill: 0x999999 },
    })
    previewText.x = 8
    previewText.y = 28
    container.addChild(previewText)
  }

  return container
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/canvas/node-renderer.ts
git commit -m "feat: add PixiJS node renderer with type-based styling"
```

---

## Task 10: PixiJS 엣지 렌더러

**Files:**

- Create: `src/canvas/edge-renderer.ts`

- [ ] **Step 1: edge-renderer.ts 작성**

```typescript
// src/canvas/edge-renderer.ts
import { Graphics } from 'pixi.js'
import type { NodePosition, EdgeDef } from './layout'

const EDGE_COLORS = {
  sequence: 0x555555,
  branch: 0xba8c4c,
  'tool-match': 0x4c8cba,
} as const

export function drawEdges(graphics: Graphics, edges: EdgeDef[], posMap: Map<string, NodePosition>): void {
  graphics.clear()

  for (const edge of edges) {
    const from = posMap.get(edge.fromId)
    const to = posMap.get(edge.toId)
    if (!from || !to) continue

    const color = EDGE_COLORS[edge.type]
    const fromX = from.x + from.width / 2
    const fromY = from.y + from.height
    const toX = to.x + to.width / 2
    const toY = to.y

    if (edge.type === 'sequence') {
      // 직선
      graphics.moveTo(fromX, fromY)
      graphics.lineTo(toX, toY)
      graphics.stroke({ color, width: 1.5, alpha: 0.6 })
    } else if (edge.type === 'branch') {
      // bezier 곡선
      const midY = (fromY + toY) / 2
      graphics.moveTo(fromX, fromY)
      graphics.bezierCurveTo(fromX, midY, toX, midY, toX, toY)
      graphics.stroke({ color, width: 2, alpha: 0.8 })
    } else if (edge.type === 'tool-match') {
      // 점선 효과 — 짧은 세그먼트로 시뮬레이션
      const segments = 8
      const dx = toX - fromX
      const dy = toY - fromY
      for (let i = 0; i < segments; i += 2) {
        const t0 = i / segments
        const t1 = (i + 1) / segments
        graphics.moveTo(fromX + dx * t0, fromY + dy * t0)
        graphics.lineTo(fromX + dx * t1, fromY + dy * t1)
      }
      graphics.stroke({ color, width: 1, alpha: 0.4 })
    }
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/canvas/edge-renderer.ts
git commit -m "feat: add PixiJS edge renderer with sequence, branch, and tool-match styles"
```

---

## Task 11: 뷰포트 제어 (팬/줌/자동스크롤)

**Files:**

- Create: `src/canvas/viewport.ts`

- [ ] **Step 1: viewport.ts 작성**

```typescript
// src/canvas/viewport.ts
import { Container } from 'pixi.js'

const MIN_SCALE = 0.1
const MAX_SCALE = 3
const ZOOM_FACTOR = 0.1

export type ViewportState = {
  autoScroll: boolean
}

export function setupViewport(stage: Container, canvas: HTMLCanvasElement, state: ViewportState): () => void {
  let isDragging = false
  let lastX = 0
  let lastY = 0

  const onPointerDown = (e: PointerEvent) => {
    // 캔버스 배경 클릭 시에만 팬 시작
    isDragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    stage.x += dx
    stage.y += dy
    lastX = e.clientX
    lastY = e.clientY
    state.autoScroll = false
  }

  const onPointerUp = (e: PointerEvent) => {
    isDragging = false
    canvas.releasePointerCapture(e.pointerId)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const direction = e.deltaY > 0 ? -1 : 1
    const factor = 1 + ZOOM_FACTOR * direction
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, stage.scale.x * factor))

    // 마우스 위치 기준 줌
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldX = (mouseX - stage.x) / stage.scale.x
    const worldY = (mouseY - stage.y) / stage.scale.y

    stage.scale.set(newScale)
    stage.x = mouseX - worldX * newScale
    stage.y = mouseY - worldY * newScale

    state.autoScroll = false
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
  }
}

export function scrollToBottom(stage: Container, canvasHeight: number, contentHeight: number): void {
  const targetY = -(contentHeight * stage.scale.y - canvasHeight + 40)
  if (targetY < 0) {
    stage.y = targetY
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/canvas/viewport.ts
git commit -m "feat: add viewport controls with pan, zoom, and auto-scroll"
```

---

## Task 12: PixiCanvas 통합 — 노드 그래프 렌더링

**Files:**

- Modify: `src/components/pixi-canvas.tsx`

- [ ] **Step 1: pixi-canvas.tsx 전체 교체**

```typescript
// src/components/pixi-canvas.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import type { CanvasNode } from '@/types'
import { computeLayout } from '@/canvas/layout'
import { createNodeGraphics } from '@/canvas/node-renderer'
import { drawEdges } from '@/canvas/edge-renderer'
import { setupViewport, scrollToBottom } from '@/canvas/viewport'
import type { ViewportState } from '@/canvas/viewport'

type PixiCanvasProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
}

export function PixiCanvas({ nodes, onNodeClick }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const edgeGraphicsRef = useRef<Graphics | null>(null)
  const viewportStateRef = useRef<ViewportState>({ autoScroll: true })
  const cleanupViewportRef = useRef<(() => void) | null>(null)

  // PixiJS Application 초기화
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false

    // CSS 변수에서 배경색 추출하여 PixiJS와 앱 테마 동기화
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim()

    app
      .init({
        background: bgColor || 0x111122,
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

        const world = new Container()
        world.label = 'world'
        app.stage.addChild(world)
        worldRef.current = world

        const edgeGraphics = new Graphics()
        edgeGraphics.label = 'edges'
        world.addChild(edgeGraphics)
        edgeGraphicsRef.current = edgeGraphics

        // 뷰포트 설정
        cleanupViewportRef.current = setupViewport(
          world,
          app.canvas as HTMLCanvasElement,
          viewportStateRef.current,
        )
      })

    return () => {
      cancelled = true
      cleanupViewportRef.current?.()
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
      worldRef.current = null
      edgeGraphicsRef.current = null
    }
  }, [])

  // 노드 변경 시 캔버스 업데이트
  useEffect(() => {
    const world = worldRef.current
    const edgeGraphics = edgeGraphicsRef.current
    const app = appRef.current
    if (!world || !edgeGraphics || !app) return

    // 기존 노드 컨테이너 제거 (엣지 Graphics는 유지)
    const toRemove = world.children.filter((c) => c.label !== 'edges')
    for (const child of toRemove) {
      world.removeChild(child)
      child.destroy({ children: true })
    }

    if (nodes.length === 0) return

    // 레이아웃 계산
    const layout = computeLayout(nodes)

    // 노드 렌더링
    const posMap = new Map(layout.positions.map((p) => [p.nodeId, p]))
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    for (const pos of layout.positions) {
      const node = nodeMap.get(pos.nodeId)
      if (!node) continue

      const gfx = createNodeGraphics(node, pos)
      gfx.on('pointertap', () => {
        onNodeClick?.(node)
      })
      world.addChild(gfx)
    }

    // 엣지 렌더링
    drawEdges(edgeGraphics, layout.edges, posMap)

    // 자동 스크롤
    if (viewportStateRef.current.autoScroll) {
      const canvas = app.canvas as HTMLCanvasElement
      scrollToBottom(world, canvas.height / (window.devicePixelRatio || 1), layout.totalHeight)
    }
  }, [nodes, onNodeClick])

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/components/pixi-canvas.tsx
git commit -m "feat: integrate layout engine and renderers into PixiCanvas"
```

---

## Task 13: App 및 UI 컴포넌트 연결

**Files:**

- Modify: `src/app.tsx`
- Modify: `src/components/canvas-area.tsx`
- Modify: `src/components/toolbar.tsx`
- Modify: `src/components/side-panel.tsx`
- Modify: `src/components/status-bar.tsx`

- [ ] **Step 1: app.tsx 수정**

```typescript
// src/app.tsx
import { useCallback, useState } from 'react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { CanvasArea } from './components/canvas-area'
import { StatusBar } from './components/status-bar'
import { useSessionEvents } from './hooks/use-session-events'
import type { CanvasNode } from './types'

function App() {
  const [panelOpen, setPanelOpen] = useState(true)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const { sessions, nodes } = useSessionEvents()

  const handleNodeClick = useCallback((node: CanvasNode) => {
    setSelectedNode(node)
    setPanelOpen(true)
  }, [])

  const activeCount = Array.from(sessions.values()).filter((s) => s.active).length

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar onTogglePanel={() => setPanelOpen((prev) => !prev)} />
      <main className="relative flex-1 overflow-hidden">
        <CanvasArea nodes={nodes} onNodeClick={handleNodeClick} />
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} selectedNode={selectedNode} />
      </main>
      <StatusBar activeSessionCount={activeCount} nodeCount={nodes.length} />
    </div>
  )
}

export default App
```

- [ ] **Step 2: canvas-area.tsx 수정**

```typescript
// src/components/canvas-area.tsx
import { PixiCanvas } from './pixi-canvas'
import type { CanvasNode } from '@/types'

type CanvasAreaProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
}

export function CanvasArea({ nodes, onNodeClick }: CanvasAreaProps) {
  return <PixiCanvas nodes={nodes} onNodeClick={onNodeClick} />
}
```

- [ ] **Step 3: toolbar.tsx 수정 — 타입 변경**

`src/components/toolbar.tsx`에서 `interface`를 `type`으로 변경:

```typescript
// src/components/toolbar.tsx
import { IconLayoutSidebar } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type ToolbarProps = {
  onTogglePanel: () => void
}

export function Toolbar({ onTogglePanel }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card text-card-foreground shrink-0">
      <span className="font-semibold text-sm select-none">Weave</span>
      <Separator orientation="vertical" className="h-4" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="sm" onClick={onTogglePanel} aria-label="Toggle panel">
                <IconLayoutSidebar data-icon="inline-start" />
              </Button>
            }
          />
          <TooltipContent>Toggle panel</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
```

- [ ] **Step 4: side-panel.tsx 수정 — 선택된 노드 표시**

```typescript
// src/components/side-panel.tsx
import { IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import type { CanvasNode } from '@/types'

type SidePanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNode: CanvasNode | null
}

export function SidePanel({ open, onOpenChange, selectedNode }: SidePanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <Card className="absolute left-3 top-3 bottom-3 w-72 z-10 overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedNode ? formatNodeTitle(selectedNode) : 'No Selection'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedNode ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedNode.timestamp).toLocaleTimeString()}
                  {selectedNode.durationMs != null && ` · ${selectedNode.durationMs}ms`}
                </div>
                <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 rounded p-2 max-h-96 overflow-auto">
                  {selectedNode.content}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click a node on the canvas to view details.</p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
      {!open && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-2 top-2 z-10"
          onClick={() => onOpenChange(true)}
          aria-label="Open panel"
        >
          <IconChevronRight data-icon="inline-start" />
        </Button>
      )}
    </Collapsible>
  )
}

function formatNodeTitle(node: CanvasNode): string {
  switch (node.type) {
    case 'thinking':
      return 'Thinking'
    case 'text':
      return 'Text Response'
    case 'tool-use':
      return node.toolName ?? 'Tool Use'
    case 'tool-result':
      return 'Tool Result'
  }
}
```

- [ ] **Step 5: status-bar.tsx 수정 — 세션/노드 수 표시**

```typescript
// src/components/status-bar.tsx

type StatusBarProps = {
  activeSessionCount: number
  nodeCount: number
}

export function StatusBar({ activeSessionCount, nodeCount }: StatusBarProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-4 px-3 py-1 border-t bg-card text-muted-foreground text-xs shrink-0"
    >
      <span>
        {activeSessionCount > 0
          ? `${activeSessionCount} active session${activeSessionCount > 1 ? 's' : ''}`
          : 'No active sessions'}
      </span>
      <span>{nodeCount} nodes</span>
    </div>
  )
}
```

- [ ] **Step 6: 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 7: 린트**

Run: `pnpm lint`
Expected: 에러 없음 (warnings 가능)

- [ ] **Step 8: Commit**

```bash
git add src/app.tsx src/components/canvas-area.tsx src/components/toolbar.tsx src/components/side-panel.tsx src/components/status-bar.tsx
git commit -m "feat: connect session events to canvas and UI components"
```

---

## Task 14: 전체 빌드 및 통합 테스트

**Files:** none (검증만)

- [ ] **Step 1: Rust 테스트**

Run: `cd src-tauri && cargo test -- --test-threads=1`
Expected: 모든 테스트 PASS

- [ ] **Step 2: Rust lint**

Run: `cd src-tauri && cargo clippy -- -D warnings`
Expected: 에러 없음

- [ ] **Step 3: Rust format**

Run: `cd src-tauri && cargo fmt --check`
Expected: 포맷팅 차이 없음

- [ ] **Step 4: Frontend 타입 체크**

Run: `pnpm type-check`
Expected: 에러 없음

- [ ] **Step 5: Frontend 린트**

Run: `pnpm lint`
Expected: 에러 없음

- [ ] **Step 6: Frontend 포맷 체크**

Run: `pnpm format:check`
Expected: 포맷팅 차이 없음

- [ ] **Step 7: Frontend 빌드**

Run: `pnpm build`
Expected: 빌드 성공

- [ ] **Step 8: Tauri 빌드**

Run: `pnpm tauri build`
Expected: 빌드 성공

- [ ] **Step 9: 최종 Commit (필요한 경우)**

빌드 과정에서 수정이 필요했다면 커밋:

```bash
git add -A
git commit -m "fix: resolve build issues from integration"
```
