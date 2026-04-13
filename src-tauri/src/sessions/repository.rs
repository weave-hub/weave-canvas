//! 세션 조회 비즈니스 로직.
//!
//! 모든 공개 함수는 pure function으로 유지한다. 파일시스템 루트와 필요한
//! 식별자를 파라미터로 받고, 전역 상태를 건드리지 않는다.
//!
//! `#[tauri::command]` 래퍼는 `commands.rs`에 있다.

use std::path::Path;

use super::types::{SessionDetail, SessionInfo};

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
}
