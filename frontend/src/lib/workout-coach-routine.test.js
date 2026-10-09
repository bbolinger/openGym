import { describe, expect, it } from 'vitest'
import { applyWorkoutActions } from './workout-coach.js'
import { routineChangesFor } from './workout-coach-routine.js'
import { applyChangeSet, revertLast } from './coach.js'

const entry = (key, id, { done = false, sg, rid = 'r1' } = {}) => ({
  key, id, rid, ...(sg ? { sg } : {}), target: { sets: 2, reps: 10, weight: 40 },
  sets: [{ w: 40, r: 10, done }, { w: 40, r: 10, done: false }]
})
const make = (id, after, slot) => ({ id, ...(slot?.rid ? { rid: slot.rid } : {}), target: { sets: after.sets || 2, reps: after.reps || 8 }, sets: Array.from({ length: after.sets || 2 }, () => ({ r: after.reps || 8, done: false })) })
const act = (type, key, id, after = {}) => ({ id: `${type}-${key || after.id}`, type, ...(key ? { target: { entryKey: key, exerciseId: id } } : {}), after, why: 'Because.' })

describe('routine changes offered after a workout change', () => {
  const routine = { id: 'r1', name: 'Upper', ex: [{ id: '0001', sets: 3, reps: 10, mode: 'reps' }, { id: '0002', sets: 3, reps: 12, mode: 'reps' }, { id: '0003', sets: 2, reps: 15, mode: 'reps' }] }
  const session = () => ({ cur: 0, entries: [entry('a', '0001'), entry('b', '0002', { done: true }), entry('c', '0003')] })

  it('offers swaps, order and additions in the Coach change-set shape, and nothing for today-only work', () => {
    const before = session()
    const active = structuredClone(before)
    const actions = [
      act('swap-exercise', 'a', '0001', { id: '0009', sets: 2 }),
      act('adjust-exercise', 'b', '0002', { remainingSets: 1, reps: 8, weight: 30, restSec: 120 }),
      act('move-exercise', 'c', '0003', { afterEntryKey: null }),
      act('add-exercise', null, null, { id: '0010', sets: 2, reps: 12, afterEntryKey: 'b' })
    ]
    applyWorkoutActions(active, actions, make)
    const changes = routineChangesFor(actions, [routine], before, active)
    expect(changes.map(c => [c.type, c.after])).toEqual([
      ['reorder', ['0003', '0001', '0002']],
      ['swap-exercise', { id: '0009' }],
      ['add-exercise', { id: '0010', sets: 2, mode: 'reps', reps: 12, position: 3 }]
    ])

    const S = { routines: [structuredClone(routine)], week: {}, coach: { log: [], snapshots: [], lastReview: { at: 1 } } }
    applyChangeSet(S, { id: 'w1', summary: '', changes }, changes.map(c => c.id))
    expect(S.routines[0].ex.map(e => [e.id, e.sets, e.reps])).toEqual([['0003', 2, 15], ['0009', 3, 10], ['0002', 3, 12], ['0010', 2, 12]])
    expect(revertLast(S)).toBe(true)
    expect(S.routines[0]).toEqual(routine)
  })

  it('offers no routine swap between a timed hold and a reps exercise, and no reorder of a session already out of routine order', () => {
    const before = { cur: 0, entries: [entry('b', '0002'), entry('a', '0001'), entry('c', '0003')] }
    const active = structuredClone(before)
    const actions = [act('swap-exercise', 'a', '0001', { id: '0009', sets: 2, sec: 40 }), act('move-exercise', 'c', '0003', { afterEntryKey: null })]
    applyWorkoutActions(active, actions, make)
    expect(routineChangesFor(actions, [routine], before, active)).toEqual([])
  })

  it('offers nothing for exercises the routine does not have', () => {
    const before = { cur: 0, entries: [entry('x', '0005', { rid: null })] }
    const active = structuredClone(before)
    const actions = [act('swap-exercise', 'x', '0005', { id: '0006', sets: 2 })]
    applyWorkoutActions(active, actions, make)
    expect(routineChangesFor(actions, [routine], before, active)).toEqual([])
  })
})
