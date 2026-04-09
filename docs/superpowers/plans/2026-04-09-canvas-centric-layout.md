# Canvas-Centric Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weave의 프론트엔드를 shadcn/ui 기반 canvas-centric 레이아웃(상단 툴바 + absolute 사이드 패널 + 캔버스 + 하단 상태바)으로 전면 리디자인한다.

**Architecture:** 캔버스가 전체 뷰포트를 채우고, Collapsible + Card로 만든 사이드 패널이 캔버스 위에 absolute로 떠있는 Figma/Pencil 스타일 레이아웃. 상단 Toolbar와 하단 StatusBar는 고정. 기존 PixiJS 캔버스/hooks/canvas 로직은 변경 없음.

**Tech Stack:** React 19, shadcn/ui (Tailwind v4), @tabler/icons-react, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-centric-layout-redesign.md`

---

## File Map

| Action         | Path                                  | Responsibility                                |
| -------------- | ------------------------------------- | --------------------------------------------- |
| Auto-generated | `components.json`                     | shadcn CLI config                             |
| Auto-generated | `src/components/ui/*.tsx`             | shadcn primitives                             |
| Auto-generated | `src/lib/utils.ts`                    | `cn()` utility                                |
| Modified       | `src/styles.css`                      | shadcn CSS variables (replaces custom @theme) |
| Modified       | `tsconfig.json`                       | `@/` path alias                               |
| Modified       | `vite.config.ts`                      | `@/` resolve alias                            |
| Modified       | `src/app.tsx`                         | Layout shell (compose components)             |
| Created        | `src/components/toolbar.tsx`          | 상단 고정 툴바                                |
| Created        | `src/components/toolbar.test.tsx`     | Toolbar 테스트                                |
| Created        | `src/components/side-panel.tsx`       | Collapsible + Card 사이드 패널                |
| Created        | `src/components/side-panel.test.tsx`  | SidePanel 테스트                              |
| Created        | `src/components/canvas-area.tsx`      | PixiCanvas wrapper + Empty 상태               |
| Created        | `src/components/canvas-area.test.tsx` | CanvasArea 테스트                             |
| Created        | `src/components/status-bar.tsx`       | 하단 고정 상태바                              |
| Created        | `src/components/status-bar.test.tsx`  | StatusBar 테스트                              |
| Unchanged      | `src/components/pixi-canvas.tsx`      | 기존 PixiJS 캔버스 (그대로)                   |
| Unchanged      | `src/canvas/*`                        | CanvasNode, SceneManager, Viewport            |
| Unchanged      | `src/hooks/*`                         | useSessions, useWatcherEvents                 |
| Unchanged      | `src/types.ts`                        | Session, FileChangeEvent                      |

---

## Task 1: shadcn/ui 초기화 및 의존성 설치

**Files:**

- Create: `components.json` (auto by CLI)
- Create: `src/lib/utils.ts` (auto by CLI)
- Modify: `src/styles.css`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: shadcn init 실행**

```bash
pnpm dlx shadcn@latest init
```

init 과정에서의 선택:

- Style: `default`
- Base color: `zinc` (어두운 톤에 적합)
- CSS variables: `yes`

init 후 `components.json`이 생성되고, `src/styles.css`에 shadcn CSS variables가 추가된다.

- [ ] **Step 2: components.json에서 iconLibrary를 tabler로 변경**

`components.json`에서 `iconLibrary` 필드를 수정:

```json
{
  "iconLibrary": "tabler"
}
```

- [ ] **Step 3: @tabler/icons-react 설치**

```bash
pnpm add @tabler/icons-react
```

- [ ] **Step 4: tsconfig.json에 path alias 설정 확인**

shadcn init이 자동으로 추가했을 수 있다. 없다면 `compilerOptions`에 추가:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: vite.config.ts에 resolve alias 추가**

```ts
import path from 'path'

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ... rest
}))
```

- [ ] **Step 6: styles.css 정리 — 기존 커스텀 @theme 제거**

shadcn init 후 `src/styles.css`에 shadcn CSS variables가 추가되었을 것이다. 기존 커스텀 컬러를 제거한다:

삭제할 블록:

```css
@theme {
  --color-surface: #111122;
  --color-surface-raised: #1a1a2e;
  --color-border: #2a2a4a;
  --color-text: #e0e0e0;
  --color-text-muted: #888;
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
}
```

이 컬러들은 이제 shadcn의 시맨틱 토큰(`--background`, `--card`, `--primary`, `--muted-foreground` 등)으로 대체된다.

- [ ] **Step 7: dev 서버 실행 확인**

```bash
pnpm dev
```

Expected: Vite dev server가 에러 없이 시작. 브라우저에서 `http://localhost:1420` 접속 시 기존 앱이 (스타일 깨진 상태로) 표시.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui with tabler icons and path aliases"
```

---

## Task 2: shadcn 컴포넌트 설치

**Files:**

- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/collapsible.tsx`
- Create: `src/components/ui/empty.tsx`

- [ ] **Step 1: 필요한 컴포넌트 일괄 설치**

```bash
pnpm dlx shadcn@latest add button tooltip separator card collapsible empty
```

- [ ] **Step 2: 설치된 컴포넌트 파일 확인**

```bash
ls src/components/ui/
```

Expected: `button.tsx`, `tooltip.tsx`, `separator.tsx`, `card.tsx`, `collapsible.tsx`, `empty.tsx` 존재.

- [ ] **Step 3: 설치된 컴포넌트 import 검증**

각 컴포넌트 파일을 열어서 import 경로가 프로젝트의 `@/` alias와 일치하는지 확인. `@/lib/utils`에서 `cn`을 import하는지 확인.

- [ ] **Step 4: 아이콘 import가 tabler를 사용하는지 확인**

설치된 컴포넌트 중 아이콘을 사용하는 것이 있다면 `@tabler/icons-react`에서 import하는지 확인. `lucide-react`로 되어 있으면 `@tabler/icons-react`로 교체.

- [ ] **Step 5: type-check 실행**

```bash
pnpm type-check
```

Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: add shadcn button, tooltip, separator, card, collapsible, empty"
```

---

## Task 3: Toolbar 컴포넌트

**Files:**

- Create: `src/components/toolbar.tsx`
- Create: `src/components/toolbar.test.tsx`

- [ ] **Step 1: Toolbar 테스트 작성**

```tsx
// src/components/toolbar.test.tsx
import { render, screen } from '@testing-library/react'
import { Toolbar } from './toolbar'

describe('Toolbar', () => {
  it('renders the app logo text', () => {
    render(<Toolbar onTogglePanel={() => {}} />)
    expect(screen.getByText('Weave')).toBeInTheDocument()
  })

  it('renders the panel toggle button', () => {
    render(<Toolbar onTogglePanel={() => {}} />)
    expect(screen.getByRole('button', { name: /panel/i })).toBeInTheDocument()
  })

  it('calls onTogglePanel when toggle button is clicked', async () => {
    const onToggle = vi.fn()
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }))
    render(<Toolbar onTogglePanel={onToggle} />)
    await user.click(screen.getByRole('button', { name: /panel/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test run src/components/toolbar.test.tsx
```

Expected: FAIL — `./toolbar` 모듈을 찾을 수 없음.

- [ ] **Step 3: Toolbar 구현**

```tsx
// src/components/toolbar.tsx
import { IconLayoutSidebar } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ToolbarProps {
  onTogglePanel: () => void
}

export function Toolbar({ onTogglePanel }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card text-card-foreground shrink-0">
      <span className="font-semibold text-sm select-none">Weave</span>
      <Separator orientation="vertical" className="h-4" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onTogglePanel} aria-label="Toggle panel">
              <IconLayoutSidebar data-icon="inline-start" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle panel</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test run src/components/toolbar.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/toolbar.tsx src/components/toolbar.test.tsx
git commit -m "feat: add Toolbar component with panel toggle"
```

---

## Task 4: SidePanel 컴포넌트

**Files:**

- Create: `src/components/side-panel.tsx`
- Create: `src/components/side-panel.test.tsx`

- [ ] **Step 1: SidePanel 테스트 작성**

```tsx
// src/components/side-panel.test.tsx
import { render, screen } from '@testing-library/react'
import { SidePanel } from './side-panel'

describe('SidePanel', () => {
  it('renders card content when open', () => {
    render(<SidePanel open={true} onOpenChange={() => {}} />)
    expect(screen.getByText('Panel')).toBeInTheDocument()
  })

  it('hides card content when closed', () => {
    render(<SidePanel open={false} onOpenChange={() => {}} />)
    expect(screen.queryByText('Panel')).not.toBeInTheDocument()
  })

  it('renders toggle button when closed', () => {
    render(<SidePanel open={false} onOpenChange={() => {}} />)
    expect(screen.getByRole('button', { name: /open panel/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test run src/components/side-panel.test.tsx
```

Expected: FAIL — `./side-panel` 모듈을 찾을 수 없음.

- [ ] **Step 3: SidePanel 구현**

```tsx
// src/components/side-panel.tsx
import { IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

interface SidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SidePanel({ open, onOpenChange }: SidePanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <Card className="absolute left-3 top-3 bottom-3 w-64 z-10">
          <CardHeader>
            <CardTitle className="text-sm">Panel</CardTitle>
          </CardHeader>
          <CardContent>{/* placeholder — functional content added in future tasks */}</CardContent>
        </Card>
      </CollapsibleContent>
      {!open && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-2 top-2 z-10"
          onClick={() => onOpenChange(true)}
          aria-label="Open panel"
        >
          <IconChevronRight data-icon="inline-start" />
        </Button>
      )}
    </Collapsible>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test run src/components/side-panel.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/side-panel.tsx src/components/side-panel.test.tsx
git commit -m "feat: add SidePanel component with Collapsible + Card"
```

---

## Task 5: StatusBar 컴포넌트

**Files:**

- Create: `src/components/status-bar.tsx`
- Create: `src/components/status-bar.test.tsx`

- [ ] **Step 1: StatusBar 테스트 작성**

```tsx
// src/components/status-bar.test.tsx
import { render, screen } from '@testing-library/react'
import { StatusBar } from './status-bar'

describe('StatusBar', () => {
  it('renders the status bar', () => {
    render(<StatusBar />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays ready text', () => {
    render(<StatusBar />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test run src/components/status-bar.test.tsx
```

Expected: FAIL — `./status-bar` 모듈을 찾을 수 없음.

- [ ] **Step 3: StatusBar 구현**

```tsx
// src/components/status-bar.tsx
export function StatusBar() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 px-3 py-1 border-t bg-card text-muted-foreground text-xs shrink-0"
    >
      <span>Ready</span>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test run src/components/status-bar.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/status-bar.tsx src/components/status-bar.test.tsx
git commit -m "feat: add StatusBar component"
```

---

## Task 6: CanvasArea 컴포넌트

**Files:**

- Create: `src/components/canvas-area.tsx`
- Create: `src/components/canvas-area.test.tsx`

- [ ] **Step 1: CanvasArea 테스트 작성**

PixiJS는 jsdom에서 Canvas API가 없어서 모킹이 필요하다. CanvasArea는 조건부 렌더링만 테스트한다.

```tsx
// src/components/canvas-area.test.tsx
import { render, screen } from '@testing-library/react'
import { CanvasArea } from './canvas-area'

// PixiCanvas는 jsdom에서 동작하지 않으므로 mock
vi.mock('./pixi-canvas', () => ({
  PixiCanvas: ({ events }: { events: unknown[] }) => <div data-testid="pixi-canvas">events: {events.length}</div>,
}))

describe('CanvasArea', () => {
  it('renders Empty when no active session', () => {
    render(<CanvasArea activeSessionId={null} events={[]} />)
    expect(screen.getByText(/add a session/i)).toBeInTheDocument()
  })

  it('renders PixiCanvas when active session exists', () => {
    render(<CanvasArea activeSessionId="session-1" events={[]} />)
    expect(screen.getByTestId('pixi-canvas')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test run src/components/canvas-area.test.tsx
```

Expected: FAIL — `./canvas-area` 모듈을 찾을 수 없음.

- [ ] **Step 3: CanvasArea 구현**

```tsx
// src/components/canvas-area.tsx
import { IconPlus } from '@tabler/icons-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PixiCanvas } from './pixi-canvas'
import type { FileChangeEvent } from '@/types'

interface CanvasAreaProps {
  activeSessionId: string | null
  events: FileChangeEvent[]
}

export function CanvasArea({ activeSessionId, events }: CanvasAreaProps) {
  if (!activeSessionId) {
    return (
      <div className="flex items-center justify-center size-full">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconPlus />
            </EmptyMedia>
            <EmptyTitle>No active session</EmptyTitle>
            <EmptyDescription>Add a session to start monitoring</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return <PixiCanvas key={activeSessionId} events={events} />
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test run src/components/canvas-area.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/canvas-area.tsx src/components/canvas-area.test.tsx
git commit -m "feat: add CanvasArea component with Empty state"
```

---

## Task 7: app.tsx 레이아웃 리디자인

**Files:**

- Modify: `src/app.tsx`

- [ ] **Step 1: 기존 app.tsx의 인라인 UI를 새 컴포넌트 조합으로 교체**

```tsx
// src/app.tsx
import { useState } from 'react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { CanvasArea } from './components/canvas-area'
import { StatusBar } from './components/status-bar'
import { useSessions } from './hooks/use-sessions'
import { useWatcherEvents } from './hooks/use-watcher-events'

function App() {
  const { sessions, addSession, removeSession } = useSessions()
  const { events, clearSession } = useWatcherEvents()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? null
  const activeEvents = activeSessionId ? (events.get(activeSessionId) ?? []) : []

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar onTogglePanel={() => setPanelOpen((prev) => !prev)} />
      <main className="relative flex-1 overflow-hidden">
        <CanvasArea activeSessionId={activeSessionId} events={activeEvents} />
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} />
      </main>
      <StatusBar />
    </div>
  )
}

export default App
```

Note: `addSession`, `removeSession`, `clearSession`, `setSelectedSessionId`, `sessions` 등은 현재 사용되지 않지만 (`noUnusedLocals` 위반) 기능 연결은 이후 작업이다. tsconfig의 `noUnusedLocals`을 통과하려면 임시로 사용하지 않는 변수에 `_` prefix를 붙이거나, 이 단계에서는 hooks 호출 자체를 주석 처리할 수 있다. 여기서는 아직 사용될 변수를 유지하되 다음과 같이 처리:

```tsx
// hooks는 유지하되 미사용 변수를 suppress
const { sessions: _sessions, addSession: _addSession, removeSession: _removeSession } = useSessions()
const { events, clearSession: _clearSession } = useWatcherEvents()
```

또는 더 깔끔하게: hooks 호출을 완전히 제거하고, CanvasArea에 `activeSessionId={null} events={[]}` 을 전달. 기능 연결은 이후 task에서.

최종 결정: hooks 호출을 제거하고 레이아웃 셸만 남긴다:

```tsx
// src/app.tsx
import { useState } from 'react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { CanvasArea } from './components/canvas-area'
import { StatusBar } from './components/status-bar'

function App() {
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar onTogglePanel={() => setPanelOpen((prev) => !prev)} />
      <main className="relative flex-1 overflow-hidden">
        <CanvasArea activeSessionId={null} events={[]} />
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} />
      </main>
      <StatusBar />
    </div>
  )
}

export default App
```

- [ ] **Step 2: type-check 실행**

```bash
pnpm type-check
```

Expected: 에러 없음.

- [ ] **Step 3: 전체 테스트 실행**

```bash
pnpm test run
```

Expected: 모든 테스트 PASS (기존 canvas 테스트 포함).

- [ ] **Step 4: lint 실행**

```bash
pnpm lint
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/app.tsx
git commit -m "feat: redesign app.tsx with canvas-centric layout shell"
```

---

## Task 8: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 quality check**

```bash
pnpm format:check && pnpm lint && pnpm type-check && pnpm test run
```

Expected: 모두 통과.

- [ ] **Step 2: dev 서버에서 시각적 확인**

```bash
pnpm dev
```

브라우저에서 `http://localhost:1420` 접속 후 확인:

- 상단 Toolbar가 고정 표시됨 (Weave 로고 + 패널 토글 버튼)
- 사이드 패널(Card)이 캔버스 위에 absolute로 떠있음
- 패널 토글 시 캔버스 크기 변화 없음
- 패널 닫히면 ▶ 토글 버튼만 표시
- 하단 StatusBar가 고정 표시됨 ("Ready")
- 세션이 없으므로 Empty 상태 표시 ("Add a session to start monitoring")

- [ ] **Step 3: 문제 있으면 수정 후 커밋**

이슈가 있으면 수정하고:

```bash
git add -A
git commit -m "fix: resolve layout issues from visual review"
```
