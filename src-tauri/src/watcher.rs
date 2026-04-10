use anyhow::{Context, Result};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher as NotifyWatcher};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::mpsc;
use tokio::time::interval;

use crate::parser::{self, SessionEvent};

const ACTIVE_WINDOW_SECS: u64 = 5 * 60;
const IDLE_THRESHOLD_SECS: u64 = 30;
const RESCAN_INTERVAL_SECS: u64 = 10;
const DEBOUNCE_MS: u64 = 50;

fn get_claude_projects_dir() -> Result<PathBuf> {
    if let Ok(claude_home) = std::env::var("CLAUDE_HOME") {
        if !claude_home.is_empty() {
            return Ok(PathBuf::from(claude_home).join("projects"));
        }
    }
    let home = dirs::home_dir().context("Failed to get home directory")?;
    Ok(home.join(".claude").join("projects"))
}

fn is_main_session_file(path: &Path) -> bool {
    path.extension().is_some_and(|e| e == "jsonl")
        && !path.components().any(|c| c.as_os_str() == "subagents")
        && !path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with("agent-"))
}

fn is_subagent_file(path: &Path) -> bool {
    path.extension().is_some_and(|e| e == "jsonl")
        && path.components().any(|c| c.as_os_str() == "subagents")
        && path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with("agent-"))
}

fn read_agent_type(jsonl_path: &Path) -> Option<String> {
    let meta_path = jsonl_path.with_extension("meta.json");
    let content = fs::read_to_string(&meta_path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;
    val.get("agentType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn session_id_from_path(path: &Path) -> Option<String> {
    path.file_stem().map(|s| s.to_string_lossy().to_string())
}

/// Reconstruct a filesystem path from dash-separated segments.
/// Handles platform-specific root: `/` on Unix, drive letter (e.g. `C:\`) on Windows.
fn reconstruct_path(parts: &[&str]) -> PathBuf {
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
                // Drive letter: "C" → "C:\"
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

/// Resolve encoded directory name to project path.
/// Tries right-to-left to find existing filesystem paths (handles dashes in dir names).
fn resolve_project_path(encoded: &str) -> String {
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

#[derive(Clone)]
struct FileCtx {
    session_id: String,
    agent_id: String,
    is_idle: bool,
}

pub struct SessionWatcher {
    claude_dir: PathBuf,
    file_positions: HashMap<PathBuf, u64>,
    file_contexts: HashMap<PathBuf, FileCtx>,
}

impl SessionWatcher {
    pub fn new() -> Result<Self> {
        let claude_dir = get_claude_projects_dir()?;
        Ok(Self {
            claude_dir,
            file_positions: HashMap::new(),
            file_contexts: HashMap::new(),
        })
    }

    pub fn discover_active_sessions(&mut self) -> Vec<SessionEvent> {
        let mut events = Vec::new();
        let entries = match fs::read_dir(&self.claude_dir) {
            Ok(e) => e,
            Err(_) => return events,
        };
        let now = std::time::SystemTime::now();

        for entry in entries.flatten() {
            let proj_dir = entry.path();
            if !proj_dir.is_dir() {
                continue;
            }

            let project_path = resolve_project_path(&entry.file_name().to_string_lossy());
            let files = match fs::read_dir(&proj_dir) {
                Ok(f) => f,
                Err(_) => continue,
            };

            for file_entry in files.flatten() {
                let path = file_entry.path();
                if !is_main_session_file(&path) {
                    continue;
                }

                let modified = match fs::metadata(&path).and_then(|m| m.modified()) {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let age = now.duration_since(modified).unwrap_or(Duration::MAX);
                if age > Duration::from_secs(ACTIVE_WINDOW_SECS) {
                    continue;
                }

                let session_id = match session_id_from_path(&path) {
                    Some(id) => id,
                    None => continue,
                };

                if !self.file_contexts.contains_key(&path) {
                    self.file_contexts.insert(
                        path.clone(),
                        FileCtx {
                            session_id: session_id.clone(),
                            agent_id: String::new(),
                            is_idle: false,
                        },
                    );
                    if let Ok(meta) = fs::metadata(&path) {
                        self.file_positions.insert(path.clone(), meta.len());
                    }
                    events.push(SessionEvent::SessionDiscovered {
                        session_id: session_id.clone(),
                        project_path: project_path.clone(),
                    });
                    events.extend(self.discover_subagents(&session_id, &proj_dir));
                }
            }
        }
        events
    }

    fn discover_subagents(&mut self, session_id: &str, proj_dir: &Path) -> Vec<SessionEvent> {
        let mut events = Vec::new();
        let sub_dir = proj_dir.join(session_id).join("subagents");
        let entries = match fs::read_dir(&sub_dir) {
            Ok(e) => e,
            Err(_) => return events,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".jsonl") || !name.starts_with("agent-") {
                continue;
            }
            if self.file_contexts.contains_key(&path) {
                continue;
            }

            let agent_id = name
                .trim_start_matches("agent-")
                .trim_end_matches(".jsonl")
                .to_string();
            let agent_type = read_agent_type(&path);

            self.file_contexts.insert(
                path.clone(),
                FileCtx {
                    session_id: session_id.to_string(),
                    agent_id: agent_id.clone(),
                    is_idle: false,
                },
            );
            if let Ok(meta) = fs::metadata(&path) {
                self.file_positions.insert(path.clone(), meta.len());
            }
            events.push(SessionEvent::AgentDiscovered {
                session_id: session_id.to_string(),
                agent_id,
                agent_type,
            });
        }
        events
    }

    pub fn read_new_content(&mut self, path: &Path) -> Vec<SessionEvent> {
        let ctx = match self.file_contexts.get(path) {
            Some(c) => c.clone(),
            None => return vec![],
        };
        let pos = self.file_positions.get(path).copied().unwrap_or(0);
        let mut file = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(_) => return vec![],
        };
        let file_len = match file.metadata() {
            Ok(m) => m.len(),
            Err(_) => return vec![],
        };
        if file_len <= pos {
            return vec![];
        }
        if file.seek(SeekFrom::Start(pos)).is_err() {
            return vec![];
        }

        let reader = BufReader::new(&file);
        let mut events = Vec::new();
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let parsed = parser::parse_line(&line, &ctx.session_id, &ctx.agent_id);
                    events.extend(parsed);
                }
                Err(_) => break,
            }
        }
        self.file_positions.insert(path.to_path_buf(), file_len);
        events
    }

    pub fn cleanup_stale_sessions(&mut self) -> Vec<SessionEvent> {
        let now = std::time::SystemTime::now();
        let mut stale_paths = Vec::new();
        let mut ended_sessions = Vec::new();

        for (path, ctx) in &self.file_contexts {
            if !ctx.agent_id.is_empty() {
                continue;
            }
            let modified = match fs::metadata(path).and_then(|m| m.modified()) {
                Ok(m) => m,
                Err(_) => {
                    stale_paths.push(path.clone());
                    continue;
                }
            };
            let age = now.duration_since(modified).unwrap_or(Duration::MAX);
            if age > Duration::from_secs(ACTIVE_WINDOW_SECS) {
                stale_paths.push(path.clone());
                ended_sessions.push(ctx.session_id.clone());
            }
        }

        let sessions_to_remove: std::collections::HashSet<_> = ended_sessions.iter().collect();
        self.file_contexts
            .retain(|_, ctx| !sessions_to_remove.contains(&ctx.session_id));
        for path in &stale_paths {
            self.file_positions.remove(path);
        }

        ended_sessions
            .into_iter()
            .map(|session_id| SessionEvent::SessionEnded { session_id })
            .collect()
    }

    pub fn check_idle_sessions(&mut self) -> Vec<SessionEvent> {
        let now = std::time::SystemTime::now();
        // Step 1: collect items that need state change (immutable borrow)
        let changes: Vec<(PathBuf, bool)> = self
            .file_contexts
            .iter()
            .filter(|(_, ctx)| ctx.agent_id.is_empty())
            .filter_map(|(path, ctx)| {
                let modified = fs::metadata(path).and_then(|m| m.modified()).ok()?;
                let age = now.duration_since(modified).unwrap_or(Duration::MAX);
                let should_be_idle = age > Duration::from_secs(IDLE_THRESHOLD_SECS);
                if should_be_idle != ctx.is_idle {
                    Some((path.clone(), should_be_idle))
                } else {
                    None
                }
            })
            .collect();

        // Step 2: apply changes (mutable borrow)
        let mut events = Vec::new();
        for (path, now_idle) in changes {
            if let Some(ctx) = self.file_contexts.get_mut(&path) {
                ctx.is_idle = now_idle;
                if now_idle {
                    events.push(SessionEvent::SessionIdle {
                        session_id: ctx.session_id.clone(),
                    });
                } else {
                    events.push(SessionEvent::SessionActive {
                        session_id: ctx.session_id.clone(),
                    });
                }
            }
        }
        events
    }

    #[allow(dead_code)]
    pub fn watched_paths(&self) -> Vec<PathBuf> {
        self.file_contexts.keys().cloned().collect()
    }
}

pub async fn start_watching(app_handle: tauri::AppHandle) {
    let mut watcher = match SessionWatcher::new() {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create session watcher: {}", e);
            return;
        }
    };

    let (notify_tx, mut notify_rx) = mpsc::channel::<PathBuf>(256);
    let tx_clone = notify_tx.clone();
    let mut notify_watcher = match RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                    for path in event.paths {
                        let _ = tx_clone.blocking_send(path);
                    }
                }
            }
        },
        notify::Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create notify watcher: {}", e);
            return;
        }
    };

    let initial_events = watcher.discover_active_sessions();
    for event in &initial_events {
        let _ = app_handle.emit("session-event", event);
    }

    if let Err(e) = notify_watcher.watch(&watcher.claude_dir, RecursiveMode::Recursive) {
        eprintln!("Failed to watch claude dir: {}", e);
    }

    let mut rescan_interval = interval(Duration::from_secs(RESCAN_INTERVAL_SECS));
    let mut debounce_map: HashMap<PathBuf, tokio::time::Instant> = HashMap::new();
    let mut debounce_interval = interval(Duration::from_millis(DEBOUNCE_MS));

    loop {
        tokio::select! {
            Some(path) = notify_rx.recv() => {
                debounce_map.insert(path, tokio::time::Instant::now());
            }
            _ = debounce_interval.tick() => {
                let now = tokio::time::Instant::now();
                let ready: Vec<PathBuf> = debounce_map
                    .iter()
                    .filter(|(_, ts)| now.duration_since(**ts) >= Duration::from_millis(DEBOUNCE_MS))
                    .map(|(p, _)| p.clone())
                    .collect();

                for path in ready {
                    debounce_map.remove(&path);

                    // Immediate session discovery via inotify Create
                    if is_main_session_file(&path) && !watcher.file_contexts.contains_key(&path) {
                        if let Some(session_id) = session_id_from_path(&path) {
                            if let Some(proj_dir) = path.parent() {
                                let project_path = proj_dir
                                    .file_name()
                                    .map(|n| resolve_project_path(&n.to_string_lossy()))
                                    .unwrap_or_default();
                                watcher.file_contexts.insert(
                                    path.clone(),
                                    FileCtx {
                                        session_id: session_id.clone(),
                                        agent_id: String::new(),
                                        is_idle: false,
                                    },
                                );
                                if let Ok(meta) = fs::metadata(&path) {
                                    watcher.file_positions.insert(path.clone(), meta.len());
                                }
                                let _ = app_handle.emit(
                                    "session-event",
                                    &SessionEvent::SessionDiscovered {
                                        session_id: session_id.clone(),
                                        project_path,
                                    },
                                );
                                let sub_events = watcher.discover_subagents(&session_id, proj_dir);
                                for event in &sub_events {
                                    let _ = app_handle.emit("session-event", event);
                                }
                            }
                        }
                    }

                    if is_subagent_file(&path) {
                        if let Some(session_dir) = path.parent().and_then(|p| p.parent()) {
                            if let Some(session_id) = session_dir.file_name().map(|n| n.to_string_lossy().to_string()) {
                                if let Some(proj_dir) = session_dir.parent() {
                                    let events = watcher.discover_subagents(&session_id, proj_dir);
                                    for event in &events {
                                        let _ = app_handle.emit("session-event", event);
                                    }
                                }
                            }
                        }
                    }

                    let events = watcher.read_new_content(&path);
                    for event in &events {
                        let _ = app_handle.emit("session-event", event);
                    }
                }
            }
            _ = rescan_interval.tick() => {
                let new_events = watcher.discover_active_sessions();
                for event in &new_events {
                    let _ = app_handle.emit("session-event", event);
                }
                let idle_events = watcher.check_idle_sessions();
                for event in &idle_events {
                    let _ = app_handle.emit("session-event", event);
                }
                let ended_events = watcher.cleanup_stale_sessions();
                for event in &ended_events {
                    let _ = app_handle.emit("session-event", event);
                }
            }
        }
    }
}
