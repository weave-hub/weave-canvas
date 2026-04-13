//! 프로젝트 도메인.
//!
//! Claude Code가 추적하는 "프로젝트"(= 사용자 작업 디렉토리 단위) 단위의
//! 조회 기능을 담당한다. 세션 단위의 조회는 `sessions` 모듈 참고.

pub mod commands;
pub mod repository;
pub mod types;
