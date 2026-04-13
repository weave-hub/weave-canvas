//! 세션 조회 비즈니스 로직.
//!
//! 모든 공개 함수는 pure function으로 유지한다. 파일시스템 루트와 필요한
//! 식별자를 파라미터로 받고, 전역 상태를 건드리지 않는다. 시간에 의존하는
//! 함수는 `now: SystemTime` 을 파라미터로 받아 테스트 결정론성을 확보한다.
//!
//! `#[tauri::command]` 래퍼는 `commands.rs`에 있다.

use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

use crate::fs_utils::{is_main_session_file, read_agent_type, resolve_project_path};
use crate::parser::SessionEvent;

use super::types::{SessionDetail, SessionInfo};

/// 현재 활성 상태인 세션들을 스캔해서 이벤트 목록으로 반환한다.
///
/// 프론트 초기 동기화용. `~/.claude/projects/` 루트를 훑어서:
/// 1. `active_window` 이내에 수정된 메인 세션 JSONL 발견 → `SessionDiscovered`
/// 2. 해당 세션의 `subagents/` 아래 `agent-*.jsonl` 발견 → `AgentDiscovered`
///
/// 완전 stateless — 호출할 때마다 파일시스템을 새로 스캔한다.
/// 백그라운드 watcher 와 상태를 공유하지 않는다 (의도적).
///
/// # Parameters
/// - `claude_dir`: Claude Code projects 루트 (`~/.claude/projects` 또는 `$CLAUDE_HOME/projects`)
/// - `now`: "지금" 기준 시각. 테스트 결정론을 위해 파라미터로 받는다.
/// - `active_window`: 이 기간 내 수정된 파일만 active 로 취급
pub fn scan_active_sessions(
    claude_dir: &Path,
    now: SystemTime,
    active_window: Duration,
) -> Vec<SessionEvent> {
    let mut events = Vec::new();

    let project_entries = match fs::read_dir(claude_dir) {
        Ok(entries) => entries,
        Err(_) => return events,
    };

    for proj_entry in project_entries.flatten() {
        let proj_dir = proj_entry.path();
        if !proj_dir.is_dir() {
            continue;
        }

        let encoded_name = proj_entry.file_name().to_string_lossy().to_string();
        let project_path = resolve_project_path(&encoded_name);

        let file_entries = match fs::read_dir(&proj_dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for file_entry in file_entries.flatten() {
            let file_path = file_entry.path();
            if !is_main_session_file(&file_path) {
                continue;
            }

            let modified = match fs::metadata(&file_path).and_then(|m| m.modified()) {
                Ok(t) => t,
                Err(_) => continue,
            };

            let age = now.duration_since(modified).unwrap_or(Duration::MAX);
            if age > active_window {
                continue;
            }

            let session_id = match file_path.file_stem() {
                Some(s) => s.to_string_lossy().to_string(),
                None => continue,
            };

            events.push(SessionEvent::SessionDiscovered {
                session_id: session_id.clone(),
                project_path: project_path.clone(),
            });

            let subagent_dir = proj_dir.join(&session_id).join("subagents");
            events.extend(scan_subagents(&subagent_dir, &session_id));
        }
    }

    events
}

/// 주어진 `subagents/` 디렉토리를 훑어서 `AgentDiscovered` 이벤트 목록을 반환한다.
fn scan_subagents(subagent_dir: &Path, session_id: &str) -> Vec<SessionEvent> {
    let mut events = Vec::new();

    let entries = match fs::read_dir(subagent_dir) {
        Ok(entries) => entries,
        Err(_) => return events,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("agent-") || !name.ends_with(".jsonl") {
            continue;
        }

        let agent_id = name
            .trim_start_matches("agent-")
            .trim_end_matches(".jsonl")
            .to_string();
        let agent_type = read_agent_type(&path);

        events.push(SessionEvent::AgentDiscovered {
            session_id: session_id.to_string(),
            agent_id,
            agent_type,
        });
    }

    events
}

/// 지정된 프로젝트 경로에 속한 세션 목록을 반환한다.
///
/// TODO: TDD로 구현. 최소 시나리오:
/// - 프로젝트 경로가 존재하지 않으면 빈 Vec
/// - 메인 세션(`*.jsonl`)만 나열, 서브에이전트 파일은 집계에만 반영
/// - `last_modified`는 JSONL 파일의 mtime → 유닉스 ms 변환
/// - `status`는 수정 시점 기준으로 active/idle/ended 판단
pub fn collect_sessions(_claude_dir: &Path, _project_path: &str) -> Vec<SessionInfo> {
    Vec::new()
}

/// 단일 세션의 전체 이벤트 히스토리를 반환한다.
///
/// TODO: TDD로 구현. 최소 시나리오:
/// - 메인 JSONL을 처음부터 끝까지 파싱
/// - `subagents/` 디렉토리 하위의 에이전트 JSONL도 함께 파싱
/// - 타임스탬프 순으로 정렬
pub fn load_session_detail(_claude_dir: &Path, _session_id: &str) -> Option<SessionDetail> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;
    use tempfile::TempDir;

    // ── collect_sessions / load_session_detail 기존 스캐폴드 테스트 ──

    #[test]
    fn test_collect_sessions_returns_empty_for_nonexistent_dir() {
        let result = collect_sessions(Path::new("/nonexistent"), "/fake/project");
        assert!(result.is_empty());
    }

    #[test]
    fn test_load_session_detail_returns_none_for_nonexistent_session() {
        let result = load_session_detail(Path::new("/nonexistent"), "session-id");
        assert!(result.is_none());
    }

    // ── scan_active_sessions ────────────────────────────────────────

    const WINDOW: Duration = Duration::from_secs(5 * 60);

    fn future(offset_secs: u64) -> SystemTime {
        SystemTime::now() + Duration::from_secs(offset_secs)
    }

    #[test]
    fn test_scan_returns_empty_for_nonexistent_dir() {
        let result = scan_active_sessions(Path::new("/nonexistent/xyz"), SystemTime::now(), WINDOW);
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_returns_empty_for_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_finds_single_recent_session() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-Users-foo-project-bar");
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join("session-abc.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::SessionDiscovered { session_id, .. } => {
                assert_eq!(session_id, "session-abc");
            }
            other => panic!("Expected SessionDiscovered, got {other:?}"),
        }
    }

    #[test]
    fn test_scan_skips_stale_session_outside_window() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-Users-foo-bar");
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join("session-stale.jsonl"), "").unwrap();

        // "지금" 을 10분 뒤로 설정 → 방금 만든 파일은 10분 묵은 셈
        let result = scan_active_sessions(tmp.path(), future(600), WINDOW);

        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_ignores_non_jsonl_files() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo-project");
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join("README.md"), "").unwrap();
        stdfs::write(proj.join("notes.txt"), "").unwrap();
        stdfs::write(proj.join("session-1.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 1);
        assert!(matches!(result[0], SessionEvent::SessionDiscovered { .. }));
    }

    #[test]
    fn test_scan_ignores_non_directory_entries_in_root() {
        let tmp = TempDir::new().unwrap();
        stdfs::write(tmp.path().join("rogue-file.txt"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_discovers_agents_in_subagents_dir() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo-bar");
        let session_id = "sess-1";
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join(format!("{session_id}.jsonl")), "").unwrap();

        let subagent_dir = proj.join(session_id).join("subagents");
        stdfs::create_dir_all(&subagent_dir).unwrap();
        stdfs::write(subagent_dir.join("agent-abc123.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 2);
        assert!(matches!(result[0], SessionEvent::SessionDiscovered { .. }));
        match &result[1] {
            SessionEvent::AgentDiscovered {
                session_id: sid,
                agent_id,
                agent_type,
            } => {
                assert_eq!(sid, "sess-1");
                assert_eq!(agent_id, "abc123");
                assert_eq!(*agent_type, None);
            }
            other => panic!("Expected AgentDiscovered, got {other:?}"),
        }
    }

    #[test]
    fn test_scan_reads_agent_type_from_meta_json() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo");
        let session_id = "sess-x";
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join(format!("{session_id}.jsonl")), "").unwrap();

        let subagent_dir = proj.join(session_id).join("subagents");
        stdfs::create_dir_all(&subagent_dir).unwrap();
        stdfs::write(subagent_dir.join("agent-xyz.jsonl"), "").unwrap();
        stdfs::write(
            subagent_dir.join("agent-xyz.meta.json"),
            r#"{"agentType":"Explore"}"#,
        )
        .unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 2);
        match &result[1] {
            SessionEvent::AgentDiscovered { agent_type, .. } => {
                assert_eq!(agent_type.as_deref(), Some("Explore"));
            }
            other => panic!("Expected AgentDiscovered, got {other:?}"),
        }
    }

    #[test]
    fn test_scan_ignores_non_agent_files_in_subagents_dir() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo");
        let session_id = "sess-y";
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join(format!("{session_id}.jsonl")), "").unwrap();

        let subagent_dir = proj.join(session_id).join("subagents");
        stdfs::create_dir_all(&subagent_dir).unwrap();
        stdfs::write(subagent_dir.join("other.jsonl"), "").unwrap();
        stdfs::write(subagent_dir.join("agent-abc.txt"), "").unwrap();
        stdfs::write(subagent_dir.join("agent-valid.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        // 1 SessionDiscovered + 1 AgentDiscovered (only agent-valid.jsonl)
        assert_eq!(result.len(), 2);
        match &result[1] {
            SessionEvent::AgentDiscovered { agent_id, .. } => {
                assert_eq!(agent_id, "valid");
            }
            other => panic!("Expected AgentDiscovered, got {other:?}"),
        }
    }

    #[test]
    fn test_scan_returns_session_without_subagents_dir() {
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo");
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join("sess-alone.jsonl"), "").unwrap();
        // subagents/ 디렉토리 자체가 없음

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 1);
        assert!(matches!(result[0], SessionEvent::SessionDiscovered { .. }));
    }

    #[test]
    fn test_scan_handles_multiple_projects() {
        let tmp = TempDir::new().unwrap();

        let proj1 = tmp.path().join("-foo-project1");
        stdfs::create_dir_all(&proj1).unwrap();
        stdfs::write(proj1.join("sess-a.jsonl"), "").unwrap();

        let proj2 = tmp.path().join("-foo-project2");
        stdfs::create_dir_all(&proj2).unwrap();
        stdfs::write(proj2.join("sess-b.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 2);
        // 순서는 OS read_dir 순서에 의존하므로 내용만 검증
        let session_ids: Vec<&str> = result
            .iter()
            .filter_map(|e| match e {
                SessionEvent::SessionDiscovered { session_id, .. } => Some(session_id.as_str()),
                _ => None,
            })
            .collect();
        assert!(session_ids.contains(&"sess-a"));
        assert!(session_ids.contains(&"sess-b"));
    }

    #[test]
    fn test_scan_skips_agent_prefixed_main_jsonl() {
        // 루트 프로젝트 디렉토리에 agent-로 시작하는 jsonl 파일이 있으면
        // 메인 세션으로 간주하지 않아야 한다 (is_main_session_file 정의상).
        let tmp = TempDir::new().unwrap();
        let proj = tmp.path().join("-foo");
        stdfs::create_dir_all(&proj).unwrap();
        stdfs::write(proj.join("agent-rogue.jsonl"), "").unwrap();
        stdfs::write(proj.join("legit-session.jsonl"), "").unwrap();

        let result = scan_active_sessions(tmp.path(), SystemTime::now(), WINDOW);

        assert_eq!(result.len(), 1);
        match &result[0] {
            SessionEvent::SessionDiscovered { session_id, .. } => {
                assert_eq!(session_id, "legit-session");
            }
            other => panic!("Expected SessionDiscovered for legit-session, got {other:?}"),
        }
    }
}
