import json
from data_loader import prepare_scheduling_tasks, Allocation
from models import Faculty, Subject, Section, Room, SubjectType
from solver import TimetableSolver

def _subject_type(type_str: str) -> SubjectType:
    return {
        "THEORY": SubjectType.THEORY,
        "LAB": SubjectType.LAB,
        "SOFTSKILL": SubjectType.SOFTSKILL,
        "FORUM": SubjectType.FORUM,
    }.get(type_str.upper(), SubjectType.THEORY)

with open(r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_slm-main\timetable_data.json', 'r') as f:
    data = json.load(f)

facs = [Faculty(f["id"], f["name"], f["designation"], f["max_hours"]) for f in data["faculties"]]
subs = [Subject(s["code"], s["name"], s["credits"], _subject_type(s["type"]), s.get("is_core", True), s.get("is_heavy", False)) for s in data["subjects"]]
secs = [Section(s["id"], s["semester"], s["strength"]) for s in data["sections"]]
rooms = [Room(r["id"], r["capacity"], r["is_lab"], r["building"]) for r in data["rooms"]]
allocs = [Allocation(a["faculty_id"], a["subject_code"], a["section_id"], a.get("elective_group")) for a in data["allocations"]]

tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)
solver = TimetableSolver(tasks, facs, secs, rooms, max_continuous_stretch=3)
result = solver.solve(time_limit_seconds=10)
print("Solver status:", result['status'])
