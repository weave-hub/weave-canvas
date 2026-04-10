# Claude Code Session Visualizer - Design Spec

## Overview

Claude Code가 내부적으로 남기는 JSONL 로그 파일을 파일시스템 감시로 실시간 추적/파싱하여, PixiJS 캔버스 위에 노드 그래프로 시각화한다.

### 목표

- 실시간 활성 세션 감시 (히스토리/사후 분석은 스코프 밖)
- 대화 턴, 도구 호출, 서브에이전트, thinking을 캔버스 위 노드로 표현
- 시간축을 따라 노드가 흘러가되, 서브에이전트 생성 시 가지가 갈라지는 트리 구조

## Architecture

```
~/.claude/projects/**/*.jsonl
        |
        v
+-- Rust Backend (Tauri) ----------------------+
|                                               |
|  SessionDiscovery                             |
|    - ~/.claude/projects/ 스캔                 |
|    - 활성 세션 (최근 5분) 필터링               |
|                                               |
|  FileWatcher (notify 크레이트)                |
|    - inotify로 JSONL 변경 감지                |
|    - 50ms 디바운싱                            |
|    - 증분 읽기 (byte position 추적)            |
|                                               |
|  JsonlParser                                  |
|    - 새 라인 파싱                             |
|    - thinking/tool_use/tool_result/text 추출  |
|    - 서브에이전트 발견                         |
|                                               |
|  Tauri Event 발행 ---------------------------+--> "session-event"
|                                               |
+-----------------------------------------------+
        |
        v
+-- React Frontend ----------------------------+
|                                               |
|  useSessionEvents() hook                      |
|    - Tauri event listener                     |
|    - 세션/노드 상태 관리                       |
|                                               |
|  PixiJS Canvas                                |
|    - 노드 렌더링 (타입별 스타일)               |
|    - 엣지(연결선) 렌더링                       |
|    - 시간축 레이아웃 + 에이전트 분기            |
|    - 자동 스크롤 / 팬 / 줌                     |
|                                               |
+-----------------------------------------------+
```

데이터 흐름: JSONL 파일 변경 -> Rust 감지/파싱 -> Tauri event -> React 상태 업데이트 -> PixiJS 렌더링

## Approach

**Rust 백엔드에서 감시 + 파싱** (접근방식 A 선택)

- Tauri Rust 백엔드에서 `notify` 크레이트로 JSONL 파일 감시
- Rust에서 파싱하여 구조화된 이벤트를 프론트엔드로 전달 (Tauri events)
- 프론트엔드는 이벤트를 받아서 PixiJS 노드 렌더링에만 집중
- claude-esp-rs의 파싱/감시 로직을 참고하되, Weave 프로젝트에 맞게 직접 구현

## Data Model

### Rust - SessionEvent (단일 enum)

```rust
enum SessionEvent {
    // 구조
    SessionDiscovered { session_id: String, project_path: String },
    SessionEnded { session_id: String },
    AgentDiscovered { session_id: String, agent_id: String, agent_type: Option<String> },

    // 콘텐츠
    Thinking { session_id: String, agent_id: String, timestamp: String, content: String },
    Text { session_id: String, agent_id: String, timestamp: String, content: String },
    ToolUse { session_id: String, agent_id: String, timestamp: String, tool_id: String, tool_name: String, input: Value },
    ToolResult { session_id: String, agent_id: String, timestamp: String, tool_id: String, content: String, duration_ms: Option<u64> },
}
```

### Frontend - CanvasNode (type 사용)

```typescript
type CanvasNode = {
  id: string
  sessionId: string
  agentId: string
  type: 'thinking' | 'text' | 'tool-use' | 'tool-result'
  timestamp: number
  toolName?: string
  toolId?: string
  content: string
  durationMs?: number
}
```

레인/트리 구조는 렌더링 단계에서 `agentId`로 그룹핑하여 동적으로 생성. 별도 타입으로 미리 정의하지 않음.

## JSONL File Format

Claude Code는 대화 기록을 JSONL 파일로 저장한다:

```
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl          # 메인 세션
~/.claude/projects/<encoded-project-path>/<session-id>/subagents/agent-<id>.jsonl      # 서브에이전트
~/.claude/projects/<encoded-project-path>/<session-id>/subagents/agent-<id>.meta.json  # 서브에이전트 메타
```

### 라인 타입별 구조

**메타 라인** (파서에서 skip):

```json
{ "type": "permission-mode", "permissionMode": "bypassPermissions", "sessionId": "..." }
```

**assistant 메시지** (`message.content[]`에서 thinking, text, tool_use 추출):

```json
{
  "type": "assistant",
  "sessionId": "...",
  "timestamp": "2026-04-10T04:56:38.448Z",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "text", "text": "..." },
      {
        "type": "tool_use",
        "id": "toolu_019...",
        "name": "Bash",
        "input": { "command": "ls" },
        "caller": { "type": "direct" }
      }
    ],
    "usage": { "input_tokens": 3, "output_tokens": 117 }
  }
}
```

**user 메시지** (`message.content[]`에서 tool_result 추출, `toolUseResult.durationMs`에서 duration):

```json
{
  "type": "user",
  "sessionId": "...",
  "timestamp": "2026-04-10T04:56:39.402Z",
  "toolUseResult": { "durationMs": 58 },
  "message": {
    "role": "user",
    "content": [{ "type": "tool_result", "tool_use_id": "toolu_019...", "content": "...", "is_error": true }]
  }
}
```

**tool_result content 형태** (두 가지):

- 문자열: `"content": "file contents here..."`
- 배열: `"content": [{"type": "text", "text": "..."}]`

**subagent meta.json**:

```json
{ "agentType": "Explore", "description": "claude-esp-rs 파싱/감시 로직 분석" }
```

**subagent JSONL** (agentId 필드 포함):

```json
{ "type": "assistant", "sessionId": "...", "agentId": "a1e00599765d54288", "timestamp": "..." }
```

### 샘플 데이터

실제 세션 JSONL 샘플: `docs/samples/8b6c29c8/`

```
docs/samples/8b6c29c8/
  session.jsonl           # 메인 세션 (767라인, 13개 서브에이전트)
  subagents/
    agent-*.jsonl         # 서브에이전트 JSONL
    agent-*.meta.json     # 서브에이전트 메타 정보
```

이 샘플은 파서 구현 시 테스트 픽스처로 활용.

## Rust Backend Design

### 모듈 구조

```
src-tauri/src/
  lib.rs              # Tauri 앱 설정, 이벤트 채널 등록
  watcher.rs          # 파일 감시 + 세션/에이전트 발견
  parser.rs           # JSONL 파싱
```

### watcher.rs - 파일 감시

1. `~/.claude/projects/` 스캔, 활성 세션 필터링 (최근 5분 내 수정된 .jsonl)
2. 각 세션 파일 + `subagents/` 디렉토리에 notify watcher 등록
3. 감시 루프:
   - 파일 변경 감지 (inotify) -> 50ms 디바운싱
   - 마지막 읽은 위치(byte offset)부터 새 라인만 읽기
   - `parser::parse_lines()` 호출 -> Tauri event 발행
4. 10초마다 세션 재스캔:
   - 새 세션 발견 시 watcher 추가
   - 5분 초과 비활성 세션은 watcher 제거
5. `subagents/` 디렉토리 감시:
   - 새 `agent-*.jsonl` 발견 시 `AgentDiscovered` 이벤트 + watcher 등록

핵심:

- `notify` 크레이트로 OS-native 파일 감시 (inotify)
- `HashMap<PathBuf, u64>`로 파일별 byte position 추적 (증분 읽기)
- 세션 재스캔은 주기적, 파일 내용 읽기는 이벤트 기반

### parser.rs - JSONL 파싱

claude-esp-rs 파싱 로직 참고:

- 각 라인은 `type: "assistant" | "user"` 로 구분, 그 외 skip
- `assistant` -> `message.content[]`에서 thinking, text, tool_use 추출
- `user` -> `message.content[]`에서 tool_result 추출
- tool_result content는 문자열 또는 `[{type:"text", text:"..."}]` 배열 두 형태 모두 처리
- duration은 `toolUseResult.durationMs`에서 추출

### Tauri 연동

- 앱 시작 시 백그라운드 태스크로 watcher 자동 가동
- `start_watching` / `stop_watching` 커맨드로 프론트엔드에서 감시 제어
- `list_active_sessions` 커맨드로 세션 목록 조회
- 모든 실시간 데이터는 `app.emit("session-event", ...)` 으로 push

## Frontend Design

### React 상태 관리

```typescript
// hooks/use-session-events.ts

type SessionState = {
  sessionId: string
  projectPath: string
  agents: Map<string, AgentInfo>
  active: boolean
}

type AgentInfo = {
  agentId: string
  agentType?: string
  parentAgentId?: string
}
```

`useSessionEvents()` 훅이 Tauri event listener를 감싸고, `sessions`와 `nodes` 상태를 관리.

### PixiJS 캔버스 렌더링

**노드 타입별 시각 구분**:

- Thinking: 반투명, 둥근 모서리
- ToolUse: 도구명 라벨, 강조색
- ToolResult: ToolUse와 매칭 연결, duration 표시
- Text: 일반 텍스트 노드

**레이아웃 엔진**:

- `agentId`로 노드를 레인별 그룹핑
- 각 레인 내에서 timestamp 순 Y축 배치
- 레인 간 X축 간격 (메인 왼쪽, 서브에이전트 오른쪽)
- `tool_name === "Agent"`인 ToolUse 노드에서 자식 레인으로 연결선
- 새 노드 추가 시 기존 노드 위치 유지, 아래로 확장

**연결선**:

- 같은 레인 내: 위에서 아래 직선
- 레인 분기: bezier 곡선
- ToolUse <-> ToolResult: 점선으로 매칭

**인터랙션**:

- 팬 (드래그)
- 줌 (스크롤 휠)
- 자동 스크롤 (새 노드 생성 시 하단으로 따라감, 토글 가능)

### 컴포넌트 구조

```
app.tsx
  Toolbar         - 감시 시작/중지, 세션 선택
  CanvasArea
    PixiCanvas    - 노드 그래프 렌더링
  SidePanel       - 선택한 노드의 상세 내용 표시
  StatusBar       - 활성 세션 수, 연결 상태
```

- PixiCanvas: 노드 클릭 시 이벤트 발행
- SidePanel: 클릭된 노드의 전체 content 표시 (thinking 전문, tool output 전문 등)
- Toolbar: `start_watching` / `stop_watching` Tauri 커맨드 호출

## Error Handling

| 상황                             | 처리                                     |
| -------------------------------- | ---------------------------------------- |
| `~/.claude/projects/` 없음       | StatusBar에 안내, watcher 대기 상태 유지 |
| JSONL 라인 파싱 실패             | 해당 라인 skip, 다음 라인 계속           |
| 파일 감시 실패 (inotify 한도 등) | polling 폴백 (500ms)                     |
| 활성 세션 0개                    | 캔버스에 빈 상태 안내                    |

## Testing

**Rust**:

- `parser.rs`: `docs/samples/8b6c29c8/` 샘플로 파싱 정확성 단위 테스트
- `watcher.rs`: tempdir에 JSONL 파일 쓰고 이벤트 수신 확인

**Frontend**:

- `useSessionEvents`: mock Tauri event로 상태 업데이트 검증
- 레이아웃 로직: 노드 배치 좌표 계산 순수 함수 테스트

## Conventions

- TypeScript 타입 정의는 `type` 사용 (`interface` 사용 안 함)
- Feature 브랜치에서 작업 (`feat/session-visualizer` 등)
