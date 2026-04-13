//! Weave Tauri 앱 크레이트 루트.
//!
//! - `fs_utils`: 파일시스템 공용 유틸.
//! - `parser`: JSONL → `SessionEvent` 변환.
//! - `watcher`: 백그라운드 파일 감시 + 이벤트 방출.
//! - `projects` / `sessions`: 프론트용 pull API (Tauri command).

pub mod fs_utils;
pub mod parser;
pub mod projects;
pub mod sessions;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            projects::commands::list_projects,
            sessions::commands::list_active_sessions,
            sessions::commands::list_sessions,
            sessions::commands::get_session_detail,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_watching(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
