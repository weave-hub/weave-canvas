//! 공용 파일시스템 유틸리티.
//!
//! Claude Code가 사용하는 `~/.claude/projects/` 디렉토리 레이아웃에 대한
//! 순수 함수 헬퍼만 모아둔다. 도메인 지식(프로젝트/세션/에이전트 의미)은
//! 여기에 두지 않고 feature 모듈(`projects`, `sessions`)에 둔다.

use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

/// Claude Code가 프로젝트별 세션을 저장하는 루트 디렉토리를 해석한다.
///
/// 환경변수 `CLAUDE_HOME`이 설정돼 있으면 `$CLAUDE_HOME/projects`를 사용하고,
/// 없으면 운영체제 홈 디렉토리의 `~/.claude/projects`를 사용한다.
pub fn get_claude_projects_dir() -> Result<PathBuf> {
    if let Ok(claude_home) = std::env::var("CLAUDE_HOME") {
        if !claude_home.is_empty() {
            return Ok(PathBuf::from(claude_home).join("projects"));
        }
    }
    let home = dirs::home_dir().context("Failed to get home directory")?;
    Ok(home.join(".claude").join("projects"))
}

/// 메인 세션 JSONL 파일 경로 여부.
///
/// `.jsonl` 확장자이면서 `subagents/` 하위도 아니고 `agent-` 프리픽스도 아닌 경우.
pub fn is_main_session_file(path: &Path) -> bool {
    path.extension().is_some_and(|e| e == "jsonl")
        && !path.components().any(|c| c.as_os_str() == "subagents")
        && !path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with("agent-"))
}

/// 서브에이전트 JSONL 파일 경로 여부.
///
/// `.jsonl` 확장자이면서 경로에 `subagents/`가 포함되고 파일명이 `agent-`로 시작.
pub fn is_subagent_file(path: &Path) -> bool {
    path.extension().is_some_and(|e| e == "jsonl")
        && path.components().any(|c| c.as_os_str() == "subagents")
        && path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with("agent-"))
}

/// dash-separated 세그먼트로부터 플랫폼별 절대 경로를 조립한다.
///
/// Unix에서는 루트(`/`)부터, Windows에서는 드라이브 레터(예: `C:\`)부터 시작한다.
pub fn reconstruct_path(parts: &[&str]) -> PathBuf {
    let mut path = PathBuf::new();
    let mut parts_iter = parts.iter();

    if let Some(first) = parts_iter.next() {
        #[cfg(unix)]
        {
            path.push("/");
            path.push(first);
        }
        #[cfg(windows)]
        {
            if first.len() == 1 && first.as_bytes()[0].is_ascii_alphabetic() {
                path.push(format!("{}:\\", first));
            } else {
                path.push(first);
            }
        }
    }

    for part in parts_iter {
        path.push(part);
    }

    path
}

/// 서브에이전트 JSONL 옆의 `.meta.json` 에서 `agentType` 필드를 읽는다.
///
/// Claude Code는 서브에이전트 시작 시 `agent-<id>.jsonl` 옆에 `agent-<id>.meta.json`
/// 파일을 만들고 거기에 `{"agentType": "Explore"}` 같은 메타데이터를 기록한다.
/// 파일이 없거나 파싱 실패 시 `None`을 반환한다.
pub fn read_agent_type(jsonl_path: &Path) -> Option<String> {
    let meta_path = jsonl_path.with_extension("meta.json");
    let content = fs::read_to_string(&meta_path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;
    val.get("agentType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Claude Code가 인코딩한 프로젝트 디렉토리 이름을 실제 파일시스템 경로로 해석한다.
///
/// Claude는 프로젝트 경로 `/Users/foo/my-app`을 `-Users-foo-my-app`처럼
/// 대시 구분으로 인코딩한다. 프로젝트 경로 자체에 대시가 포함될 수 있으므로
/// 오른쪽부터 합치면서 실제로 존재하는 경로를 찾는다.
pub fn resolve_project_path(encoded: &str) -> String {
    let encoded = encoded.trim_start_matches('-');
    if encoded.is_empty() {
        return String::new();
    }

    let parts: Vec<&str> = encoded.split('-').collect();
    if parts.is_empty() {
        return encoded.to_string();
    }

    for join_from in (1..parts.len()).rev() {
        let dir_part = parts[join_from..].join("-");
        let mut test_path = reconstruct_path(&parts[..join_from]);
        test_path.push(&dir_part);

        if test_path.exists() {
            return test_path.to_string_lossy().to_string();
        }
    }

    reconstruct_path(&parts).to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── get_claude_projects_dir ─────────────────────────────────────

    #[test]
    fn test_get_claude_projects_dir_uses_env_var() {
        // SAFETY: 테스트는 단일 스레드로 실행되므로 env 조작 OK
        std::env::set_var("CLAUDE_HOME", "/tmp/fake_claude");
        let dir = get_claude_projects_dir().unwrap();
        assert_eq!(dir, PathBuf::from("/tmp/fake_claude/projects"));
        std::env::remove_var("CLAUDE_HOME");
    }

    #[test]
    fn test_get_claude_projects_dir_falls_back_to_home_when_env_empty() {
        std::env::set_var("CLAUDE_HOME", "");
        let dir = get_claude_projects_dir().unwrap();
        assert!(dir.ends_with(".claude/projects"));
        std::env::remove_var("CLAUDE_HOME");
    }

    // ── is_main_session_file ────────────────────────────────────────

    #[test]
    fn test_is_main_session_file_accepts_top_level_jsonl() {
        let path = Path::new("/tmp/projects/abc/session-1.jsonl");
        assert!(is_main_session_file(path));
    }

    #[test]
    fn test_is_main_session_file_rejects_non_jsonl() {
        let path = Path::new("/tmp/projects/abc/session-1.txt");
        assert!(!is_main_session_file(path));
    }

    #[test]
    fn test_is_main_session_file_rejects_subagent_path() {
        let path = Path::new("/tmp/projects/abc/session-1/subagents/agent-x.jsonl");
        assert!(!is_main_session_file(path));
    }

    #[test]
    fn test_is_main_session_file_rejects_agent_prefix() {
        let path = Path::new("/tmp/projects/abc/agent-x.jsonl");
        assert!(!is_main_session_file(path));
    }

    // ── is_subagent_file ────────────────────────────────────────────

    #[test]
    fn test_is_subagent_file_accepts_agent_under_subagents() {
        let path = Path::new("/tmp/projects/abc/session-1/subagents/agent-x.jsonl");
        assert!(is_subagent_file(path));
    }

    #[test]
    fn test_is_subagent_file_rejects_non_agent_under_subagents() {
        let path = Path::new("/tmp/projects/abc/session-1/subagents/other.jsonl");
        assert!(!is_subagent_file(path));
    }

    #[test]
    fn test_is_subagent_file_rejects_agent_outside_subagents() {
        let path = Path::new("/tmp/projects/abc/agent-x.jsonl");
        assert!(!is_subagent_file(path));
    }

    // ── reconstruct_path ────────────────────────────────────────────

    #[cfg(unix)]
    #[test]
    fn test_reconstruct_path_unix_absolute() {
        let parts = ["Users", "foo", "project"];
        let path = reconstruct_path(&parts);
        assert_eq!(path, PathBuf::from("/Users/foo/project"));
    }

    #[cfg(unix)]
    #[test]
    fn test_reconstruct_path_single_segment() {
        let parts = ["tmp"];
        let path = reconstruct_path(&parts);
        assert_eq!(path, PathBuf::from("/tmp"));
    }

    #[test]
    fn test_reconstruct_path_empty() {
        let parts: [&str; 0] = [];
        let path = reconstruct_path(&parts);
        assert_eq!(path, PathBuf::new());
    }

    // ── resolve_project_path ────────────────────────────────────────

    #[test]
    fn test_resolve_project_path_empty_returns_empty() {
        assert_eq!(resolve_project_path(""), "");
    }

    #[test]
    fn test_resolve_project_path_leading_dash_stripped() {
        assert_eq!(resolve_project_path("-"), "");
    }

    #[cfg(unix)]
    #[test]
    fn test_resolve_project_path_nonexistent_falls_back_to_reconstruct() {
        // 존재하지 않는 경로는 reconstruct_path로 조립
        let resolved = resolve_project_path("-Users-nonexistent-foo");
        assert_eq!(resolved, "/Users/nonexistent/foo");
    }
}
