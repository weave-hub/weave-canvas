use crate::session::{session_id_for_path, Session};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub session_id: String,
    pub paths: Vec<PathBuf>,
    pub kind: String,
}

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    let manager = state.session_manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.list_sessions())
}

#[tauri::command]
pub fn add_session(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    let mut manager = state.session_manager.lock().map_err(|e| e.to_string())?;
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path_buf.display()));
    }

    let session_id = session_id_for_path(&path_buf);

    manager
        .add_session(path_buf, move |event| {
            let kind = format!("{:?}", event.kind);
            let payload = FileChangeEvent {
                session_id: session_id.clone(),
                paths: event.paths,
                kind,
            };
            let _ = app.emit("file-changed", &payload);
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_session(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut manager = state.session_manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.remove_session(&id))
}
