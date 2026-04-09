# Weave: 전제조건 및 기술 스택 설계

## 프로젝트 개요

Weave는 터미널 기반 AI 코딩 에이전트(Claude Code)의 작업을 실시간으로 시각화하는 로컬 데스크톱 애플리케이션이다. 바이브코딩 시대에 개발자의 "감독" 행위에서 발생하는 인지부하(지각, 주의, 작업기억, 판단, 결정 부하)를 캔버스 기반 시각화로 줄이는 것이 목표다.

## 전제조건

| 항목          | 결정                                   | 근거                                            |
| ------------- | -------------------------------------- | ----------------------------------------------- |
| 배포 형태     | 로컬 데스크톱 앱                       | 터미널 옆에서 독립 실행, 네트워크 의존성 없음   |
| 데이터 수집   | `.claude` 디렉토리 파일 파싱           | Claude Code의 로그/세션 파일을 직접 읽어서 파싱 |
| 모니터링 방식 | 실시간 (Live)                          | 감독은 실시간 행위. 파일 watching으로 변경 감지 |
| 에이전트 범위 | Claude Code만                          | 초기 버전은 단일 에이전트에 집중                |
| 세션          | 다중 세션 동시 모니터링                | worktree, subagent 등 병렬 세션 지원            |
| 타겟 OS       | 크로스플랫폼 (Linux + macOS + Windows) | ARM64 Linux(DGX Spark) 포함                     |
| UI 스타일     | 캔버스 (Figma/Miro 스타일)             | 자유로운 공간에 노드를 배치하는 방식            |

## 기술 스택

### 선정: Tauri v2 + React + PixiJS v8

4개 후보(Electron, Tauri v2, egui, Iced)를 10개 기준으로 평가한 결과 Tauri v2가 43/50으로 최고점.
캔버스 라이브러리는 React Flow 대신 **PixiJS v8**을 선택한다.

#### React Flow 대신 PixiJS v8을 선택한 이유

1. **시각적 자유도**: React Flow는 DOM 기반 노드 그래프 에디터로, 시각 표현이 HTML/CSS에 제한됨. PixiJS는 GPU 가속 2D 렌더링 엔진으로 파티클, 애니메이션, 커스텀 셰이더 등 자유로운 시각 표현 가능
2. **성능**: PixiJS v8은 WebGPU(fallback: WebGL) 기반으로 수천 개 이상의 요소를 60fps로 렌더링. React Flow는 DOM 기반이라 대량 노드에서 성능 저하
3. **캔버스 경험**: Figma/Miro 수준의 자유로운 캔버스를 목표로 하므로 "다이어그램 에디터"인 React Flow보다 범용 2D 엔진이 적합

#### 트레이드오프

- Pan/zoom, 노드 드래그, 선택 등의 인터랙션을 직접 구현해야 함
- React와의 통합이 명령형(imperative)이므로 선언형 React 패턴과 다름
- 이 트레이드오프는 시각적 자유도와 성능으로 상쇄됨

### 프레임워크 비교 요약

| 기준              | Electron       | Tauri v2        | egui            | Iced                |
| ----------------- | -------------- | --------------- | --------------- | ------------------- |
| 번들 크기         | 1 (80-200MB)   | 5 (2-10MB)      | 4 (7-25MB)      | 5 (3-6MB)           |
| 메모리 사용량     | 1 (150-300MB)  | 4 (30-100MB)    | 3 (30-160MB)    | 3 (76-200MB)        |
| ARM64 Linux       | 4              | 4               | 4               | 3                   |
| 캔버스/노드 UI    | 5 (React Flow) | 5 (React Flow)  | 3 (egui-snarl)  | 2 (직접 구현)       |
| 파일 Watching     | 4 (chokidar)   | 5 (Rust notify) | 5 (Rust notify) | 5 (Rust notify)     |
| 크로스플랫폼 빌드 | 5              | 4               | 3               | 3                   |
| 커뮤니티          | 5 (121k stars) | 4 (105k stars)  | 3 (28.7k stars) | 3 (단일 메인테이너) |
| 실시간 성능       | 3              | 4               | 5               | 4                   |
| 한국어(CJK)       | 5              | 4               | 2 (IME 불안정)  | 2                   |
| 개발 생산성       | 5              | 4               | 2               | 2                   |
| **합계**          | **38**         | **43**          | **34**          | **32**              |

### 선정 근거

1. **PixiJS v8 활용 가능**: WebGPU/WebGL GPU 가속 2D 렌더링 엔진으로 Figma/Miro 수준의 자유로운 캔버스 경험 구현
2. **Rust 백엔드**: `.claude` 디렉토리 파일 watching(notify crate)과 파싱을 네이티브 성능으로 처리
3. **경량**: 번들 2-10MB(Electron의 1/10), 메모리 30-100MB(Electron의 1/3)
4. **ARM64 호환**: aarch64-unknown-linux-gnu 공식 지원, DGX Spark에서 네이티브 빌드 가능
5. **개발 생산성**: 프론트엔드는 React 생태계 활용, AI 코딩 도구의 지원이 풍부

### 알려진 리스크

1. **OS별 WebView 차이**: macOS(WKWebView), Windows(WebView2), Linux(WebKitGTK)의 렌더링 차이. 세 플랫폼 모두 테스트 필요
2. **WebKitGTK 안정성**: Linux에서 간헐적 프리즈 보고 있음 (Tauri 2.5.1 + WebKitGTK 2.48.2)
3. **Windows WebView2 IPC**: 대용량 바이너리 전송 시 macOS 대비 ~40x 느림 (10MB 기준 200ms vs 5ms). 단, 파일 이벤트는 소량 페이로드이므로 영향 미미

### 구성 요소

| 레이어      | 기술                    | 역할                                       |
| ----------- | ----------------------- | ------------------------------------------ |
| 데스크톱 쉘 | Tauri v2                | 윈도우 관리, 네이티브 통합, IPC            |
| 백엔드      | Rust                    | 파일 watching, `.claude` 파싱, 데이터 가공 |
| 프론트엔드  | React + TypeScript      | UI 렌더링                                  |
| 캔버스      | PixiJS v8               | GPU 가속 2D 렌더링, 커스텀 뷰포트/노드     |
| 파일 감시   | notify crate (Rust)     | `.claude` 디렉토리 변경 감지               |
| IPC         | Tauri Commands + Events | Rust <-> React 통신                        |

## 시각화 대상

`.claude` 디렉토리의 실제 데이터를 탐색한 후 별도로 결정한다.
