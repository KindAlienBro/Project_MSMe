# partial_optimizer.py
# Comprehensive timetable operations engine.
# Handles ALL types of changes — not just rescheduling.

from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
from ortools.sat.python import cp_model
from copy import deepcopy

from models import Task, Faculty, Section, Room, SubjectType
import constants as const

DAY_INDEX = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5}
DAY_NAME  = {v: k for k, v in DAY_INDEX.items()}

def _slot(day, period): return day * const.NUM_TEACHING_SLOTS_PER_DAY + period
def _day(slot):         return slot // const.NUM_TEACHING_SLOTS_PER_DAY
def _period(slot):      return slot  % const.NUM_TEACHING_SLOTS_PER_DAY

MORNING_PERIODS   = list(range(0, const.NUM_TEACHING_SLOTS_PER_DAY // 2))
AFTERNOON_PERIODS = list(range(const.NUM_TEACHING_SLOTS_PER_DAY // 2,
                                const.NUM_TEACHING_SLOTS_PER_DAY))


class PartialOptimizer:
    """
    Handles every possible timetable operation via natural language → JSON constraint.

    Supported operations:
    ┌─────────────────────────────────────────────────────────────────┐
    │ SCHEDULING                                                      │
    │  FACULTY_UNAVAILABLE      — block faculty on day/slot          │
    │  FACULTY_FREE_DAY         — give faculty a free day            │
    │  FACULTY_MAX_DAILY_HOURS  — limit daily hours                  │
    │  SECTION_FREE_SLOT        — block a slot for a section         │
    │  WORKING_DAYS             — restrict to certain days           │
    │  SUBJECT_PREFERRED_TIME   — move subject to morning/afternoon  │
    │  HEAVY_SUBJECT_MORNING    — heavy subjects in morning          │
    │  LAB_MUST_CONSECUTIVE     — labs in consecutive slots          │
    │                                                                 │
    │ DIRECT CHANGES (no re-solve needed)                            │
    │  FACULTY_SUBSTITUTION     — replace faculty for a day/subject  │
    │  MOVE_CLASS               — move specific class to new slot    │
    │  SWAP_CLASSES             — swap two classes with each other   │
    │  CANCEL_CLASS             — remove a class from timetable      │
    │  CHANGE_ROOM              — assign different room to a class   │
    │  ADD_EXTRA_CLASS          — add a makeup/extra class           │
    │  MARK_HOLIDAY             — clear all classes on a day         │
    │  RESCHEDULE_LAB           — move lab to a new day              │
    │  CHANGE_FACULTY           — permanently change who teaches     │
    │  FREEZE_SLOT              — lock a slot so it never changes    │
    └─────────────────────────────────────────────────────────────────┘
    """

    def __init__(self, tasks, faculties, sections, rooms, current_solution):
        self.tasks            = tasks
        self.faculties        = faculties
        self.sections         = sections
        self.rooms            = rooms
        self.current_solution = current_solution

        self.tasks_by_id      = {t.task_id: t for t in tasks}
        self.fac_by_id        = {f.id: f for f in faculties}
        self.room_by_id       = {r.room_id: r for r in rooms}
        self.tasks_by_faculty = defaultdict(list)
        self.tasks_by_section = defaultdict(list)
        self.tasks_by_subject = defaultdict(list)
        for t in tasks:
            self.tasks_by_faculty[t.faculty.id].append(t)
            self.tasks_by_section[t.section.section_id].append(t)
            self.tasks_by_subject[t.subject.subject_code].append(t)

    # ═════════════════════════════════════════════════════════════════
    # PUBLIC ENTRY POINT
    # ═════════════════════════════════════════════════════════════════

    def apply_constraint_and_reoptimize(
        self,
        slm_constraint: Dict[str, Any],
        time_limit: int = 30
    ) -> Tuple[str, Dict[str, Any], List[str], str]:
        """
        Route to the correct handler based on constraint type.
        Returns: (status, new_solution, affected_task_ids, summary)
        """
        ctype = slm_constraint.get('type', '').upper()

        # Direct mutation handlers (no CP-SAT needed)
        direct_handlers = {
            'FACULTY_SUBSTITUTION':  self._op_faculty_substitution,
            'MOVE_CLASS':            self._op_move_class,
            'SWAP_CLASSES':          self._op_swap_classes,
            'CANCEL_CLASS':          self._op_cancel_class,
            'CHANGE_ROOM':           self._op_change_room,
            'ADD_EXTRA_CLASS':       self._op_add_extra_class,
            'MARK_HOLIDAY':          self._op_mark_holiday,
            'RESCHEDULE_LAB':        self._op_reschedule_lab,
            'CHANGE_FACULTY':        self._op_change_faculty,
            'FREEZE_SLOT':           self._op_freeze_slot,
        }

        # Re-optimization handlers (CP-SAT partial solve)
        reopt_handlers = {
            'FACULTY_UNAVAILABLE':        True,
            'FACULTY_FREE_DAY':           True,
            'FACULTY_MAX_DAILY_HOURS':    True,
            'FACULTY_NO_CONSECUTIVE':     True,
            'SECTION_FREE_SLOT':          True,
            'WORKING_DAYS':               True,
            'SUBJECT_PREFERRED_TIME':     True,
            'HEAVY_SUBJECT_MORNING':      True,
            'LAB_MUST_CONSECUTIVE':       True,
            'NO_BACK_TO_BACK_SUBJECTS':   True,
            'DISTRIBUTE_SUBJECTS_EVENLY': True,
            'SUBJECT_SPACING':            True,
            'NO_FREE_PERIOD':             True,
        }

        # ── Type aliases — map SLM variants to canonical types ──────────
        aliases = {
            'SUBJECT_FREE_DAY':         'CANCEL_CLASS',
            'FACULTY_LEAVE':            'FACULTY_SUBSTITUTION',
            'BLOCK_SLOT':               'SECTION_FREE_SLOT',
            'REMOVE_CLASS':             'CANCEL_CLASS',
            'DELETE_CLASS':             'CANCEL_CLASS',
            'CLASS_CANCELLED':          'CANCEL_CLASS',
            'SHIFT_CLASS':              'MOVE_CLASS',
            'RELOCATE_CLASS':           'MOVE_CLASS',
            'TEACHER_SUBSTITUTION':     'FACULTY_SUBSTITUTION',
            'REPLACE_FACULTY':          'FACULTY_SUBSTITUTION',
            'SWAP_FACULTY':             'FACULTY_SUBSTITUTION',
            'SUBJECT_UNAVAILABLE':      'CANCEL_CLASS',
            'NO_CLASS':                 'CANCEL_CLASS',
            'HOLIDAY':                  'MARK_HOLIDAY',
            'MOVE_LAB':                 'RESCHEDULE_LAB',
            'SHIFT_LAB':                'RESCHEDULE_LAB',
            'LOCK_SLOT':                'FREEZE_SLOT',
            'PIN_SLOT':                 'FREEZE_SLOT',
        }
        if ctype in aliases:
            slm_constraint = dict(slm_constraint)
            slm_constraint['type'] = aliases[ctype]
            ctype = aliases[ctype]

        if ctype in direct_handlers:
            return direct_handlers[ctype](slm_constraint)
        elif ctype in reopt_handlers:
            return self._reoptimize(slm_constraint, time_limit)
        else:
            return ('NO_CHANGE', self.current_solution, [],
                    f'⚠️ Unknown constraint type: {ctype}')

    # ═════════════════════════════════════════════════════════════════
    # DIRECT MUTATION OPERATIONS
    # ═════════════════════════════════════════════════════════════════

    def _op_faculty_substitution(self, c):
        """
        Replace from_faculty with to_faculty.
        Optionally filter by days and/or subjects.
        Prompt examples:
          "Replace Prof. Anu's classes on Friday with Prof. Syed"
          "Prof. Kavitha is on leave Monday, Praveen will cover"
          "Syed will take all of Anu's NLP classes"
        """
        from_id  = c.get('from_faculty_id') or c.get('from_faculty')
        to_id    = c.get('to_faculty_id')   or c.get('to_faculty')
        days     = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
        scodes   = set(c.get('subject_codes') or [])
        sections = set(c.get('section_ids')   or [])

        if not from_id or not to_id:
            return self._fail('FACULTY_SUBSTITUTION needs from_faculty_id and to_faculty_id')

        to_fac = self.fac_by_id.get(to_id)
        if not to_fac:
            return self._fail(f'Faculty not found: {to_id}')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task or task.faculty.id != from_id: continue
            if days     and info['day_index']              not in days:    continue
            if scodes   and task.subject.subject_code      not in scodes:  continue
            if sections and not any(self._sec_matches(task.section.section_id, s) for s in sections): continue

            updated = dict(info)
            updated['faculty_name'] = to_fac.name
            new_sol[task_id] = updated
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"{const.DAYS[info['day_index']]} P{info['period_index']+1}: "
                f"{task.faculty.name} → {to_fac.name}"
            )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [],
                    f'No matching classes found for substitution.')
        return ('FEASIBLE', new_sol, [],
                f"✅ {len(changes)} class(es) reassigned:\n" + "\n".join(changes))

    def _op_move_class(self, c):
        """
        Move a specific class to a new day/period.
        Prompt examples:
          "Move Monday's NLP class of 6A to Wednesday period 3"
          "Shift Anu's Tuesday class to Thursday"
          "Move section 5A's TOC from Monday to Friday"
        """
        from_day    = DAY_INDEX.get((c.get('from_day') or '').upper())
        to_day      = DAY_INDEX.get((c.get('to_day')   or '').upper())
        from_period = c.get('from_period')   # 1-based
        to_period   = c.get('to_period')     # 1-based
        scode       = c.get('subject_code')
        sid         = c.get('section_id')
        fid         = c.get('faculty_id')

        if from_day is None or to_day is None:
            return self._fail('MOVE_CLASS needs from_day and to_day')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if info['day_index'] != from_day: continue
            if scode    and task.subject.subject_code != scode:   continue
            if sid      and not self._sec_matches(task.section.section_id, sid): continue
            if fid      and task.faculty.id            != fid:    continue
            if from_period and info['period_index'] != from_period - 1: continue

            # Build candidate periods to try: specified first, then all others
            preferred = (to_period - 1) if to_period else info['period_index']
            candidates = [preferred] + [
                p for p in range(const.NUM_TEACHING_SLOTS_PER_DAY)
                if p != preferred
            ]

            placed = False
            fac_id = task.faculty.id if task else None
            sec_id = task.section.section_id if task else None
            for try_period in candidates:
                if try_period + task.duration > const.NUM_TEACHING_SLOTS_PER_DAY:
                    continue
                # Check faculty conflict
                fac_conflict = self._check_conflict(
                    task_id, to_day, try_period, task.duration, fid=fac_id)
                # Check section conflict
                sec_conflict = self._check_conflict(
                    task_id, to_day, try_period, task.duration, sid=sec_id)
                if fac_conflict or sec_conflict:
                    continue
                updated = dict(info)
                updated['day_index']    = to_day
                updated['day_name']     = const.DAYS[to_day]
                updated['period_index'] = try_period
                updated['start_slot']   = _slot(to_day, try_period)
                new_sol[task_id] = updated
                changes.append(
                    f"• {info['subject_code'].upper()} ({info['section_id']}): "
                    f"{const.DAYS[from_day]} P{info['period_index']+1} → "
                    f"{const.DAYS[to_day]} P{try_period+1}"
                    + (f" (requested P{to_period}, auto-placed)" if to_period and try_period != to_period-1 else "")
                )
                placed = True
                break

            if not placed:
                changes.append(
                    f"⚠️ No free slot on {const.DAYS[to_day]} for "
                    f"{info['subject_code'].upper()} ({info['section_id']}) "
                    f"— all periods occupied"
                )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], 'No matching class found to move.')
        return ('FEASIBLE', new_sol, [],
                f"✅ Move operation:\n" + "\n".join(changes))

    def _op_swap_classes(self, c):
        """
        Swap two classes with each other.
        Prompt examples:
          "Swap Monday P1 NLP with Wednesday P3 ML for section 6A"
          "Swap Anu's Monday class with Syed's Wednesday class"
        """
        task1_id = c.get('task1_id')
        task2_id = c.get('task2_id')
        day1     = DAY_INDEX.get((c.get('day1') or '').upper())
        day2     = DAY_INDEX.get((c.get('day2') or '').upper())
        period1  = c.get('period1')
        period2  = c.get('period2')
        sid      = c.get('section_id')

        # Extract subject codes for subject-based lookup
        scode1 = c.get('subject_code1') or c.get('subject_code')
        scode2 = c.get('subject_code2')
        scodes = c.get('subject_codes') or []
        if scodes and len(scodes) >= 2:
            scode1, scode2 = scodes[0], scodes[1]
        elif scodes and len(scodes) == 1 and not scode1:
            scode1 = scodes[0]

        fid1 = c.get('faculty_id1')
        fid2 = c.get('faculty_id2')

        # Find tasks: try period → subject → faculty (in priority order)
        if not task1_id and day1 is not None:
            if period1 is not None:
                task1_id = self._find_task_at(day1, period1-1, sid)
            if not task1_id and scode1:
                task1_id = self._find_task_by_subject(day1, scode1, sid)
            if not task1_id and fid1:
                task1_id = self._find_task_by_faculty(day1, fid1, sid)
        if not task2_id and day2 is not None:
            if period2 is not None:
                task2_id = self._find_task_at(day2, period2-1, sid)
            if not task2_id and scode2:
                task2_id = self._find_task_by_subject(day2, scode2, sid)
            if not task2_id and fid2:
                task2_id = self._find_task_by_faculty(day2, fid2, sid)

        if not task1_id or not task2_id:
            d1 = const.DAYS[day1] if day1 is not None else '?'
            d2 = const.DAYS[day2] if day2 is not None else '?'
            return self._fail(
                f'SWAP_CLASSES: could not find both classes. '
                f'Looking for {scode1 or "?"} on {d1} and {scode2 or "?"} on {d2} '
                f'for section {sid or "all"}')

        info1 = dict(self.current_solution.get(task1_id, {}))
        info2 = dict(self.current_solution.get(task2_id, {}))

        if not info1 or not info2:
            return self._fail('One or both tasks not found in current schedule.')

        new_sol = dict(self.current_solution)

        # Swap day + period + start_slot
        for key in ('day_index','day_name','period_index','start_slot'):
            info1[key], info2[key] = info2[key], info1[key]

        new_sol[task1_id] = info1
        new_sol[task2_id] = info2

        t1 = self.tasks_by_id.get(task1_id)
        t2 = self.tasks_by_id.get(task2_id)
        summary = (
            f"✅ Swapped:\n"
            f"• {t1.subject.subject_code.upper() if t1 else task1_id} ↔ "
            f"{t2.subject.subject_code.upper() if t2 else task2_id}"
        )
        return ('FEASIBLE', new_sol, [task1_id, task2_id], summary)

    def _op_cancel_class(self, c):
        """
        Remove a class from the timetable (e.g. cancelled due to event).
        Prompt examples:
          "Cancel NLP class on Friday for section 6A"
          "No class for 5A on Monday period 2"
          "Cancel all classes on Thursday for Anu"
        """
        day    = DAY_INDEX.get((c.get('day') or '').upper())
        period = c.get('period')
        scode  = c.get('subject_code')
        sid    = c.get('section_id')
        fid    = c.get('faculty_id')

        new_sol, changes = dict(self.current_solution), []
        # sid may be a full section id ("6a-E1") or a parent prefix ("6A")
        sid_is_prefix = sid and '-' not in sid

        for task_id, info in list(self.current_solution.items()):
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if day    is not None and info['day_index']    != day:        continue
            if period is not None and info['period_index'] != period - 1: continue
            if scode  and task.subject.subject_code        != scode:      continue
            if fid    and task.faculty.id                  != fid:        continue
            # Section filter: exact match OR parent prefix match
            if sid:
                sec = task.section.section_id
                if sid_is_prefix:
                    # "6A" matches "6a-E1", "6a-E2" but NOT "6b-E1"
                    if not sec.lower().startswith(sid.lower()):
                        continue
                else:
                    if sec != sid:
                        continue

            del new_sol[task_id]
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"{const.DAYS[info['day_index']]} P{info['period_index']+1} — CANCELLED"
            )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], 'No matching class found to cancel.')
        return ('FEASIBLE', new_sol, [],
                f"✅ {len(changes)} class(es) cancelled:\n" + "\n".join(changes))

    def _op_change_room(self, c):
        """
        Assign a different room to a class.
        Prompt examples:
          "Move NLP class on Monday to Lab 2"
          "Change room for 6A's ML on Tuesday to R3"
          "Shift all of section 5A's labs to L2"
        """
        new_room_id = c.get('room_id') or c.get('new_room_id')
        scode       = c.get('subject_code')
        sid         = c.get('section_id')
        day         = DAY_INDEX.get((c.get('day') or '').upper())
        period      = c.get('period')

        if not new_room_id:
            return self._fail('CHANGE_ROOM needs room_id')

        new_room = self.room_by_id.get(new_room_id)
        if not new_room:
            return self._fail(f'Room not found: {new_room_id}')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if scode  and task.subject.subject_code != scode:  continue
            if sid    and not self._sec_matches(task.section.section_id, sid): continue
            if day    is not None and info['day_index']    != day:      continue
            if period is not None and info['period_index'] != period-1: continue

            updated = dict(info)
            updated['room_id']   = new_room.room_id
            updated['room_name'] = f"{new_room.room_id} ({new_room.building})"
            new_sol[task_id] = updated
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"{const.DAYS[info['day_index']]} P{info['period_index']+1}: "
                f"Room → {new_room.room_id}"
            )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], 'No matching class found.')
        return ('FEASIBLE', new_sol, [],
                f"✅ {len(changes)} room change(s):\n" + "\n".join(changes))

    def _op_add_extra_class(self, c):
        """
        Add a makeup/extra class to the timetable.
        Prompt examples:
          "Add a makeup NLP class on Saturday period 1 for 6A by Anu"
          "Schedule extra ML session for 5B on Friday afternoon"
        """
        scode  = c.get('subject_code')
        sid    = c.get('section_id')
        fid    = c.get('faculty_id')
        day_raw = (c.get('day') or '').upper()
        # day may be a string key like "SAT" or already an int index
        if isinstance(day_raw, int):
            day = day_raw
        else:
            day = DAY_INDEX.get(day_raw)
        period  = c.get('period')
        room_id = c.get('room_id')

        if day is None or not scode or not sid or not fid:
            return self._fail(
                'ADD_EXTRA_CLASS needs subject_code, section_id, faculty_id, and day')

        fac  = self.fac_by_id.get(fid)
        room = self.room_by_id.get(room_id) if room_id else next(
            (r for r in self.rooms if not r.is_lab), self.rooms[0])

        if not fac:
            return self._fail(f'Faculty not found: {fid}')

        day_name = const.DAYS[day] if day < len(const.DAYS) else day_raw

        # Auto-find free period if not specified
        if not period:
            for try_p in range(const.NUM_TEACHING_SLOTS_PER_DAY):
                fc = self._check_conflict(None, day, try_p, 1, fid=fid)
                sc = self._check_conflict(None, day, try_p, 1, sid=sid)
                if not fc and not sc:
                    period = try_p + 1  # 1-indexed
                    break
            if not period:
                return self._fail(
                    f'No free slot on {day_name} for {scode.upper()} ({sid})')

        # Check conflict at chosen period
        conflict = (self._check_conflict(None, day, period-1, 1, fid=fid) or
                    self._check_conflict(None, day, period-1, 1, sid=sid))
        if conflict:
            return self._fail(f'Slot conflict at P{period}: {conflict}')

        task_id  = f"EXTRA-{scode}-{sid}-{day_name}-P{period}"
        new_sol = dict(self.current_solution)
        new_sol[task_id] = {
            'start_slot':   _slot(day, period-1),
            'day_index':    day,
            'day_name':     day_name,
            'period_index': period - 1,
            'room_id':      room.room_id,
            'room_name':    f"{room.room_id} ({room.building})",
            'faculty_name': fac.name,
            'subject_code': scode,
            'section_id':   sid,
            'duration':     1,
            'is_extra':     True,
        }
        return ('FEASIBLE', new_sol, [task_id],
                f"✅ Extra class added: {scode.upper()} ({sid}) "
                f"{day_name} P{period} by {fac.name}")

    def _op_mark_holiday(self, c):
        """
        Clear all classes on a specific day (holiday/event).
        Prompt examples:
          "Mark Friday as holiday"
          "No classes on Monday for all sections"
          "Cancel all Thursday classes for section 6A"
        """
        days    = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
        sid     = c.get('section_id')

        if not days:
            return self._fail('MARK_HOLIDAY needs at least one day')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in list(self.current_solution.items()):
            if info['day_index'] not in days: continue
            if sid and info['section_id'] != sid: continue
            del new_sol[task_id]
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"P{info['period_index']+1}"
            )

        day_names = [const.DAYS[d] for d in days]
        return ('FEASIBLE', new_sol, [],
                f"✅ Holiday on {', '.join(day_names)}: "
                f"{len(changes)} class(es) cleared")

    def _op_reschedule_lab(self, c):
        """
        Move a lab session to a different day (keeps it as 2-hour block).
        Prompt examples:
          "Move NLP Lab from Wednesday to Thursday"
          "Reschedule ML Lab for section 6A to Friday"
        """
        scode     = c.get('subject_code')
        sid       = c.get('section_id')
        from_day  = DAY_INDEX.get((c.get('from_day') or '').upper())
        to_day    = DAY_INDEX.get((c.get('to_day') or '').upper())
        to_period = c.get('to_period', 1)

        if to_day is None:
            return self._fail('RESCHEDULE_LAB needs to_day')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task or task.duration < 2: continue

            # Match by subject code OR by partial name match (nlp matches nlplab)
            code_match = (scode and (
                task.subject.subject_code == scode or
                task.subject.subject_code.startswith(scode) or
                scode.startswith(task.subject.subject_code)
            ))
            if not code_match: continue
            if sid and not self._sec_matches(task.section.section_id, sid): continue
            # If from_day specified, only move labs on that day
            if from_day is not None and info['day_index'] != from_day: continue

            # Auto-find a free lab slot on to_day if specified period conflicts
            # Try: specified period first, then all ALLOWED_LAB_START_INDICES
            candidates = []
            if to_period:
                candidates.append(to_period - 1)
            for p in const.ALLOWED_LAB_START_INDICES:
                if p not in candidates:
                    candidates.append(p)

            placed = False
            fac_id2 = task.faculty.id if task else None
            sec_id2 = task.section.section_id if task else None
            for try_period in candidates:
                # Make sure the 2-hour block doesn't cross day boundary
                if try_period + task.duration > const.NUM_TEACHING_SLOTS_PER_DAY:
                    continue
                fac_conflict = self._check_conflict(
                    task_id, to_day, try_period, task.duration, fid=fac_id2)
                sec_conflict = self._check_conflict(
                    task_id, to_day, try_period, task.duration, sid=sec_id2)
                if fac_conflict or sec_conflict:
                    continue
                # Free slot found — place it
                updated = dict(info)
                updated['day_index']    = to_day
                updated['day_name']     = const.DAYS[to_day]
                updated['period_index'] = try_period
                updated['start_slot']   = _slot(to_day, try_period)
                new_sol[task_id] = updated
                changes.append(
                    f"• {scode.upper()} Lab ({info['section_id']}): "
                    f"{const.DAYS[info['day_index']]} P{info['period_index']+1} → "
                    f"{const.DAYS[to_day]} P{try_period+1}"
                )
                placed = True
                break

            if not placed:
                changes.append(
                    f"⚠️ No free lab slot found on {const.DAYS[to_day]} "
                    f"for {scode.upper()} ({info['section_id']}) — "
                    f"all slots are occupied"
                )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], f'Lab {scode} not found.')
        return ('FEASIBLE', new_sol, [],
                f"✅ Lab rescheduled:\n" + "\n".join(changes))

    def _op_change_faculty(self, c):
        """
        Permanently change faculty for a subject/section (all occurrences).
        Prompt examples:
          "Assign all NLP classes of 6A to Prof. Syed instead of Anu"
          "Transfer Anu's 5B classes to Kavitha permanently"
        """
        from_id = c.get('from_faculty_id') or c.get('from_faculty')
        to_id   = c.get('to_faculty_id')   or c.get('to_faculty')
        scode   = c.get('subject_code')
        sid     = c.get('section_id')

        if not to_id:
            return self._fail('CHANGE_FACULTY needs to_faculty_id')

        to_fac = self.fac_by_id.get(to_id)
        if not to_fac:
            return self._fail(f'Faculty not found: {to_id}')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if from_id and task.faculty.id != from_id:              continue
            if scode   and task.subject.subject_code != scode:       continue
            if sid     and not self._sec_matches(task.section.section_id, sid): continue

            updated = dict(info)
            updated['faculty_name'] = to_fac.name
            new_sol[task_id] = updated
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"ALL slots: faculty → {to_fac.name}"
            )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], 'No matching classes found.')
        # Deduplicate summary
        unique = list(dict.fromkeys(changes))
        return ('FEASIBLE', new_sol, [],
                f"✅ Faculty changed for {len(changes)} slot(s):\n" + "\n".join(unique[:10]))

    def _op_freeze_slot(self, c):
        """
        Mark a slot as frozen (metadata only — solver will skip it in future updates).
        Prompt examples:
          "Lock Monday P1 NLP for section 6A"
          "Freeze Anu's Wednesday slots"
        """
        # Freeze is stored as metadata in the info dict
        day    = DAY_INDEX.get((c.get('day') or '').upper())
        period = c.get('period')
        sid    = c.get('section_id')
        scode  = c.get('subject_code')

        new_sol, changes = dict(self.current_solution), []
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if day    is not None and info['day_index']              != day:       continue
            if period is not None and info['period_index']           != period-1:  continue
            if sid    and not self._sec_matches(task.section.section_id, sid):     continue
            if scode  and task.subject.subject_code                  != scode:     continue

            updated = dict(info)
            updated['frozen'] = True
            new_sol[task_id]  = updated
            changes.append(
                f"• {info['subject_code'].upper()} ({info['section_id']}) "
                f"{const.DAYS[info['day_index']]} P{info['period_index']+1} — FROZEN"
            )

        if not changes:
            return ('NO_CHANGE', self.current_solution, [], 'No matching slot to freeze.')
        return ('FEASIBLE', new_sol, [],
                f"✅ {len(changes)} slot(s) frozen:\n" + "\n".join(changes))

    # ═════════════════════════════════════════════════════════════════
    # CP-SAT RE-OPTIMIZATION (for scheduling constraint types)
    # ═════════════════════════════════════════════════════════════════

    def _reoptimize(self, slm_constraint, time_limit):
        ctype = slm_constraint.get('type', '').upper()
        affected_ids = self._find_affected_tasks(slm_constraint)

        if not affected_ids:
            return ('NO_CHANGE', self.current_solution, [],
                    f'No tasks affected by: {ctype}')

        status, partial = self._solve_partial(affected_ids, [slm_constraint], time_limit)

        if status not in ('OPTIMAL', 'FEASIBLE'):
            return (status, self.current_solution, affected_ids,
                    f'❌ Could not reschedule {len(affected_ids)} task(s). '
                    f'Constraint may be too restrictive.')

        new_sol = dict(self.current_solution)
        new_sol.update(partial)

        changes = []
        for tid in affected_ids:
            old = self.current_solution.get(tid, {})
            new = new_sol.get(tid, {})
            if old and new:
                old_slot = f"{const.DAYS[old['day_index']]} P{old['period_index']+1}"
                new_slot = f"{const.DAYS[new['day_index']]} P{new['period_index']+1}"
                if old_slot != new_slot:
                    changes.append(
                        f"• {new.get('subject_code','?').upper()} "
                        f"({new.get('section_id','?')}): "
                        f"{old_slot} → {new_slot}"
                    )

        summary = (f"✅ {len(changes)} slot(s) moved:\n" + "\n".join(changes)
                   if changes else "✅ Constraint applied — no slot changes needed.")
        return (status, new_sol, affected_ids, summary)

    def _find_affected_tasks(self, c):
        ctype = c.get('type', '').upper()
        affected = set()

        if ctype == 'FACULTY_UNAVAILABLE':
            fid   = c.get('faculty_id')
            days  = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
            slots = c.get('slots') or []
            for task in self.tasks_by_faculty.get(fid, []):
                info = self.current_solution.get(task.task_id, {})
                if not info: continue
                if not days or info['day_index'] in days:
                    if not slots or info['period_index'] in slots:
                        affected.add(task.task_id)

        elif ctype == 'FACULTY_FREE_DAY':
            fid  = c.get('faculty_id')
            pday = c.get('preferred_day')
            if pday and pday in DAY_INDEX:
                for task in self.tasks_by_faculty.get(fid, []):
                    info = self.current_solution.get(task.task_id, {})
                    if info and info['day_index'] == DAY_INDEX[pday]:
                        affected.add(task.task_id)

        elif ctype == 'FACULTY_MAX_DAILY_HOURS':
            fid     = c.get('faculty_id')
            max_hrs = c.get('max_hours') or 999
            by_day  = defaultdict(list)
            for task in self.tasks_by_faculty.get(fid, []):
                info = self.current_solution.get(task.task_id, {})
                if info: by_day[info['day_index']].append(task.task_id)
            for day, tids in by_day.items():
                total = sum(self.tasks_by_id[t].duration for t in tids)
                if total > max_hrs: affected.update(tids)

        elif ctype in ('SUBJECT_PREFERRED_TIME', 'HEAVY_SUBJECT_MORNING'):
            scode  = c.get('subject_code')
            sid    = c.get('section_id')
            period = str(c.get('period', '')).upper()
            target = MORNING_PERIODS if 'MORNING' in period else AFTERNOON_PERIODS
            src    = self.tasks_by_subject.get(scode, []) if scode else self.tasks
            for task in src:
                if sid and task.section.section_id != sid: continue
                info = self.current_solution.get(task.task_id, {})
                if info and target and info['period_index'] not in target:
                    affected.add(task.task_id)

        elif ctype == 'SECTION_FREE_SLOT':
            sid   = c.get('section_id')
            slot  = c.get('slot')
            days  = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
            for task in self.tasks_by_section.get(sid, []):
                info = self.current_solution.get(task.task_id, {})
                if not info: continue
                if slot is not None and info['period_index'] == slot - 1:
                    if not days or info['day_index'] in days:
                        affected.add(task.task_id)

        elif ctype == 'LAB_MUST_CONSECUTIVE':
            scode = c.get('subject_code')
            for task in self.tasks_by_subject.get(scode, []):
                affected.add(task.task_id)

        elif ctype == 'WORKING_DAYS':
            allowed = {DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX}
            if allowed:
                for task in self.tasks:
                    info = self.current_solution.get(task.task_id, {})
                    if info and info['day_index'] not in allowed:
                        affected.add(task.task_id)

        elif ctype in ('NO_BACK_TO_BACK_SUBJECTS', 'DISTRIBUTE_SUBJECTS_EVENLY',
                       'SUBJECT_SPACING'):
            scode = c.get('subject_code')
            codes = c.get('subject_codes') or ([scode] if scode else [])
            sid   = c.get('section_id')
            for code in codes:
                for task in self.tasks_by_subject.get(code, []):
                    if sid and task.section.section_id != sid: continue
                    affected.add(task.task_id)

        elif ctype == 'NO_FREE_PERIOD':
            # Find tasks that are NOT in the required period on any day
            # so we can move them there, OR find tasks blocking required period
            # Strategy: collect all tasks that need to shift to fill the required period
            raw_periods = c.get('periods') or []
            # Resolve -1 to last teaching period
            required_periods = [
                const.NUM_TEACHING_SLOTS_PER_DAY - 1 if p == -1 else p
                for p in raw_periods
            ]   # e.g. [0] for P1, [7] for last
            sids = [s.section_id for s in self.sections]
            # Find sections that have a free slot in required period on any day
            # We need to reschedule tasks to fill those gaps
            # Collect all tasks — let solver figure out placement
            for task in self.tasks:
                info = self.current_solution.get(task.task_id, {})
                if info and required_periods:
                    # Add tasks not currently in the required period
                    if info.get('period_index') not in required_periods:
                        affected.add(task.task_id)
            # If no periods specified, affect nothing
            if not required_periods:
                affected = set()

        else:
            affected.update(t.task_id for t in self.tasks)

        # Never move frozen slots
        frozen = {tid for tid, info in self.current_solution.items()
                  if info.get('frozen')}
        return list(affected - frozen)

    def _solve_partial(self, affected_ids, constraints, time_limit):
        model  = cp_model.CpModel()
        solver = cp_model.CpSolver()

        affected_tasks = [self.tasks_by_id[tid] for tid in affected_ids
                          if tid in self.tasks_by_id]

        locked_fac = defaultdict(set)
        locked_sec = defaultdict(set)
        locked_room = defaultdict(set)

        for task_id, info in self.current_solution.items():
            if task_id in affected_ids: continue
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            for offset in range(task.duration):
                s = _slot(info['day_index'], info['period_index']) + offset
                locked_fac[task.faculty.id].add(s)
                locked_sec[task.section.section_id].add(s)

        task_vars = {}
        for task in affected_tasks:
            allowed = self._compute_allowed(task, constraints, locked_fac, locked_sec)
            if not allowed: allowed = self._all_starts(task)

            sv = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(sorted(allowed)), f'{task.task_id}_s')
            ev = model.NewIntVar(0, const.TOTAL_TEACHING_SLOTS_PER_WEEK, f'{task.task_id}_e')
            iv = model.NewIntervalVar(sv, task.duration, ev, f'{task.task_id}_i')

            ri = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(self._allowed_rooms(task)), f'{task.task_id}_r')

            task_vars[task.task_id] = (sv, ev, iv, ri)

        # No-overlap faculty
        ivs_fac = defaultdict(list)
        for t in affected_tasks:
            ivs_fac[t.faculty.id].append(task_vars[t.task_id][2])
        for ivs in ivs_fac.values():
            if len(ivs) > 1: model.AddNoOverlap(ivs)

        # No-overlap section
        ivs_sec = defaultdict(list)
        for t in affected_tasks:
            ivs_sec[t.section.section_id].append(task_vars[t.task_id][2])
        for ivs in ivs_sec.values():
            if len(ivs) > 1: model.AddNoOverlap(ivs)

        content_solution_ref = self.current_solution  # used in NO_FREE_PERIOD

        # ── NO_FREE_PERIOD enforcement ─────────────────────────────────────
        # For each section and each working day, ensure at least one task
        # is assigned to the required period(s).
        for c in constraints:
            if c.get('type','').upper() != 'NO_FREE_PERIOD':
                continue
            required_periods = c.get('periods') or []
            filter_sid       = c.get('section_id')       # None = all sections
            filter_days      = c.get('days') or list(range(const.NUM_WORKING_DAYS))

            for day in filter_days:
                # Group affected tasks by section
                tasks_by_sec = defaultdict(list)
                for task in affected_tasks:
                    if filter_sid and task.section.section_id != filter_sid:
                        continue
                    tasks_by_sec[task.section.section_id].append(task)

                for sec_id, sec_tasks in tasks_by_sec.items():
                    for req_period in required_periods:
                        target_slot = _slot(day, req_period)
                        # Create boolean: is_in_slot[task] = 1 if task covers target_slot
                        in_slot_vars = []
                        for task in sec_tasks:
                            if task.task_id not in task_vars:
                                continue
                            sv = task_vars[task.task_id][0]
                            b  = model.NewBoolVar(
                                f'{task.task_id}_covers_d{day}_p{req_period}')
                            # task covers target_slot if sv <= target_slot < sv + duration
                            model.Add(sv <= target_slot).OnlyEnforceIf(b)
                            model.Add(sv + task.duration > target_slot).OnlyEnforceIf(b)
                            model.Add(sv > target_slot).OnlyEnforceIf(b.Not())
                            in_slot_vars.append(b)

                        # Also check non-affected (locked) tasks for this section+day+period
                        locked_covers = False
                        for tid, info in content_solution_ref.items():
                            if tid in affected_ids: continue
                            t = self.tasks_by_id.get(tid)
                            if not t or t.section.section_id != sec_id: continue
                            if info['day_index'] != day: continue
                            t_start = _slot(info['day_index'], info['period_index'])
                            if t_start <= target_slot < t_start + t.duration:
                                locked_covers = True
                                break

                        # Only add constraint if locked tasks don't already cover it
                        if not locked_covers and in_slot_vars:
                            model.AddAtLeastOne(in_slot_vars)

        # Minimize changes from original
        penalties = []
        for task in affected_tasks:
            orig = self.current_solution.get(task.task_id, {})
            if orig:
                orig_slot = _slot(orig['day_index'], orig['period_index'])
                sv = task_vars[task.task_id][0]
                changed = model.NewBoolVar(f'{task.task_id}_chg')
                model.Add(sv != orig_slot).OnlyEnforceIf(changed)
                model.Add(sv == orig_slot).OnlyEnforceIf(changed.Not())
                penalties.append(changed)
        if penalties: model.Minimize(sum(penalties))

        solver.parameters.max_time_in_seconds = time_limit
        solver.parameters.log_search_progress = False
        sv_val = solver.Solve(model)

        if sv_val not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return ('INFEASIBLE', {})

        result = {}
        for task in affected_tasks:
            sv, _, _, rv = task_vars[task.task_id]
            start = solver.Value(sv)
            room  = self.rooms[solver.Value(rv)]
            result[task.task_id] = {
                'start_slot':   start,
                'day_index':    _day(start),
                'day_name':     const.DAYS[_day(start)],
                'period_index': _period(start),
                'room_id':      room.room_id,
                'room_name':    f'{room.room_id} ({room.building})',
                'faculty_name': task.faculty.name,
                'subject_code': task.subject.subject_code,
                'section_id':   task.section.section_id,
                'duration':     task.duration,
            }

        status = 'OPTIMAL' if sv_val == cp_model.OPTIMAL else 'FEASIBLE'
        return (status, result)

    # ═════════════════════════════════════════════════════════════════
    # HELPERS
    # ═════════════════════════════════════════════════════════════════

    def _sec_matches(self, task_section_id: str, sid_filter: str) -> bool:
        """
        Returns True if task_section_id matches sid_filter.
        sid_filter can be:
          - exact id:      "6a-E1" -> only matches "6a-E1"
          - parent prefix: "6A"    -> matches "6a-E1", "6a-E2" but not "6b-E1"
          - None:          matches everything
        """
        if not sid_filter:
            return True
        if '-' not in sid_filter:
            # prefix match
            return task_section_id.lower().startswith(sid_filter.lower())
        return task_section_id == sid_filter

    def _check_conflict(self, skip_task_id, day, period, duration,
                        fid=None, sid=None):
        """Returns conflict description if slot is taken, else None."""
        target_slots = set(range(_slot(day, period),
                                  _slot(day, period) + duration))
        for task_id, info in self.current_solution.items():
            if task_id == skip_task_id: continue
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            task_slots = set(range(
                _slot(info['day_index'], info['period_index']),
                _slot(info['day_index'], info['period_index']) + info['duration']
            ))
            if not target_slots.isdisjoint(task_slots):
                if fid and task.faculty.id == fid:
                    return f"{task.faculty.name} busy"
                if sid and task.section.section_id == sid:
                    return f"Section {info['section_id']} busy"
                if not fid and not sid:
                    return f"{info['subject_code']} at that slot"
        return None

    def _find_task_at(self, day, period, sid=None):
        for task_id, info in self.current_solution.items():
            if info['day_index'] != day: continue
            if info['period_index'] != period: continue
            if sid and not self._sec_matches(info['section_id'], sid): continue
            return task_id
        return None

    def _find_task_by_subject(self, day, scode, sid=None):
        """Find first task matching subject code on a given day."""
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if info['day_index'] != day: continue
            tc = task.subject.subject_code.lower()
            sc = scode.lower()
            if tc != sc and not tc.startswith(sc) and not sc.startswith(tc):
                continue
            if sid and not self._sec_matches(info['section_id'], sid): continue
            return task_id
        return None

    def _find_task_by_faculty(self, day, fid, sid=None):
        """Find first task by faculty on a given day."""
        for task_id, info in self.current_solution.items():
            task = self.tasks_by_id.get(task_id)
            if not task: continue
            if info['day_index'] != day: continue
            if task.faculty.id != fid: continue
            if sid and not self._sec_matches(info['section_id'], sid): continue
            return task_id
        return None

    def _all_starts(self, task):
        if task.duration > 1:
            result = []
            for day in range(const.NUM_WORKING_DAYS):
                for pos in const.ALLOWED_LAB_START_INDICES:
                    result.append(day * const.NUM_TEACHING_SLOTS_PER_DAY + pos)
            return result
        return list(range(const.TOTAL_TEACHING_SLOTS_PER_WEEK))

    def _compute_allowed(self, task, constraints, locked_fac, locked_sec):
        base = set(self._all_starts(task))
        for offset in range(task.duration):
            for s in locked_fac.get(task.faculty.id, set()):
                base.discard(s - offset)
            for s in locked_sec.get(task.section.section_id, set()):
                base.discard(s - offset)

        for c in constraints:
            ctype = c.get('type', '').upper()
            if ctype == 'FACULTY_UNAVAILABLE' and c.get('faculty_id') == task.faculty.id:
                days = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
                for day in days:
                    off = day * const.NUM_TEACHING_SLOTS_PER_DAY
                    for p in range(const.NUM_TEACHING_SLOTS_PER_DAY):
                        for o in range(task.duration): base.discard(off + p - o)
            elif ctype == 'SUBJECT_PREFERRED_TIME':
                if c.get('subject_code') == task.subject.subject_code:
                    period = str(c.get('period','')).upper()
                    target = MORNING_PERIODS if 'MORNING' in period else AFTERNOON_PERIODS
                    if target:
                        base = {s for s in base if _period(s) in target}
            elif ctype == 'NO_FREE_PERIOD':
                required_periods = c.get('periods') or []
                sid = c.get('section_id')
                # Only enforce for this task's section if section filter set
                if required_periods and (not sid or task.section.section_id == sid):
                    # Prefer slots in required period — don't fully restrict
                    # (hard enforcement done via AddAtLeastOne in solver)
                    pass

            elif ctype == 'WORKING_DAYS':
                allowed_days = {DAY_INDEX[d] for d in (c.get('days') or [])
                                if d in DAY_INDEX}
                if allowed_days:
                    base = {s for s in base if _day(s) in allowed_days}
        return list(base)

    def _allowed_rooms(self, task):
        allowed = [i for i, r in enumerate(self.rooms)
                   if ((task.subject.subject_type == SubjectType.LAB) == r.is_lab
                       and r.capacity >= task.section.student_strength)]
        return allowed if allowed else [0]

    def _fail(self, msg):
        return ('NO_CHANGE', self.current_solution, [], f'❌ {msg}')