# reoptimizer.py

"""
This module handles emergency re-optimization of an existing timetable.
It is used when a disruption occurs (e.g., Faculty Leave) and the schedule
must be adjusted with minimal changes to the rest of the institution.

Strategy:
1. Accept the original solution.
2. Identify which Sections are directly affected by the disruption.
3. "Freeze" (Fixed Constraint) all tasks belonging to unaffected sections.
4. "Relax" (Variable) tasks belonging to affected sections, allowing them to swap slots.
5. Add a penalty for every task that changes from its original slot to minimize disruption.
"""

from typing import List, Dict, Any, Tuple, Set
from ortools.sat.python import cp_model

# Import project components
from models import Task, Faculty, Section, Room
from constraint_engine import ConstraintEngine
import constants as const

class EmergencyReoptimizer:
    """
    Specialized solver for adjusting existing timetables under new constraints.
    """

    def __init__(
        self,
        tasks: List[Task],
        faculties: List[Faculty],
        sections: List[Section],
        rooms: List[Room]
    ):
        self.tasks = tasks
        self.faculties = faculties
        self.sections = sections
        self.rooms = rooms
        
        # Internal lookups
        self.tasks_by_id = {t.task_id: t for t in tasks}

    def reoptimize_for_faculty_leave(
        self,
        current_schedule: Dict[str, Dict[str, Any]],
        faculty_id: str,
        leave_day_index: int,
        time_limit_seconds: int = 30
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Adjusts the schedule to accommodate a faculty member being unavailable on a specific day.
        
        Args:
            current_schedule: The output dictionary from the original Solver.
            faculty_id: The ID of the faculty on leave.
            leave_day_index: The day index (0=Mon, 4=Fri) of the leave.
            time_limit_seconds: Max time for re-solving.

        Returns:
            Tuple (status, new_schedule)
        """
        print(f"--- Starting Emergency Re-optimization: Faculty {faculty_id} on Day {leave_day_index} ---")

        # 1. Initialize a fresh model
        model = cp_model.CpModel()
        
        # 2. Initialize Constraint Engine (applies all HARD constraints: limits, rooms, etc.)
        # We assume the Faculty object's availability hasn't been permanently changed in the DB,
        # so we will add the leave constraint manually below.
        ce = ConstraintEngine(model, self.tasks, self.faculties, self.sections, self.rooms)
        ce.apply_all_constraints()

        # 3. Apply the Emergency Constraint: Faculty Unavailable on Leave Day
        self._apply_leave_constraint(model, ce, faculty_id, leave_day_index)

        # 4. Identify Affected Sections
        # We need to unfreeze any section that has a class with this faculty on that day,
        # so the solver can swap that class with another class from a different day.
        affected_section_ids = self._identify_affected_sections(current_schedule, faculty_id, leave_day_index)
        print(f"Affected Sections (Schedule will be relaxed): {affected_section_ids}")

        # 5. Apply Freezing and Change Penalties
        self._freeze_and_relax_variables(model, ce, current_schedule, affected_section_ids)

        # 6. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_search_workers = 8
        
        status_val = solver.Solve(model)
        
        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "UNKNOWN"
        }
        status_str = status_map.get(status_val, "UNKNOWN")
        print(f"Re-optimization finished: {status_str}")

        if status_val in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return status_str, self._extract_solution(solver, ce)
        else:
            print("Could not find a valid solution for the emergency constraint.")
            return status_str, None

    def _apply_leave_constraint(self, model: cp_model.CpModel, ce: ConstraintEngine, faculty_id: str, day_index: int):
        """
        Hard constraint: The specific faculty cannot teach on the specific day.
        """
        day_start_slot = day_index * const.NUM_TEACHING_SLOTS_PER_DAY
        day_end_slot = (day_index + 1) * const.NUM_TEACHING_SLOTS_PER_DAY
        
        # Iterate over all tasks taught by this faculty
        for task in self.tasks:
            if task.faculty.id == faculty_id:
                start_var = ce.task_vars[task.task_id][0]
                
                # Logic: Task cannot start within the day's range.
                # Since tasks are interval vars, we technically check overlap, 
                # but start_time check is usually sufficient for single-day constraint 
                # if duration doesn't span days (which it doesn't).
                
                # We enforce: start_var < day_start OR start_var >= day_end
                # This effectively bans the task from that day.
                
                # Using boolean indicators to enforce the "OR" logic
                before_day = model.NewBoolVar(f"{task.task_id}_before_leave")
                after_day = model.NewBoolVar(f"{task.task_id}_after_leave")
                
                model.Add(start_var < day_start_slot).OnlyEnforceIf(before_day)
                model.Add(start_var >= day_end_slot).OnlyEnforceIf(after_day)
                
                # Must be either before OR after (cannot be during)
                model.AddBoolOr([before_day, after_day])

    def _identify_affected_sections(self, schedule: Dict, faculty_id: str, day_index: int) -> Set[str]:
        """
        Identifies which sections have a class with the faculty on the leave day.
        These are the sections that need their schedules relaxed to allow swapping.
        """
        affected_sections = set()
        
        for task_id, data in schedule.items():
            # Check if this task is taught by the faculty on the specific day
            if data['faculty_name'] == self.tasks_by_id[task_id].faculty.name: # Ideally match ID
                # We use the faculty object from the task list to be safe
                task_fac_id = self.tasks_by_id[task_id].faculty.id
                
                if task_fac_id == faculty_id and data['day_index'] == day_index:
                    affected_sections.add(data['section_id'])
                    
        return affected_sections

    def _freeze_and_relax_variables(
        self,
        model: cp_model.CpModel,
        ce: ConstraintEngine,
        current_schedule: Dict,
        affected_section_ids: Set[str]
    ):
        """
        Freezes tasks for unaffected sections.
        Adds penalties for changing tasks for affected sections.
        """
        change_vars = []

        for task in self.tasks:
            # Get the CP variables for this task
            start_var, _, _, room_var = ce.task_vars[task.task_id]
            
            # Get original values
            if task.task_id in current_schedule:
                original_start = current_schedule[task.task_id]['start_slot']
                original_room_id = current_schedule[task.task_id]['room_id']
                # Map room ID back to index
                original_room_idx = ce.room_map[original_room_id]
            else:
                # Should not happen in a valid existing schedule, but safe fallback
                continue

            if task.section.section_id not in affected_section_ids:
                # --- STRATEGY A: FREEZE UNAFFECTED ---
                # This task belongs to a section that is NOT affected by the leave.
                # Its schedule should remain exactly the same to preserve stability.
                model.Add(start_var == original_start)
                model.Add(room_var == original_room_idx)
            else:
                # --- STRATEGY B: RELAX AND PENALIZE AFFECTED ---
                # This task belongs to a section that needs to reshuffle.
                # We allow it to move, but we penalize it if it does.
                
                # Boolean: Is the new start time different from the old start time?
                is_changed = model.NewBoolVar(f"changed_{task.task_id}")
                model.Add(start_var != original_start).OnlyEnforceIf(is_changed)
                model.Add(start_var == original_start).OnlyEnforceIf(is_changed.Not())
                
                # Weight the penalty.
                # If this specific task is the one causing the conflict (taught by absent faculty),
                # it MUST change, so the penalty is inevitable (and ignored by solver logic essentially).
                # For other tasks (swapping candidates), the penalty discourages unnecessary moves.
                change_vars.append(is_changed)

        # Minimize the total number of tasks moved
        if change_vars:
            model.Minimize(sum(change_vars))

    def _extract_solution(self, solver: cp_model.CpSolver, ce: ConstraintEngine) -> Dict:
        """
        Extracts the new schedule similar to the main solver.
        """
        schedule = {}
        for task in self.tasks:
            start_var, _, _, room_var = ce.task_vars[task.task_id]
            
            start_slot = solver.Value(start_var)
            room_index = solver.Value(room_var)
            assigned_room = self.rooms[room_index]
            
            day_index = start_slot // const.NUM_TEACHING_SLOTS_PER_DAY
            daily_slot_index = start_slot % const.NUM_TEACHING_SLOTS_PER_DAY

            schedule[task.task_id] = {
                "task_obj": task,
                "start_slot": start_slot,
                "day_index": day_index,
                "day_name": const.DAYS[day_index],
                "period_index": daily_slot_index,
                "room_id": assigned_room.room_id,
                "room_name": f"{assigned_room.room_id} ({assigned_room.building})",
                "faculty_name": task.faculty.name,
                "subject_code": task.subject.subject_code,
                "section_id": task.section.section_id,
                "duration": task.duration
            }
        return schedule