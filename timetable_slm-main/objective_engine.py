# objective_engine.py

"""
This module implements the ObjectiveEngine for the VTU Automated Timetable Generator.
It handles ONLY SOFT CONSTRAINTS by adding weighted penalties to the solver's objective function.

Responsibilities:
- Define penalties for undesirable schedules (e.g., gaps, late core classes).
- Create auxiliary variables to calculate complex metrics (like daily span).
- Sum all weighted penalties and set the Minimization objective.

This module is optional and pluggable. It does not enforce hard rules.
"""

from typing import List, Dict
from ortools.sat.python import cp_model
from collections import defaultdict

# Import project-specific modules
from models import Task, Faculty, Section, Room, SubjectType
import constants as const
# Type hint for the ConstraintEngine
from constraint_engine import ConstraintEngine

class ObjectiveEngine:
    """
    Manages soft constraints and the optimization objective.
    """
    def __init__(
        self,
        model: cp_model.CpModel,
        constraint_engine: ConstraintEngine,
        tasks: List[Task],
        faculties: List[Faculty],
        sections: List[Section],
        rooms: List[Room],
        weights: Dict[str, int] = None
    ):
        """
        Initializes the ObjectiveEngine.
        """
        self.model = model
        self.ce = constraint_engine
        self.tasks = tasks
        self.faculties = faculties
        self.sections = sections
        self.rooms = rooms

        # Default weights if none provided
        self.weights = weights or {
            "subject_repetition": 10,
            "morning_core": 5,
            "late_heavy": 5,
            "faculty_gaps": 30,
            "student_gaps": 100,
            "isolated_afternoon": 100,
            "campus_movement": 3,
            "faculty_load_balance": 1,
            "no_first_hour_free": 50
        }
        
        self.penalties: List[cp_model.IntVar] = []

    def build_objective(self):
        """
        Applies all configured soft constraints and sets the minimization objective.
        """
        print("Building Objective Function...")
        
        self._minimize_subject_repetition()
        self._prioritize_morning_core_subjects()
        self._avoid_late_heavy_subjects()
        
        self._minimize_faculty_gaps()
        self._minimize_student_gaps()
        self._penalize_isolated_afternoon_classes()
        self._minimize_campus_movement()
        self._penalize_first_hour_free()

        # Summation of all penalties
        if self.penalties:
            total_cost = sum(self.penalties)
            self.model.Minimize(total_cost)
        else:
            self.model.Minimize(0)

    def _minimize_subject_repetition(self):
        """
        Penalizes scheduling the same theory subject multiple times on the same day
        for a specific section.
        """
        weight = self.weights.get("subject_repetition", 0)
        if weight == 0: return

        # Group tasks by (section, subject)
        tasks_by_sec_sub = {}
        for task in self.tasks:
            if task.subject.subject_type == SubjectType.THEORY:
                key = (task.section.section_id, task.subject.subject_code)
                if key not in tasks_by_sec_sub:
                    tasks_by_sec_sub[key] = []
                tasks_by_sec_sub[key].append(task)

        for (sec_id, sub_code), subject_tasks in tasks_by_sec_sub.items():
            if len(subject_tasks) < 2:
                continue

            # Compare every pair
            for i in range(len(subject_tasks)):
                for j in range(i + 1, len(subject_tasks)):
                    t1 = subject_tasks[i]
                    t2 = subject_tasks[j]
                    
                    start_var_1 = self.ce.task_vars[t1.task_id][0]
                    start_var_2 = self.ce.task_vars[t2.task_id][0]

                    # Create variables representing the day index (0-4)
                    day_1 = self.model.NewIntVar(0, const.NUM_WORKING_DAYS - 1, f"day_{t1.task_id}")
                    day_2 = self.model.NewIntVar(0, const.NUM_WORKING_DAYS - 1, f"day_{t2.task_id}")

                    # Helper: day = start_slot // slots_per_day
                    self.model.AddDivisionEquality(day_1, start_var_1, const.NUM_TEACHING_SLOTS_PER_DAY)
                    self.model.AddDivisionEquality(day_2, start_var_2, const.NUM_TEACHING_SLOTS_PER_DAY)

                    # Reify: are they on the same day?
                    same_day = self.model.NewBoolVar(f"same_day_{t1.task_id}_{t2.task_id}")
                    self.model.Add(day_1 == day_2).OnlyEnforceIf(same_day)
                    self.model.Add(day_1 != day_2).OnlyEnforceIf(same_day.Not())

                    # Add penalty
                    self.penalties.append(same_day * weight)

    def _prioritize_morning_core_subjects(self):
        """
        Penalizes Core subjects if they are scheduled after the lunch break.
        """
        weight = self.weights.get("morning_core", 0)
        if weight == 0: return

        # Assume slots 0-3 are morning, 4-7 are afternoon
        afternoon_start_index = 4 

        for task in self.tasks:
            if task.subject.is_core and task.subject.subject_type == SubjectType.THEORY:
                start_var = self.ce.task_vars[task.task_id][0]
                
                daily_slot = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY - 1, f"daily_slot_{task.task_id}")
                self.model.AddModuloEquality(daily_slot, start_var, const.NUM_TEACHING_SLOTS_PER_DAY)

                # Penalty if daily_slot >= afternoon_start_index
                is_afternoon = self.model.NewBoolVar(f"is_afternoon_{task.task_id}")
                self.model.Add(daily_slot >= afternoon_start_index).OnlyEnforceIf(is_afternoon)
                self.model.Add(daily_slot < afternoon_start_index).OnlyEnforceIf(is_afternoon.Not())

                self.penalties.append(is_afternoon * weight)

    def _avoid_late_heavy_subjects(self):
        """
        Penalizes Heavy subjects if they are scheduled in the very last slot of the day.
        """
        weight = self.weights.get("late_heavy", 0)
        if weight == 0: return

        last_slot_index = const.NUM_TEACHING_SLOTS_PER_DAY - 1

        for task in self.tasks:
            if task.subject.is_heavy:
                start_var = self.ce.task_vars[task.task_id][0]
                
                daily_slot = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY - 1, f"daily_slot_heavy_{task.task_id}")
                self.model.AddModuloEquality(daily_slot, start_var, const.NUM_TEACHING_SLOTS_PER_DAY)

                is_last_slot = self.model.NewBoolVar(f"is_last_slot_{task.task_id}")
                self.model.Add(daily_slot == last_slot_index).OnlyEnforceIf(is_last_slot)
                self.model.Add(daily_slot != last_slot_index).OnlyEnforceIf(is_last_slot.Not())

                self.penalties.append(is_last_slot * weight)

    def _minimize_faculty_gaps(self):
        """
        Penalizes 'idle spans' for faculty.
        We approximate this by minimizing (Daily End Time - Daily Start Time - Total Teaching Duration).
        """
        weight = self.weights.get("faculty_gaps", 0)
        if weight == 0: return

        # Group tasks by faculty
        tasks_by_faculty = {f.id: [] for f in self.faculties}
        faculty_ids_set = {f.id for f in self.faculties}
        for task in self.tasks:
            parts = task.faculty.id.split('_')
            fids = parts if len(parts) > 1 and all(p in faculty_ids_set for p in parts) else [task.faculty.id]
            for fid in fids:
                if fid in tasks_by_faculty:
                    tasks_by_faculty[fid].append(task)

        for faculty_id, f_tasks in tasks_by_faculty.items():
            if not f_tasks:
                continue

            for day in range(const.NUM_WORKING_DAYS):
                day_offset_start = day * const.NUM_TEACHING_SLOTS_PER_DAY
                day_offset_end = (day + 1) * const.NUM_TEACHING_SLOTS_PER_DAY

                # Variables to track if faculty is active on this day, and their start/end
                day_active = self.model.NewBoolVar(f"active_{faculty_id}_{day}")
                day_start = self.model.NewIntVar(day_offset_start, day_offset_end, f"start_{faculty_id}_{day}")
                day_end = self.model.NewIntVar(day_offset_start, day_offset_end, f"end_{faculty_id}_{day}")
                
                task_on_day_lits = []
                total_duration_on_day = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"dur_{faculty_id}_{day}")
                
                durations_sum = []

                for task in f_tasks:
                    t_start = self.ce.task_vars[task.task_id][0]
                    t_end = self.ce.task_vars[task.task_id][1]
                    
                    is_on_day = self.model.NewBoolVar(f"{task.task_id}_on_day_{day}")
                    
                    t_day = self.model.NewIntVar(0, const.NUM_WORKING_DAYS - 1, f"t_day_{task.task_id}_{day}")
                    self.model.AddDivisionEquality(t_day, t_start, const.NUM_TEACHING_SLOTS_PER_DAY)
                    
                    self.model.Add(t_day == day).OnlyEnforceIf(is_on_day)
                    self.model.Add(t_day != day).OnlyEnforceIf(is_on_day.Not())

                    task_on_day_lits.append(is_on_day)

                    # Update min start and max end for the day ONLY if task is on this day
                    self.model.Add(day_start <= t_start).OnlyEnforceIf(is_on_day)
                    self.model.Add(day_end >= t_end).OnlyEnforceIf(is_on_day)
                    
                    # Accumulate duration
                    dur_term = self.model.NewIntVar(0, task.duration, f"dur_term_{task.task_id}_{day}")
                    self.model.Add(dur_term == task.duration).OnlyEnforceIf(is_on_day)
                    self.model.Add(dur_term == 0).OnlyEnforceIf(is_on_day.Not())
                    durations_sum.append(dur_term)

                # If no tasks on this day, force active to false
                self.model.Add(sum(task_on_day_lits) > 0).OnlyEnforceIf(day_active)
                self.model.Add(sum(task_on_day_lits) == 0).OnlyEnforceIf(day_active.Not())
                
                # --- FIX: Use Python sum() inside Add() instead of self.model.Sum() ---
                self.model.Add(total_duration_on_day == sum(durations_sum))

                span = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"span_{faculty_id}_{day}")
                self.model.Add(span == day_end - day_start).OnlyEnforceIf(day_active)
                self.model.Add(span == 0).OnlyEnforceIf(day_active.Not())
                
                idle_time = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"idle_{faculty_id}_{day}")
                self.model.Add(idle_time == span - total_duration_on_day).OnlyEnforceIf(day_active)
                self.model.Add(idle_time == 0).OnlyEnforceIf(day_active.Not())

                self.penalties.append(idle_time * weight)

    def _minimize_student_gaps(self):
        """
        Penalizes 'idle spans' for students (sections).
        """
        weight = self.weights.get("student_gaps", 10)
        if weight == 0: return

        tasks_by_section = defaultdict(list)
        for task in self.tasks:
            tasks_by_section[task.section.section_id].append(task)

        for sec_id, s_tasks in tasks_by_section.items():
            if not s_tasks:
                continue

            for day in range(const.NUM_WORKING_DAYS):
                day_offset_start = day * const.NUM_TEACHING_SLOTS_PER_DAY
                day_offset_end = (day + 1) * const.NUM_TEACHING_SLOTS_PER_DAY

                day_active = self.model.NewBoolVar(f"sec_active_{sec_id}_{day}")
                day_start = self.model.NewIntVar(day_offset_start, day_offset_end, f"sec_start_{sec_id}_{day}")
                day_end = self.model.NewIntVar(day_offset_start, day_offset_end, f"sec_end_{sec_id}_{day}")
                
                task_on_day_lits = []
                total_duration_on_day = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"sec_dur_{sec_id}_{day}")
                
                durations_sum = []

                for task in s_tasks:
                    t_start = self.ce.task_vars[task.task_id][0]
                    t_end = self.ce.task_vars[task.task_id][1]
                    
                    is_on_day = self.model.NewBoolVar(f"sec_{task.task_id}_on_day_{day}")
                    
                    t_day = self.model.NewIntVar(0, const.NUM_WORKING_DAYS - 1, f"sec_t_day_{task.task_id}_{day}")
                    self.model.AddDivisionEquality(t_day, t_start, const.NUM_TEACHING_SLOTS_PER_DAY)
                    
                    self.model.Add(t_day == day).OnlyEnforceIf(is_on_day)
                    self.model.Add(t_day != day).OnlyEnforceIf(is_on_day.Not())

                    task_on_day_lits.append(is_on_day)

                    # Update min start and max end for the day ONLY if task is on this day
                    self.model.Add(day_start <= t_start).OnlyEnforceIf(is_on_day)
                    self.model.Add(day_end >= t_end).OnlyEnforceIf(is_on_day)
                    
                    dur_term = self.model.NewIntVar(0, task.duration, f"sec_dur_term_{task.task_id}_{day}")
                    self.model.Add(dur_term == task.duration).OnlyEnforceIf(is_on_day)
                    self.model.Add(dur_term == 0).OnlyEnforceIf(is_on_day.Not())
                    durations_sum.append(dur_term)

                self.model.Add(sum(task_on_day_lits) > 0).OnlyEnforceIf(day_active)
                self.model.Add(sum(task_on_day_lits) == 0).OnlyEnforceIf(day_active.Not())
                
                self.model.Add(total_duration_on_day == sum(durations_sum))

                span = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"sec_span_{sec_id}_{day}")
                self.model.Add(span == day_end - day_start).OnlyEnforceIf(day_active)
                self.model.Add(span == 0).OnlyEnforceIf(day_active.Not())
                
                idle_time = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"sec_idle_{sec_id}_{day}")
                self.model.Add(idle_time == span - total_duration_on_day).OnlyEnforceIf(day_active)
                self.model.Add(idle_time == 0).OnlyEnforceIf(day_active.Not())

                self.penalties.append(idle_time * weight)

    def _penalize_isolated_afternoon_classes(self):
        """
        Penalizes sections having only 1 or 2 classes (slots) after lunch.
        Students would rather have either no afternoon classes or a full afternoon.
        """
        weight = self.weights.get("isolated_afternoon", 10)
        if weight == 0: return

        afternoon_start_index = 4 # Index for slots after lunch
        
        tasks_by_section = defaultdict(list)
        for task in self.tasks:
            tasks_by_section[task.section.section_id].append(task)
            
        for sec_id, s_tasks in tasks_by_section.items():
            for day in range(const.NUM_WORKING_DAYS):
                afternoon_duration_sum = []
                
                for task in s_tasks:
                    start_var = self.ce.task_vars[task.task_id][0]
                    
                    daily_slot = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY - 1, f"daily_slot_{task.task_id}_{day}")
                    self.model.AddModuloEquality(daily_slot, start_var, const.NUM_TEACHING_SLOTS_PER_DAY)
                    
                    t_day = self.model.NewIntVar(0, const.NUM_WORKING_DAYS - 1, f"t_day_{task.task_id}_aft_{day}")
                    self.model.AddDivisionEquality(t_day, start_var, const.NUM_TEACHING_SLOTS_PER_DAY)
                    
                    is_on_day = self.model.NewBoolVar(f"is_on_day_{task.task_id}_{day}_aft")
                    self.model.Add(t_day == day).OnlyEnforceIf(is_on_day)
                    self.model.Add(t_day != day).OnlyEnforceIf(is_on_day.Not())

                    is_afternoon = self.model.NewBoolVar(f"is_afternoon_{task.task_id}_{day}_aft")
                    self.model.Add(daily_slot >= afternoon_start_index).OnlyEnforceIf(is_afternoon)
                    self.model.Add(daily_slot < afternoon_start_index).OnlyEnforceIf(is_afternoon.Not())

                    # Task is on this day AND in the afternoon
                    is_on_day_and_afternoon = self.model.NewBoolVar(f"is_on_day_and_afternoon_{task.task_id}_{day}")
                    self.model.AddBoolAnd([is_on_day, is_afternoon]).OnlyEnforceIf(is_on_day_and_afternoon)
                    
                    dur_term = self.model.NewIntVar(0, task.duration, f"aft_dur_{task.task_id}_{day}")
                    self.model.Add(dur_term == task.duration).OnlyEnforceIf(is_on_day_and_afternoon)
                    self.model.Add(dur_term == 0).OnlyEnforceIf(is_on_day_and_afternoon.Not())
                    
                    afternoon_duration_sum.append(dur_term)
                    
                total_afternoon_dur = self.model.NewIntVar(0, const.NUM_TEACHING_SLOTS_PER_DAY, f"tot_aft_dur_{sec_id}_{day}")
                if afternoon_duration_sum:
                    self.model.Add(total_afternoon_dur == sum(afternoon_duration_sum))
                else:
                    self.model.Add(total_afternoon_dur == 0)
                    
                # We want to penalize if total_afternoon_dur is 1 or 2.
                is_dur_1 = self.model.NewBoolVar(f"is_dur_1_{sec_id}_{day}")
                self.model.Add(total_afternoon_dur == 1).OnlyEnforceIf(is_dur_1)
                self.model.Add(total_afternoon_dur != 1).OnlyEnforceIf(is_dur_1.Not())

                is_dur_2 = self.model.NewBoolVar(f"is_dur_2_{sec_id}_{day}")
                self.model.Add(total_afternoon_dur == 2).OnlyEnforceIf(is_dur_2)
                self.model.Add(total_afternoon_dur != 2).OnlyEnforceIf(is_dur_2.Not())

                is_isolated = self.model.NewBoolVar(f"is_isolated_{sec_id}_{day}")
                self.model.AddBoolOr([is_dur_1, is_dur_2]).OnlyEnforceIf(is_isolated)
                self.model.AddBoolAnd([is_dur_1.Not(), is_dur_2.Not()]).OnlyEnforceIf(is_isolated.Not())
                
                self.penalties.append(is_isolated * weight)

    def _minimize_campus_movement(self):
        """
        Penalizes consecutive tasks for a section that are in different buildings.
        """
        weight = self.weights.get("campus_movement", 0)
        if weight == 0: return
        
        unique_buildings = sorted(list(set(r.building for r in self.rooms)))
        building_to_id = {b: i for i, b in enumerate(unique_buildings)}
        room_idx_to_building_id = [building_to_id[r.building] for r in self.rooms]

        tasks_by_section = defaultdict(list)
        for task in self.tasks:
            tasks_by_section[task.section.section_id].append(task)

        for sec_id, sec_tasks in tasks_by_section.items():
            if len(sec_tasks) < 2: continue
            
            for i in range(len(sec_tasks)):
                for j in range(len(sec_tasks)):
                    if i == j: continue
                    t1 = sec_tasks[i]
                    t2 = sec_tasks[j]

                    t1_end = self.ce.task_vars[t1.task_id][1]
                    t2_start = self.ce.task_vars[t2.task_id][0]
                    
                    is_consecutive = self.model.NewBoolVar(f"consec_{t1.task_id}_{t2.task_id}")
                    self.model.Add(t1_end == t2_start).OnlyEnforceIf(is_consecutive)
                    self.model.Add(t1_end != t2_start).OnlyEnforceIf(is_consecutive.Not())

                    b1_var = self.model.NewIntVar(0, len(unique_buildings), f"bld_{t1.task_id}")
                    b2_var = self.model.NewIntVar(0, len(unique_buildings), f"bld_{t2.task_id}")
                    
                    room_var_1 = self.ce.task_vars[t1.task_id][3]
                    room_var_2 = self.ce.task_vars[t2.task_id][3]

                    self.model.AddElement(room_var_1, room_idx_to_building_id, b1_var)
                    self.model.AddElement(room_var_2, room_idx_to_building_id, b2_var)

                    diff_building = self.model.NewBoolVar(f"diff_bld_{t1.task_id}_{t2.task_id}")
                    self.model.Add(b1_var != b2_var).OnlyEnforceIf(diff_building)
                    self.model.Add(b1_var == b2_var).OnlyEnforceIf(diff_building.Not())

                    penalty_active = self.model.NewBoolVar(f"move_pen_{t1.task_id}_{t2.task_id}")
                    self.model.AddBoolAnd([is_consecutive, diff_building]).OnlyEnforceIf(penalty_active)
                    
                    self.penalties.append(penalty_active * weight)

    def _penalize_first_hour_free(self):
        """
        Strongly penalizes having the first hour (period index 0) free for any
        section on any day. The solver will avoid this unless there is genuinely
        no other feasible assignment.

        Since tasks never cross day boundaries, a task covers period 0 of a day
        if and only if its start_var equals that day's first absolute slot index.
        """
        weight = self.weights.get("no_first_hour_free", 20)
        if weight == 0:
            return

        # Group tasks by section
        tasks_by_section = defaultdict(list)
        for task in self.tasks:
            tasks_by_section[task.section.section_id].append(task)

        for sec_id, sec_tasks in tasks_by_section.items():
            for day in range(const.NUM_WORKING_DAYS):
                # The absolute slot index for period 0 of this day
                first_slot = day * const.NUM_TEACHING_SLOTS_PER_DAY

                # For each task, create a bool: does it start at exactly first_slot?
                starts_at_first = []
                for task in sec_tasks:
                    start_var = self.ce.task_vars[task.task_id][0]

                    at_first = self.model.NewBoolVar(f"at1st_{task.task_id}_d{day}")
                    self.model.Add(start_var == first_slot).OnlyEnforceIf(at_first)
                    self.model.Add(start_var != first_slot).OnlyEnforceIf(at_first.Not())
                    starts_at_first.append(at_first)

                # any_at_first = True if at least one task starts at period 0
                any_at_first = self.model.NewBoolVar(f"any_at1st_{sec_id}_d{day}")
                self.model.AddBoolOr(starts_at_first).OnlyEnforceIf(any_at_first)
                for lit in starts_at_first:
                    self.model.AddImplication(any_at_first.Not(), lit.Not())

                # Penalty when the first hour IS free (no task at period 0)
                first_free = self.model.NewBoolVar(f"first_free_{sec_id}_d{day}")
                self.model.Add(first_free == 1).OnlyEnforceIf(any_at_first.Not())
                self.model.Add(first_free == 0).OnlyEnforceIf(any_at_first)

                self.penalties.append(first_free * weight)