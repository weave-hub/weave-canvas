use crate::watcher::CallbackWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub path: PathBuf,
    pub name: String,
}

pub struct SessionManager {
    sessions: HashMap<String, (Session, CallbackWatcher)>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn add_session<F>(&mut self, path: PathBuf, on_event: F) -> Result<Session, notify::Error>
    where
        F: Fn(notify::Event) + Send + 'static,
    {
        let id = session_id_for_path(&path);
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        let watcher = CallbackWatcher::new(path.clone(), on_event)?;
        let session = Session {
            id: id.clone(),
            path,
            name,
        };

        self.sessions.insert(id, (session.clone(), watcher));
        Ok(session)
    }

    pub fn list_sessions(&self) -> Vec<Session> {
        self.sessions.values().map(|(s, _)| s.clone()).collect()
    }

    pub fn remove_session(&mut self, id: &str) -> bool {
        self.sessions.remove(id).is_some()
    }
}

pub fn session_id_for_path(path: &PathBuf) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn add_and_list_sessions() {
        let dir = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        let session = manager
            .add_session(dir.path().to_path_buf(), |_event| {})
            .unwrap();

        assert_eq!(session.path, dir.path());
        assert!(!session.id.is_empty());

        let sessions = manager.list_sessions();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
    }

    #[test]
    fn remove_session() {
        let dir = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        let session = manager
            .add_session(dir.path().to_path_buf(), |_| {})
            .unwrap();

        assert!(manager.remove_session(&session.id));
        assert_eq!(manager.list_sessions().len(), 0);
        assert!(!manager.remove_session("nonexistent"));
    }

    #[test]
    fn multiple_sessions() {
        let dir1 = tempfile::tempdir().unwrap();
        let dir2 = tempfile::tempdir().unwrap();
        let mut manager = SessionManager::new();

        manager
            .add_session(dir1.path().to_path_buf(), |_| {})
            .unwrap();
        manager
            .add_session(dir2.path().to_path_buf(), |_| {})
            .unwrap();

        assert_eq!(manager.list_sessions().len(), 2);
    }
}
