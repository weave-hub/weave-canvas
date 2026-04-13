//! Claude Code JSONL 라인 → [`SessionEvent`] 변환 로직.
//!
//! 순수 함수 집합. 파일 I/O는 하지 않고, 한 줄의 문자열을 받아
//! 0개 이상의 이벤트로 변환만 담당한다.

use serde::Deserialize;
use serde_json::Value;

use super::events::SessionEvent;

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

/// JSONL 한 줄을 파싱해 0개 이상의 [`SessionEvent`] 를 반환한다.
///
/// `session_id` 와 `agent_id` 는 라인에 해당 필드가 없을 때 쓰는 폴백.
/// 라인 자체에 값이 있으면 그 값이 우선한다.
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

    let effective_session_id = if raw.session_id.is_empty() {
        session_id.to_string()
    } else {
        raw.session_id.clone()
    };

    let effective_agent_id = if raw.agent_id.is_empty() {
        agent_id.to_string()
    } else {
        raw.agent_id.clone()
    };

    match raw.msg_type.as_str() {
        "assistant" => parse_assistant(&raw, &effective_session_id, &effective_agent_id),
        "user" => parse_user(&raw, &effective_session_id, &effective_agent_id),
        _ => vec![],
    }
}

fn parse_assistant(raw: &RawMessage, session_id: &str, agent_id: &str) -> Vec<SessionEvent> {
    let content_arr = match raw.message.get("content") {
        Some(Value::Array(arr)) => arr,
        _ => return vec![],
    };

    let blocks: Vec<ContentBlock> = content_arr
        .iter()
        .filter_map(|v| serde_json::from_value(v.clone()).ok())
        .collect();

    let mut events = Vec::new();
    for block in blocks {
        match block.block_type.as_str() {
            // Emit Thinking for all thinking blocks, even when the text is
            // empty (Claude Code encrypts extended thinking — the block still
            // represents a real thinking step).
            "thinking" => {
                events.push(SessionEvent::Thinking {
                    session_id: session_id.to_string(),
                    agent_id: agent_id.to_string(),
                    timestamp: raw.timestamp.clone(),
                    content: block.thinking,
                });
            }
            "text" if !block.text.is_empty() => {
                events.push(SessionEvent::Text {
                    session_id: session_id.to_string(),
                    agent_id: agent_id.to_string(),
                    timestamp: raw.timestamp.clone(),
                    content: block.text,
                });
            }
            "tool_use" => {
                events.push(SessionEvent::ToolUse {
                    session_id: session_id.to_string(),
                    agent_id: agent_id.to_string(),
                    timestamp: raw.timestamp.clone(),
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

fn parse_user(raw: &RawMessage, session_id: &str, agent_id: &str) -> Vec<SessionEvent> {
    let content = match raw.message.get("content") {
        Some(c) => c,
        None => return vec![],
    };

    if content.is_string() {
        return vec![];
    }

    let arr = match content {
        Value::Array(a) => a,
        _ => return vec![],
    };

    let duration_ms = raw
        .tool_use_result
        .get("durationMs")
        .and_then(|v| v.as_u64());

    let mut events = Vec::new();
    for item in arr {
        if item.get("type").and_then(|v| v.as_str()) != Some("tool_result") {
            continue;
        }

        let tool_id = item
            .get("tool_use_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let content_str = extract_tool_result_content(item.get("content"));

        events.push(SessionEvent::ToolResult {
            session_id: session_id.to_string(),
            agent_id: agent_id.to_string(),
            timestamp: raw.timestamp.clone(),
            tool_id,
            content: content_str,
            duration_ms,
        });
    }
    events
}

fn extract_tool_result_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|item| item.get("text").and_then(|v| v.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── 1. Empty line ────────────────────────────────────────────────────────
    #[test]
    fn test_parse_empty_line() {
        assert!(parse_line("", "s", "a").is_empty());
    }

    // ── 2. Non-assistant/user type ───────────────────────────────────────────
    #[test]
    fn test_parse_non_assistant_user_type() {
        let line =
            r#"{"type":"permission-mode","sessionId":"s","timestamp":"2025-01-01T00:00:00Z"}"#;
        assert!(parse_line(line, "s", "a").is_empty());
    }

    // ── 3. Invalid JSON ──────────────────────────────────────────────────────
    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_line("not json at all", "s", "a").is_empty());
    }

    // ── 4. Thinking block ────────────────────────────────────────────────────
    #[test]
    fn test_parse_thinking() {
        let line = r#"{"type":"assistant","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me think..."}]}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 1);
        match &events[0] {
            SessionEvent::Thinking {
                session_id,
                agent_id,
                content,
                ..
            } => {
                assert_eq!(session_id, "sess-1");
                assert_eq!(agent_id, "ag-1");
                assert_eq!(content, "Let me think...");
            }
            other => panic!("Expected Thinking, got {other:?}"),
        }
    }

    // ── 5. Text block ────────────────────────────────────────────────────────
    #[test]
    fn test_parse_text() {
        let line = r#"{"type":"assistant","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello world"}]}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 1);
        match &events[0] {
            SessionEvent::Text { content, .. } => assert_eq!(content, "Hello world"),
            other => panic!("Expected Text, got {other:?}"),
        }
    }

    // ── 6. ToolUse block ─────────────────────────────────────────────────────
    #[test]
    fn test_parse_tool_use() {
        let line = r#"{"type":"assistant","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls"}}]}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 1);
        match &events[0] {
            SessionEvent::ToolUse {
                tool_name,
                tool_id,
                agent_id,
                ..
            } => {
                assert_eq!(tool_name, "Bash");
                assert_eq!(tool_id, "toolu_01");
                assert_eq!(agent_id, "ag-1");
            }
            other => panic!("Expected ToolUse, got {other:?}"),
        }
    }

    // ── 7. ToolResult with string content and duration_ms ────────────────────
    #[test]
    fn test_parse_tool_result_string_content() {
        let line = r#"{"type":"user","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"output text"}]},"toolUseResult":{"durationMs":42}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 1);
        match &events[0] {
            SessionEvent::ToolResult {
                tool_id,
                content,
                duration_ms,
                ..
            } => {
                assert_eq!(tool_id, "toolu_01");
                assert_eq!(content, "output text");
                assert_eq!(*duration_ms, Some(42));
            }
            other => panic!("Expected ToolResult, got {other:?}"),
        }
    }

    // ── 8. ToolResult with array content ─────────────────────────────────────
    #[test]
    fn test_parse_tool_result_array_content() {
        let line = r#"{"type":"user","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":[{"type":"text","text":"line one"},{"type":"text","text":"line two"}]}]}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 1);
        match &events[0] {
            SessionEvent::ToolResult { content, .. } => {
                assert_eq!(content, "line one\nline two");
            }
            other => panic!("Expected ToolResult, got {other:?}"),
        }
    }

    // ── 9. Multiple content blocks in one assistant line ─────────────────────
    #[test]
    fn test_parse_multiple_content_blocks() {
        let line = r#"{"type":"assistant","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":"pondering"},{"type":"text","text":"answer"},{"type":"tool_use","id":"t1","name":"Read","input":{}}]}}"#;
        let events = parse_line(line, "sess-1", "ag-1");
        assert_eq!(events.len(), 3);
        assert!(matches!(events[0], SessionEvent::Thinking { .. }));
        assert!(matches!(events[1], SessionEvent::Text { .. }));
        assert!(matches!(events[2], SessionEvent::ToolUse { .. }));
    }

    // ── 10. User prompt (string content) is ignored ──────────────────────────
    #[test]
    fn test_parse_user_prompt_ignored() {
        let line = r#"{"type":"user","sessionId":"sess-1","agentId":"ag-1","timestamp":"2025-01-01T00:00:00Z","message":{"role":"user","content":"Please help me"}}"#;
        assert!(parse_line(line, "sess-1", "ag-1").is_empty());
    }
}
