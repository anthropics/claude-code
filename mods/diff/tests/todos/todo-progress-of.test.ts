import { describe, expect, test, tier } from 'claude-code/testing'

import Todos from '../../hooks/todos'
import Fixtures from '../fixtures'

tier('builtin')

describe('todo-progress-of', () => {
  test('the latest TodoWrite decides: completed over total', () => {
    expect(
      Todos.todoProgressOf([
        Fixtures.todoWriteOf(['pending', 'pending']),
        Fixtures.todoWriteOf(['completed', 'in_progress', 'pending']),
      ]),
    ).toEqual({ done: 1, total: 3 })
  })

  test('no TodoWrite yet reads as an empty list', () => {
    expect(
      Todos.todoProgressOf([{ role: 'user', text: 'hi', toolUses: [] }]),
    ).toEqual({
      done: 0,
      total: 0,
    })
  })
})
