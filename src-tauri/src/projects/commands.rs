//! Tauri `#[tauri::command]` 래퍼.
//!
//! 비즈니스 로직은 [`super::repository`]에 pure function으로 두고,
//! 여기는 얇은 어댑터만 유지한다 (파라미터 파싱 → 에러 변환 → repository 호출).

use crate::fs_utils::get_claude_projects_dir;

use super::repository;
use super::types::ProjectInfo;

/// 사용자의 Claude Code 프로젝트 목록을 반환한다.
///
/// 프론트 사용 예:
/// ```ts
/// import { invoke } from '@tauri-apps/api/core'
/// const projects = await invoke<ProjectInfo[]>('list_projects')
/// ```
#[tauri::command]
pub async fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let dir = get_claude_projects_dir().map_err(|e| e.to_string())?;
    Ok(repository::collect_projects(&dir))
}
