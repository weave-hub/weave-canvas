import { countWrappedLines, truncateToMaxLines } from './text-utils'

describe('countWrappedLines()', () => {
  it('returns 0 for empty string', () => {
    expect(countWrappedLines('', 28, 4)).toBe(0)
  })

  it('returns 1 for a single short line', () => {
    expect(countWrappedLines('hello', 28, 4)).toBe(1)
  })

  it('wraps long lines based on charsPerLine', () => {
    const line = 'a'.repeat(56) // 2 wrapped lines at 28 chars
    expect(countWrappedLines(line, 28, 10)).toBe(2)
  })

  it('counts multiple lines correctly', () => {
    expect(countWrappedLines('line1\nline2\nline3', 28, 10)).toBe(3)
  })

  it('counts empty lines as 1', () => {
    expect(countWrappedLines('a\n\nb', 28, 10)).toBe(3)
  })

  it('caps at maxLines', () => {
    const text = 'line\n'.repeat(10)
    expect(countWrappedLines(text, 28, 4)).toBe(4)
  })

  it('caps when wrapping exceeds maxLines', () => {
    const longLine = 'a'.repeat(140) // 5 wrapped lines
    expect(countWrappedLines(longLine, 28, 3)).toBe(3)
  })
})

describe('truncateToMaxLines()', () => {
  it('returns short content unchanged', () => {
    expect(truncateToMaxLines('hello', 28, 4)).toBe('hello')
  })

  it('returns multi-line content within limit unchanged', () => {
    const text = 'line1\nline2'
    expect(truncateToMaxLines(text, 28, 4)).toBe(text)
  })

  it('truncates content exceeding maxLines with ellipsis', () => {
    const text = 'line1\nline2\nline3\nline4\nline5'
    const result = truncateToMaxLines(text, 28, 4)
    expect(result).toContain('...')
    expect(result.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('truncates long single line with ellipsis', () => {
    const longLine = 'a'.repeat(140) // 5 wrapped lines at 28 chars
    const result = truncateToMaxLines(longLine, 28, 3)
    expect(result).toContain('...')
  })

  it('is consistent with countWrappedLines', () => {
    const text = 'short\n' + 'a'.repeat(60) + '\nthird\nfourth\nfifth'
    const truncated = truncateToMaxLines(text, 28, 4)
    // truncated text should fit within maxLines
    const lineCount = countWrappedLines(truncated.replace(/\.\.\.$/m, ''), 28, 100)
    expect(lineCount).toBeLessThanOrEqual(4)
  })
})
