//! 프로젝트 모듈의 IPC 데이터 타입.
//!
//! 프론트로 노출되는 모든 struct는 `#[serde(rename_all = "camelCase")]`를 유지해
//! TypeScript 네이밍 컨벤션과 일치시킨다.

use serde::{Deserialize, Serialize};

/// 프로젝트 목록 조회 시 반환되는 요약 정보.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    /// 실제 파일시스템 경로 (예: `/Users/foo/project/weave`).
    pub project_path: String,
    /// Claude Code가 `~/.claude/projects/` 밑에 저장하는 인코딩된 디렉토리 이름.
    pub encoded_name: String,
    /// 해당 프로젝트 디렉토리에 존재하는 메인 세션 JSONL 개수.
    pub session_count: usize,
}
