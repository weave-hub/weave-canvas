//! 프로젝트 조회 비즈니스 로직.
//!
//! 모든 공개 함수는 파일시스템 루트를 파라미터로 받는 순수 함수로 유지한다.
//! (`tempfile::TempDir` 등으로 단위 테스트 가능하게 하기 위함.)
//!
//! `#[tauri::command]` 래퍼는 `commands.rs`에 있다.

use std::path::Path;

use super::types::ProjectInfo;

/// 지정된 Claude projects 루트 디렉토리 아래에 존재하는 프로젝트 목록을 반환한다.
///
/// TODO: TDD로 구현. 최소 시나리오 체크리스트:
/// - 루트 디렉토리가 존재하지 않으면 빈 Vec
/// - 각 서브디렉토리 = 하나의 프로젝트
/// - `session_count`는 해당 디렉토리 내 메인 세션 JSONL 수 (서브에이전트 제외)
/// - `project_path`는 `fs_utils::resolve_project_path`로 복원
pub fn collect_projects(_claude_dir: &Path) -> Vec<ProjectInfo> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_projects_returns_empty_for_nonexistent_dir() {
        let result = collect_projects(Path::new("/nonexistent/path/for/test"));
        assert!(result.is_empty());
    }
}
