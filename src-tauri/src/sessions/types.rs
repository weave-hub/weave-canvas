//! 세션 모듈의 IPC 데이터 타입.
//!
//! 프론트로 노출되는 모든 struct는 `#[serde(rename_all = "camelCase")]`를 유지한다.

use serde::{Deserialize, Serialize};

use crate::parser::SessionEvent;

/// 세션 상태 (프론트의 `SessionStatus`와 일치).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionStatus {
    Active,
    Idle,
    Ended,
}

/// 세션 목록 조회 시 반환되는 요약 정보.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub project_path: String,
    pub status: SessionStatus,
    /// 마지막 수정 시각 (유닉스 ms).
    pub last_modified: u64,
    /// 이 세션에 속한 서브에이전트 수.
    pub agent_count: usize,
}

/// 세션 상세 조회 결과. 메인 로그와 서브에이전트 로그의 이벤트 전체를 포함한다.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub session_id: String,
    pub project_path: String,
    pub events: Vec<SessionEvent>,
}
