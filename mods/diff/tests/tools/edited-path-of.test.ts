import { describe, expect, test, tier } from 'claude-code/testing'

import Tools from '../../hooks/tools'

tier('builtin')

describe('edited-path-of', () => {
  test("each editing tool's own path argument", () => {
    expect(
      Tools.editedPathOf({
        tool: 'Edit',
        tool_use_id: 'toolu_1',
        file_path: '/work/app.ts',
        old_string: '1',
        new_string: '2',
      }),
    ).toBe('/work/app.ts')

    expect(
      Tools.editedPathOf({
        tool: 'Write',
        tool_use_id: 'toolu_2',
        file_path: 'notes.md',
        content: '',
      }),
    ).toBe('notes.md')

    expect(
      Tools.editedPathOf({
        tool: 'NotebookEdit',
        tool_use_id: 'toolu_3',
        notebook_path: '/work/plot.ipynb',
        new_source: '1',
      }),
    ).toBe('/work/plot.ipynb')
  })

  test('an empty path, or a tool that edits no file: null', () => {
    expect(
      Tools.editedPathOf({
        tool: 'Write',
        tool_use_id: 'toolu_4',
        file_path: '',
        content: '',
      }),
    ).toBeNull()

    expect(
      Tools.editedPathOf({
        tool: 'Bash',
        tool_use_id: 'toolu_5',
        command: 'make',
      }),
    ).toBeNull()

    expect(
      Tools.editedPathOf({
        tool: 'mcp__files__write',
        tool_use_id: 'toolu_6',
        file_path: '/work/app.ts',
      }),
    ).toBeNull()
  })
})
