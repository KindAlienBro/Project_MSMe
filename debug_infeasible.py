import sys
sys.path.append('timetable_slm-main')
from storage import load_data
from api import _build_objects
from data_loader import prepare_scheduling_tasks
from solver import TimetableSolver
from ortools.sat.python import cp_model

d = load_data()
facs, subs, secs, rooms, allocs = _build_objects(d)
tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)

print(f"Total tasks: {len(tasks)}")

print("Trying without scheduling rules...")
solver_no_rules = TimetableSolver(tasks, facs, secs, rooms)
status_no_rules, _ = solver_no_rules.solve(time_limit_seconds=15, scheduling_rules=[])
print(f"Status without rules: {status_no_rules}")

print("Trying with rules...")
solver_rules = TimetableSolver(tasks, facs, secs, rooms)
status_rules, _ = solver_rules.solve(time_limit_seconds=15, scheduling_rules=d.get('scheduling_rules', []))
print(f"Status with rules: {status_rules}")
