# Canvas-Centric Layout Redesign with shadcn/ui

## Overview

Weave의 프론트엔드를 shadcn/ui 기반으로 전면 리디자인한다. Figma/Pencil처럼 캔버스가 메인인 레이아웃을 구성하며, 이번 범위는 레이아웃 구조(껍데기)만 다룬다. 세션 추가/삭제/목록 등 기능적 구현은 제외한다.

## Layout

```
┌─────────────────────────────────────────────┐
│  Toolbar (fixed top)                        │
├─────────────────────────────────────────────┤
│┌──────┐                                     │
││Card  │         Canvas (100%)               │
││(abs) │                                     │
│└──────┘                                     │
├─────────────────────────────────────────────┤
│  Status Bar (fixed bottom)                  │
└─────────────────────────────────────────────┘
```

### Panel open state

- 사이드 패널은 캔버스 위에 absolute/overlay로 떠있다.
- 패널을 열고 닫아도 캔버스 크기는 변하지 않는다.
- 배경 딤(backdrop) 없음. 캔버스 인터랙션은 항상 유지된다.

### Panel closed state

```
┌─────────────────────────────────────────────┐
│  Toolbar (fixed top)                        │
├─────────────────────────────────────────────┤
│▶                                            │
│              Canvas (100%)                  │
│                                             │
├─────────────────────────────────────────────┤
│  Status Bar (fixed bottom)                  │
└─────────────────────────────────────────────┘
```

접힌 상태에서 토글 버튼(▶)만 캔버스 위에 표시된다.

## Tech Stack Changes

### shadcn/ui initialization

- CLI: `pnpm dlx shadcn@latest init`
- Icon library: `@tabler/icons-react`
- Tailwind v4 (기존 유지, shadcn이 자동 감지)
- 현재 `src/styles.css`의 커스텀 `@theme` 컬러 -> shadcn CSS variables로 통합
- Dark mode 기본 (현재와 동일)

### Required shadcn components

| Component     | Purpose               |
| ------------- | --------------------- |
| `Button`      | 툴바 액션, 패널 토글  |
| `Tooltip`     | 툴바 버튼 힌트        |
| `Separator`   | 툴바 내 구분선        |
| `Card`        | 사이드 패널 컨테이너  |
| `Collapsible` | 사이드 패널 열기/닫기 |
| `Empty`       | 캔버스 빈 상태        |

### Icon library

- `@tabler/icons-react` 사용
- shadcn의 `data-icon` 규칙을 따른다 (아이콘에 직접 sizing 클래스 사용 금지)

## Component Architecture

### File structure (after)

```
src/
├── components/
│   ├── ui/                  <- shadcn components (auto-generated)
│   ├── toolbar.tsx          <- 상단 고정 툴바
│   ├── side-panel.tsx       <- Collapsible + Card 기반 사이드 패널
│   ├── status-bar.tsx       <- 하단 고정 상태바
│   ├── canvas-area.tsx      <- 캔버스 영역 (PixiCanvas + Empty 상태)
│   └── pixi-canvas.tsx      <- 기존 유지
├── canvas/                  <- 변경 없음
├── hooks/                   <- 변경 없음
├── lib/
│   └── utils.ts             <- cn() utility (shadcn init 생성)
├── app.tsx                  <- 레이아웃 조합만 담당
├── types.ts                 <- 변경 없음
└── styles.css               <- shadcn 테마로 재구성
```

### Component details

#### `app.tsx`

레이아웃 셸만 담당. 기존 인라인 UI를 제거하고 새 컴포넌트를 조합한다.

```
<div className="flex flex-col h-screen w-screen">
  <Toolbar />
  <main className="relative flex-1 overflow-hidden">
    <CanvasArea />
    <SidePanel />
  </main>
  <StatusBar />
</div>
```

- `<main>`이 relative 컨테이너, 그 안에서 SidePanel이 absolute로 배치된다.

#### `toolbar.tsx`

- 고정 상단바, shadcn `Button` + `Tooltip` + `Separator` 조합
- 앱 로고, 패널 토글 버튼, 향후 액션 버튼 자리
- 시맨틱 컬러 사용: `bg-card`, `text-card-foreground`, `border-border`

#### `side-panel.tsx`

```tsx
<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleContent>
    <Card className="absolute left-3 top-3 bottom-3 w-64 z-10">
      <CardHeader>
        <CardTitle>Panel Title</CardTitle>
      </CardHeader>
      <CardContent>{/* placeholder content */}</CardContent>
    </Card>
  </CollapsibleContent>
</Collapsible>
```

- `Card`가 `absolute` + `z-10`으로 캔버스 위에 떠있음
- backdrop 없음, 캔버스 클릭/드래그 가능
- 접힌 상태에서는 토글 `Button`만 표시

#### `canvas-area.tsx`

- PixiCanvas를 감싸는 wrapper
- 세션이 없을 때 shadcn `Empty` 컴포넌트로 빈 상태 표시
- 캔버스는 부모 크기 100% 차지
- 기존 props(`events`, `key` 등)는 그대로 전달 — 레이아웃만 감싸고 로직은 건드리지 않음

#### `status-bar.tsx`

- 고정 하단바
- `text-muted-foreground` 등 시맨틱 토큰 사용
- placeholder 텍스트 (기능 구현은 이후)

## Styling Rules (shadcn conventions)

- `className`은 레이아웃 용도로만 사용, 컴포넌트 색상/타이포 직접 override 금지
- `space-x-*` / `space-y-*` 대신 `flex` + `gap-*` 사용
- `w-* h-*` 동일 시 `size-*` 사용
- `dark:` 수동 오버라이드 금지, 시맨틱 토큰 사용 (`bg-background`, `text-muted-foreground`)
- `cn()` 유틸로 조건부 클래스 처리
- overlay 컴포넌트에 수동 `z-index` 금지 (단, side-panel Card는 커스텀 컴포넌트이므로 예외)

## Unchanged

- `src/canvas/` — CanvasNode, SceneManager, Viewport 모두 그대로
- `src/hooks/` — useSessions, useWatcherEvents 그대로
- `src/types.ts` — 그대로
- `src-tauri/` — Rust 백엔드 변경 없음
- 기존 기능(세션 관리, 이벤트 수신) 로직은 그대로 유지하되, UI 바인딩은 이후 작업에서 연결

## Out of Scope

- 세션 추가/삭제/목록 UI (Dialog, AlertDialog 등)
- 세션 관련 기능적 로직 변경
- 새로운 기능 추가
- Rust 백엔드 변경
