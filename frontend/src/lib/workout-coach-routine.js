// What a day's Coach changes would mean for the routine, offered after they are applied
// (WorkoutCoachSheet). Reads the session before and after; writes nothing itself — the
// changes go through the Coach's own change-set (coach.js applyChangeSet), so Undo covers them.
import { modeOf } from './history.js'
import { coachExerciseConfig } from './workout-coach.js'

/**
 * Today's applied actions as routine changes in the Coach's change-set shape (coach.js
 * applyChangeSet): order, swaps and additions. Sets, reps, weight, rest, skips and progression
 * exclusions stay with today: the routine is the plan, and a session never edits its numbers
 * (Workout.jsx, routineChangesFromEntry). `before` is the session before the actions were
 * applied and `active` the session after; entries keep their keys across both.
 */
export function routineChangesFor(actions, routines, before, active) {
  const was = key => before.entries.find(entry => entry.key === key) || null
  const routineOf = entry => routines.find(r => r.id === entry?.rid) || null
  const changes = []

  // Order first, while it still names the routine's exercises as they were before any swap. Only
  // from a session that was still in the routine's order, so it is the Coach's move alone.
  for (const action of actions.filter(a => a.type === 'move-exercise')) {
    const routine = routineOf(was(action.target.entryKey))
    if (!routine || changes.some(c => c.type === 'reorder' && c.target.routineId === routine.id)) continue
    const own = routine.ex.map(ex => ex.id)
    const order = entries => entries.filter(entry => entry?.rid === routine.id).map(entry => entry.id).join()
    const ids = active.entries.map(entry => was(entry.key)).filter(entry => entry?.rid === routine.id).map(entry => entry.id)
    if (new Set(own).size !== own.length || order(before.entries) !== own.join() || ids.length !== own.length || ids.join() === own.join()) continue
    changes.push({ id: `${action.id}-order`, type: 'reorder', target: { routineId: routine.id }, before: own, after: ids, why: action.why })
  }

  for (const action of actions) {
    if (action.type === 'add-exercise') {
      const slot = action.after.afterEntryKey == null ? before.entries.at(-1) : was(action.after.afterEntryKey)
      const routine = routineOf(slot)
      if (!routine || routine.ex.some(ex => ex.id === action.after.id) ||
        changes.some(c => c.type === 'add-exercise' && c.target.routineId === routine.id && c.after.id === action.after.id)) continue
      const { sets, mode, reps, sec, min } = coachExerciseConfig(action.after.id, action.after)
      const amount = mode === 'cardio' ? { min } : mode === 'time' ? { sec } : { reps }
      // Next to its slot; at the end of a routine also being reordered, wherever that order lands.
      const position = changes.some(c => c.type === 'reorder' && c.target.routineId === routine.id)
        ? routine.ex.length : routine.ex.findIndex(ex => ex.id === slot.id) + 1 || routine.ex.length
      changes.push({ id: `${action.id}-add`, type: 'add-exercise', target: { routineId: routine.id }, before: null,
        after: { id: action.after.id, sets, mode, ...amount, position }, why: action.why })
      continue
    }
    if (action.type !== 'swap-exercise') continue
    const routine = routineOf(was(action.target.entryKey))
    const ex = routine?.ex.find(e => e.id === action.target.exerciseId)
    // A routine swap keeps the slot's prescription, so only between exercises logged the same
    // way, and not into an exercise the routine already has.
    if (!ex || routine.ex.some(e => e.id === action.after.id) || coachExerciseConfig(action.after.id, action.after).mode !== modeOf(ex)) continue
    changes.push({ id: `${action.id}-swap-exercise`, type: 'swap-exercise', target: { routineId: routine.id, exId: ex.id }, before: null, after: { id: action.after.id }, why: action.why })
  }
  return changes
}
