// src/canvas/text-utils.ts
// 줄 바꿈 계산 및 텍스트 truncation 로직 통합
// measure-node-height.ts와 node-renderer.ts가 동일 알고리즘을 공유하여 높이/텍스트 불일치 방지

export function countWrappedLines(text: string, charsPerLine: number, maxLines: number): number {
  if (!text) return 0

  const lines = text.split('\n')
  let total = 0

  for (const line of lines) {
    if (line.length === 0) {
      total += 1
    } else {
      total += Math.ceil(line.length / charsPerLine)
    }
    if (total >= maxLines) return maxLines
  }

  return Math.min(total, maxLines)
}

export function truncateToMaxLines(content: string, charsPerLine: number, maxLines: number): string {
  const lines = content.split('\n')
  const taken: string[] = []
  let lineCount = 0

  for (const line of lines) {
    if (lineCount >= maxLines) break
    taken.push(line)
    const wrapped = line.length === 0 ? 1 : Math.ceil(line.length / charsPerLine)
    lineCount += wrapped
  }

  let result = taken.join('\n')
  if (lineCount > maxLines || taken.length < lines.length) {
    result = result.trimEnd() + '...'
  }
  return result
}
