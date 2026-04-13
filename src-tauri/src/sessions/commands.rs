//! Tauri `#[tauri::command]` 래퍼.
//!
//! 비즈니스 로직은 [`super::repository`]에 pure function으로 두고,
//! 여기는 얇은 어댑터만 유지한다.

use crate::fs_utils::get_claude_projects_dir;

use super::repository;
use super::types::{SessionDetail, SessionInfo};

/// 지정된 프로젝트의 세션 목록을 반환한다.
///
/// 프론트 사용 예:
/// ```ts
/// const sessions = await invoke<SessionInfo[]>('list_sessions', {
///   projectPath: '/Users/foo/my-app',
/// })
/// ```
#[tauri::command]
pub async fn list_sessions(project_path: String) -> Result<Vec<SessionInfo>, String> {
    let dir = get_claude_projects_dir().map_err(|e| e.to_string())?;
    Ok(repository::collect_sessions(&dir, &project_path))
}

/// 단일 세션의 이벤트 히스토리를 반환한다.
///
/// 프론트 사용 예:
/// ```ts
/// const detail = await invoke<SessionDetail | null>('get_session_detail', {
///   sessionId: 'abc123',
/// })
/// ```
#[tauri::command]
pub async fn get_session_detail(session_id: String) -> Result<Option<SessionDetail>, String> {
    let dir = get_claude_projects_dir().map_err(|e| e.to_string())?;
    Ok(repository::load_session_detail(&dir, &session_id))
}
