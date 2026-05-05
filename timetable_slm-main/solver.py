# solver.py

from typing import List, Dict, Optional, Any, Tuple
from ortools.sat.python import cp_model

from models import Task, Faculty, Section, Room
from constraint_engine import ConstraintEngine

class TimetableSolver:

    def __init__(self, tasks, faculties, sections, rooms):
        self.tasks     = tasks
        self.faculties = faculties
        self.sections  = sections
        self.rooms     = rooms
        self.model     = cp_model.CpModel()
        self.solver    = cp_model.CpSolver()
        self.constraint_engine = None
        self.objective_engine  = None

    def solve(
        self,
        time_limit_seconds: int = 60,
        enable_soft_constraints: bool = True,
        soft_constraint_weights: Dict[str, int] = None,
        log_search_progress: bool = True,
        num_workers: int = 8,
        slm_constraints: List[Dict[str, Any]] = None,
        scheduling_rules: List[Dict[str, Any]] = None,
    ) -> Tuple[str, Optional[Dict[str, Any]]]:

        # 1. Hard constraints
        print("Initializing Constraint Engine...")
        self.constraint_engine = ConstraintEngine(
            model=self.model, tasks=self.tasks, faculties=self.faculties,
            sections=self.sections, rooms=self.rooms,
            slm_constraints=slm_constraints, scheduling_rules=scheduling_rules
        )
        self.constraint_engine.apply_all_constraints()

        # 2. Soft constraints
        if enable_soft_constraints:
            print("Initializing Objective Engine...")
            from objective_engine import ObjectiveEngine
            self.objective_engine = ObjectiveEngine(
                model=self.model,
                constraint_engine=self.constraint_engine,
                tasks=self.tasks, faculties=self.faculties,
                sections=self.sections, rooms=self.rooms,
                weights=soft_constraint_weights
            )
            self.objective_engine.build_objective()

        # 4. Configure solver
        self.solver.parameters.max_time_in_seconds  = time_limit_seconds
        self.solver.parameters.log_search_progress  = log_search_progress
        self.solver.parameters.num_search_workers   = num_workers

        # 5. Solve
        print(f"Starting solver (Limit: {time_limit_seconds}s)...")
        status_val = self.solver.Solve(self.model)

        status_map = {
            cp_model.OPTIMAL:       "OPTIMAL",
            cp_model.FEASIBLE:      "FEASIBLE",
            cp_model.INFEASIBLE:    "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN:       "UNKNOWN"
        }
        status_str = status_map.get(status_val, "UNKNOWN")
        print(f"Solver finished: {status_str}")

        solution = None
        if status_val in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            solution = self._extract_solution()
            print(f"Solution found! Objective: {self.solver.ObjectiveValue()}")
        else:
            print("No solution found.")

        return status_str, solution

    def _extract_solution(self):
        import constants as const
        schedule = {}
        for task in self.tasks:
            start_var, _, _, room_var = self.constraint_engine.task_vars[task.task_id]
            start_slot   = self.solver.Value(start_var)
            room_index   = self.solver.Value(room_var)
            assigned_room = self.rooms[room_index]
            day_index    = start_slot // const.NUM_TEACHING_SLOTS_PER_DAY
            period_index = start_slot  % const.NUM_TEACHING_SLOTS_PER_DAY
            schedule[task.task_id] = {
                "task_obj":     task,
                "start_slot":   start_slot,
                "day_index":    day_index,
                "day_name":     const.DAYS[day_index],
                "period_index": period_index,
                "room_id":      assigned_room.room_id,
                "room_name":    f"{assigned_room.room_id} ({assigned_room.building})",
                "faculty_name": task.faculty.name,
                "subject_code": task.subject.subject_code,
                "section_id":   task.section.section_id,
                "duration":     task.duration
            }
        return schedule