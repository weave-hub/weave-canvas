use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;

pub struct DirWatcher {
    _watcher: RecommendedWatcher,
    rx: mpsc::Receiver<Result<Event, notify::Error>>,
}

pub struct CallbackWatcher {
    _watcher: RecommendedWatcher,
    _handle: std::thread::JoinHandle<()>,
}

impl DirWatcher {
    pub fn new(path: PathBuf) -> Result<Self, notify::Error> {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
        watcher.watch(&path, RecursiveMode::Recursive)?;
        Ok(Self {
            _watcher: watcher,
            rx,
        })
    }

    pub fn poll(&self) -> Vec<Event> {
        let mut events = Vec::new();
        while let Ok(result) = self.rx.try_recv() {
            if let Ok(event) = result {
                events.push(event);
            }
        }
        events
    }
}

impl CallbackWatcher {
    pub fn new<F>(path: PathBuf, on_event: F) -> Result<Self, notify::Error>
    where
        F: Fn(Event) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;
        watcher.watch(&path, RecursiveMode::Recursive)?;

        let handle = std::thread::spawn(move || {
            for event in rx.into_iter().flatten() {
                on_event(event);
            }
        });

        Ok(Self {
            _watcher: watcher,
            _handle: handle,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Duration;

    #[test]
    fn detects_file_creation() {
        let dir = tempfile::tempdir().unwrap();
        let watcher = DirWatcher::new(dir.path().to_path_buf()).unwrap();

        fs::write(dir.path().join("test.txt"), "hello").unwrap();
        std::thread::sleep(Duration::from_millis(500));

        let events = watcher.poll();
        assert!(!events.is_empty(), "should detect at least one event");
        assert!(
            events
                .iter()
                .any(|e| e.paths.iter().any(|p: &PathBuf| p.ends_with("test.txt"))),
            "should include test.txt path"
        );
    }

    #[test]
    fn detects_file_modification() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("existing.txt");
        fs::write(&file_path, "initial").unwrap();
        std::thread::sleep(Duration::from_millis(200));

        let watcher = DirWatcher::new(dir.path().to_path_buf()).unwrap();

        fs::write(&file_path, "modified").unwrap();
        std::thread::sleep(Duration::from_millis(500));

        let events = watcher.poll();
        assert!(!events.is_empty(), "should detect modification event");
    }

    #[test]
    fn callback_watcher_sends_events() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel::<Event>();

        let _watcher = CallbackWatcher::new(dir.path().to_path_buf(), move |event| {
            let _ = tx.send(event);
        })
        .unwrap();

        fs::write(dir.path().join("callback.txt"), "data").unwrap();
        let event = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(event.paths.iter().any(|p| p.ends_with("callback.txt")));
    }
}
