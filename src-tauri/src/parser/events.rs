//! 백엔드 → 프론트 공용 데이터 계약.
//!
//! 이 enum은 3군데에서 참조된다:
//! - `parser::jsonl` 에서 JSONL 라인을 변환해 생성
//! - `watcher` 에서 `session-event` 채널로 방출
//! - `sessions::types::SessionDetail` 에서 히스토리 응답에 포함
//!
//! 프론트 `src/types.ts::SessionEvent` 와 1:1 매칭되어야 하므로,
//! 필드 이름 변경 시 반드시 양쪽을 함께 수정한다.

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
    SessionIdle {
        session_id: String,
    },
    SessionActive {
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
