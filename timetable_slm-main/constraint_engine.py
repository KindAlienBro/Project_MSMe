# constraint_engine.py

from collections import defaultdict
from typing import List, Dict, Any, Tuple
from ortools.sat.python import cp_model
from models import Task, Faculty, Section, Room, SubjectType
import constants as const

TaskVariables = Tuple[cp_model.IntVar, cp_model.IntVar, cp_model.IntervalVar, cp_model.IntVar]

class ConstraintEngine:
    def __init__(
        self,
        model: cp_model.CpModel,
        tasks: List[Task],
        faculties: List[Faculty],
        sections: List[Section],
        rooms: List[Room],
        max_continuous_stretch: int = 3,
        slm_constraints: List[Dict[str, Any]] = None,
        scheduling_rules: List[Dict[str, Any]] = None
    ):
        self.model = model
        self.tasks = tasks
        self.faculties = faculties
        self.sections = sections
        self.rooms = rooms
        self.max_continuous_stretch = max_continuous_stretch
        self.slm_constraints = slm_constraints or []
        self.scheduling_rules = scheduling_rules or []
        self.room_map = {room.room_id: i for i, room in enumerate(self.rooms)}
        self.task_vars: Dict[str, TaskVariables] = {}

    def apply_all_constraints(self):
        self._create_task_variables()
        self._apply_clash_constraints()
        self._apply_stretch_constraints()
        self._apply_grouping_constraints()
        self._apply_daily_subject_limit()

    def _create_task_variables(self):
        for task in self.tasks:
            allowed_starts = self._get_allowed_start_slots(task)
            start_domain = cp_model.Domain.FromValues(allowed_starts)
            start_var = self.model.NewIntVarFromDomain(start_domain, name=f"{task.task_id}_start")
            end_var = self.model.NewIntVar(0, const.TOTAL_TEACHING_SLOTS_PER_WEEK, name=f"{task.task_id}_end")
            interval_var = self.model.NewIntervalVar(start_var, task.duration, end_var, name=f"{task.task_id}_interval")

            allowed_room_indices = self._get_allowed_rooms(task)
            room_domain = cp_model.Domain.FromValues(allowed_room_indices)
            room_var = self.model.NewIntVarFromDomain(room_domain, name=f"{task.task_id}_room")

            self.task_vars[task.task_id] = (start_var, end_var, interval_var, room_var)

    def _apply_clash_constraints(self):
        # 1. Faculty Clash Prevention (MODIFIED FOR COMBINED ELECTIVES)
        intervals_by_faculty = defaultdict(list)
        processed_groups_per_faculty = defaultdict(set)

        for task in self.tasks:
            fid = task.faculty.id
            gid = task.elective_group_id
            interval = self.task_vars[task.task_id][2]

            if gid:
                # If this faculty is teaching a group, only add the interval ONCE for that group
                if gid not in processed_groups_per_faculty[fid]:
                    intervals_by_faculty[fid].append(interval)
                    processed_groups_per_faculty[fid].add(gid)
            else:
                intervals_by_faculty[fid].append(interval)
        
        for faculty_id in intervals_by_faculty:
            if faculty_id == "DUMMY_STAFF":
                continue
            self.model.AddNoOverlap(intervals_by_faculty[faculty_id])

        # 2. Section Clash Prevention (MODIFIED FOR ELECTIVES)
        intervals_by_section = defaultdict(list)
        processed_groups_per_section = defaultdict(set)

        for task in self.tasks:
            sid = task.section.section_id
            gid = task.elective_group_id
            interval = self.task_vars[task.task_id][2]

            if gid:
                if gid not in processed_groups_per_section[sid]:
                    intervals_by_section[sid].append(interval)
                    processed_groups_per_section[sid].add(gid)
            else:
                intervals_by_section[sid].append(interval)

        for section_id in intervals_by_section:
            self.model.AddNoOverlap(intervals_by_section[section_id])

        # 3. Room Clash Prevention
        for i, room in enumerate(self.rooms):
            optional_intervals = []
            for task in self.tasks:
                if i in self._get_allowed_rooms(task):
                    interval, room_var = self.task_vars[task.task_id][2], self.task_vars[task.task_id][3]
                    is_in_room = self.model.NewBoolVar(f"{task.task_id}_in_room_{room.room_id}")
                    self.model.Add(room_var == i).OnlyEnforceIf(is_in_room)
                    self.model.Add(room_var != i).OnlyEnforceIf(is_in_room.Not())
                    opt_interval = self.model.NewOptionalIntervalVar(
                        interval.StartExpr(), interval.SizeExpr(), interval.EndExpr(), is_in_room, name=f"opt_{task.task_id}_{room.room_id}"
                    )
                    optional_intervals.append(opt_interval)
            if optional_intervals:
                self.model.AddNoOverlap(optional_intervals)

    def _apply_stretch_constraints(self):
        tasks_by_entity = defaultdict(list)
        for task in self.tasks:
            if task.faculty.id != "DUMMY_STAFF":
                tasks_by_entity[f"fac_{task.faculty.id}"].append(task)
            tasks_by_entity[f"sec_{task.section.section_id}"].append(task)
        for name, tasks in tasks_by_entity.items():
            self._add_stretch_constraint_for_entity(tasks, name)

    def _apply_grouping_constraints(self):
        tasks_by_group = defaultdict(list)
        for task in self.tasks:
            if task.elective_group_id:
                tasks_by_group[task.elective_group_id].append(task)
        for group_tasks in tasks_by_group.values():
            if len(group_tasks) > 1:
                first_start = self.task_vars[group_tasks[0].task_id][0]
                for i in range(1, len(group_tasks)):
                    self.model.Add(self.task_vars[group_tasks[i].task_id][0] == first_start)

    def _apply_daily_subject_limit(self):
        tasks_by_sec_sub = defaultdict(list)
        for task in self.tasks:
            if task.subject.subject_type == SubjectType.THEORY:
                tasks_by_sec_sub[(task.section.section_id, task.subject.subject_code)].append(task)
        for tasks in tasks_by_sec_sub.values():
            for day in range(const.NUM_WORKING_DAYS):
                literals = []
                for task in tasks:
                    start_var = self.task_vars[task.task_id][0]
                    is_on_day = self.model.NewBoolVar(f"{task.task_id}_on_day_{day}")
                    day_idx = self.model.NewIntVar(0, const.NUM_WORKING_DAYS-1, f"day_{task.task_id}_{day}")
                    self.model.AddDivisionEquality(day_idx, start_var, const.NUM_TEACHING_SLOTS_PER_DAY)
                    self.model.Add(day_idx == day).OnlyEnforceIf(is_on_day)
                    self.model.Add(day_idx != day).OnlyEnforceIf(is_on_day.Not())
                    literals.append(is_on_day)
                if literals: self.model.Add(sum(literals) <= 1)

    def _get_allowed_start_slots(self, task: Task) -> List[int]:
        full_range = set(range(const.TOTAL_TEACHING_SLOTS_PER_WEEK))
        if task.duration > 1:
            allowed_lab_slots = set()
            for day in range(const.NUM_WORKING_DAYS):
                day_offset = day * const.NUM_TEACHING_SLOTS_PER_DAY
                for pos in const.ALLOWED_LAB_START_INDICES:
                    allowed_lab_slots.add(day_offset + pos)
            full_range.intersection_update(allowed_lab_slots)

        # ── Configurable scheduling rules (data-driven) ─────────────────
        DAY_MAP = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5}
        for rule in self.scheduling_rules:
            rule_subjects = [s.lower() for s in (rule.get('subject_codes') or [])]
            rule_types = [t.upper() for t in (rule.get('subject_types') or [])]
            # Check if this rule applies to the current task
            matches_subject = task.subject.subject_code.lower() in rule_subjects if rule_subjects else False
            matches_type = task.subject.subject_type.name in rule_types if rule_types else False
            if not matches_subject and not matches_type:
                continue

            rtype = rule.get('rule_type', '').upper()

            if rtype == 'FIXED_PERIOD':
                # Force tasks to a specific period index
                period_idx = rule.get('period_index', 0)
                full_range = {s for s in full_range
                              if (s % const.NUM_TEACHING_SLOTS_PER_DAY) == period_idx}

            elif rtype == 'BEFORE_TIME':
                # Tasks must start at or before a max period index
                max_p = rule.get('max_period_index', 4)
                full_range = {s for s in full_range
                              if (s % const.NUM_TEACHING_SLOTS_PER_DAY) <= max_p}

            elif rtype == 'FIXED_DAYS':
                # Tasks must only be on specific days
                allowed_days = {DAY_MAP[d.upper()] for d in (rule.get('days') or []) if d.upper() in DAY_MAP}
                if allowed_days:
                    full_range = {s for s in full_range
                                  if (s // const.NUM_TEACHING_SLOTS_PER_DAY) in allowed_days}

        if self.slm_constraints:
            DAY_INDEX = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5}
            MORNING_PERIODS = list(range(0, const.NUM_TEACHING_SLOTS_PER_DAY // 2))
            AFTERNOON_PERIODS = list(range(const.NUM_TEACHING_SLOTS_PER_DAY // 2, const.NUM_TEACHING_SLOTS_PER_DAY))
            for c in self.slm_constraints:
                ctype = c.get('type', '').upper()
                if ctype == 'FACULTY_UNAVAILABLE' and c.get('faculty_id') == task.faculty.id:
                    days = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
                    for day in days:
                        off = day * const.NUM_TEACHING_SLOTS_PER_DAY
                        for p in range(const.NUM_TEACHING_SLOTS_PER_DAY):
                            for o in range(task.duration):
                                full_range.discard(off + p - o)
                elif ctype == 'SUBJECT_PREFERRED_TIME':
                    if c.get('subject_code') == task.subject.subject_code:
                        period = str(c.get('period','')).upper()
                        target = MORNING_PERIODS if 'MORNING' in period else AFTERNOON_PERIODS
                        if target:
                            full_range = {s for s in full_range if (s % const.NUM_TEACHING_SLOTS_PER_DAY) in target}
                elif ctype == 'WORKING_DAYS':
                    allowed_days = {DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX}
                    if allowed_days:
                        full_range = {s for s in full_range if (s // const.NUM_TEACHING_SLOTS_PER_DAY) in allowed_days}
                elif ctype == 'SECTION_FREE_SLOT' and c.get('section_id') == task.section.section_id:
                    slot_index = c.get('slot')
                    days = [DAY_INDEX[d] for d in (c.get('days') or []) if d in DAY_INDEX]
                    if not days:
                        days = list(range(const.NUM_WORKING_DAYS))
                    if slot_index is not None:
                        for day in days:
                            off = day * const.NUM_TEACHING_SLOTS_PER_DAY
                            for o in range(task.duration):
                                full_range.discard(off + slot_index - 1 - o)
                                
        return sorted(list(full_range))

    def _get_allowed_rooms(self, task: Task) -> List[int]:
        if task.subject.subject_code in ["LIB_HR", "STU_HR", "FAC_HR", "STDY_HR"]:
            return [-1]
            
        allowed = []
        for i, room in enumerate(self.rooms):
            type_match = (task.subject.subject_type == SubjectType.LAB) == room.is_lab
            cap_match = room.capacity >= task.section.student_strength
            if type_match and cap_match: allowed.append(i)
        if not allowed: raise ValueError(f"No room for {task.task_id}")
        return allowed

    def _add_stretch_constraint_for_entity(self, tasks: List[Task], entity_name: str):
        if not tasks: return
        for day in range(const.NUM_WORKING_DAYS):
            for i in range(const.NUM_TEACHING_SLOTS_PER_DAY - self.max_continuous_stretch):
                window_start = day * const.NUM_TEACHING_SLOTS_PER_DAY + i
                window_slots = range(window_start, window_start + self.max_continuous_stretch + 1)
                literals = []
                for slot in window_slots:
                    is_active = self.model.NewBoolVar(f"{entity_name}_act_{slot}")
                    at_slot = []
                    for t in tasks:
                        start, dur = self.task_vars[t.task_id][0], t.duration
                        cov = self.model.NewBoolVar(f"{t.task_id}_cov_{slot}")
                        self.model.Add(start <= slot).OnlyEnforceIf(cov)
                        self.model.Add(start + dur > slot).OnlyEnforceIf(cov)
                        at_slot.append(cov)
                    self.model.AddBoolOr(at_slot).OnlyEnforceIf(is_active)
                    for lit in at_slot: self.model.AddImplication(is_active.Not(), lit.Not())
                    literals.append(is_active)
                self.model.Add(sum(literals) <= self.max_continuous_stretch)
