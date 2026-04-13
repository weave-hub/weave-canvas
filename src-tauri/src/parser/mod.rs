//! JSONL 로그 파싱 모듈.
//!
//! - [`events`]: 백엔드/프론트 공용 데이터 계약 `SessionEvent`.
//! - [`jsonl`]: Claude Code JSONL 포맷을 `SessionEvent` 로 변환하는 로직.
//!
//! 외부에서는 `crate::parser::SessionEvent`, `crate::parser::parse_line`
//! 으로 그대로 접근 가능하다 (pub use 재노출).

pub mod events;
pub mod jsonl;

pub use events::SessionEvent;
pub use jsonl::parse_line;
