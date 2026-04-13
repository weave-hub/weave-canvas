//! Tauri `#[tauri::command]` 래퍼.
//!
//! 비즈니스 로직은 [`super::repository`]에 pure function으로 두고,
//! 여기는 얇은 어댑터만 유지한다.

use std::time::{Duration, SystemTime};

use crate::fs_utils::get_claude_projects_dir;
use crate::parser::SessionEvent;

use super::repository;
use super::types::{SessionDetail, SessionInfo};

const ACTIVE_WINDOW_SECS: u64 = 5 * 60;

/// 프론트 초기 동기화용: 현재 활성 세션 + 서브에이전트 이벤트 목록을 반환한다.
///
/// 프론트가 마운트된 직후 한 번 호출해서 현재 상태를 pull 해오는 용도.
/// 이후 변경사항은 `session-event` 채널로 push 된다.
///
/// 백그라운드 watcher 의 초기 emit 과는 독립적으로 동작한다 —
/// 즉 watcher 가 프론트 마운트 전에 이미 이벤트를 쏴버려도(레이스 컨디션)
/// 이 커맨드가 파일시스템을 다시 스캔해서 현재 상태를 돌려주므로 안전하다.
///
/// 프론트 사용 예:
/// ```ts
/// import { invoke } from '@tauri-apps/api/core'
/// const events = await invoke<SessionEvent[]>('list_active_sessions')
/// events.forEach(applyEvent)
/// ```
#[tauri::command]
pub async fn list_active_sessions() -> Result<Vec<SessionEvent>, String> {
    let dir = get_claude_projects_dir().map_err(|e| e.to_string())?;
    Ok(repository::scan_active_sessions(
        &dir,
        SystemTime::now(),
        Duration::from_secs(ACTIVE_WINDOW_SECS),
    ))
}

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
