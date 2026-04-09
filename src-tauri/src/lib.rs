pub mod commands;
pub mod session;
pub mod watcher;

use session::SessionManager;
use std::sync::Mutex;

pub struct AppState {
    pub session_manager: Mutex<SessionManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            session_manager: Mutex::new(SessionManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::add_session,
            commands::remove_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
