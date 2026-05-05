
import json
from models import Faculty, Subject, Section, Room, SubjectType
from data_loader import Allocation, prepare_scheduling_tasks
from solver import TimetableSolver
import constants as const

def get_subject_type_enum(type_str):
    mapping = {
        "THEORY": SubjectType.THEORY,
        "LAB": SubjectType.LAB,
        "SOFTSKILL": SubjectType.SOFTSKILL,
        "FORUM": SubjectType.FORUM
    }
    return mapping.get(type_str.upper(), SubjectType.THEORY)

def convert_json_to_objects(data):
    fac_objs = [Faculty(f['id'], f['name'], f['designation'], f['max_hours']) for f in data['faculties']]
    
    sub_objs = [Subject(
        s['code'], s['name'], s['credits'], 
        get_subject_type_enum(s['type']), 
        s.get('is_core', True), s.get('is_heavy', False)
    ) for s in data['subjects']]
    
    sec_objs = [Section(s['id'], s['semester'], s['strength']) for s in data['sections']]
    
    room_objs = [Room(r['id'], r['capacity'], r['is_lab'], r['building']) for r in data['rooms']]
    
    alloc_objs = [Allocation(
        a['faculty_id'], a['subject_code'], a['section_id'], a.get('elective_group')
    ) for a in data['allocations']]
    
    return fac_objs, sub_objs, sec_objs, room_objs, alloc_objs

def main():
    with open("timetable_data.json", "r") as f:
        data = json.load(f)

    facs, subs, secs, rooms, allocs = convert_json_to_objects(data)
    tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)
    
    print(f"Scheduling {len(tasks)} tasks...")
    
    solver = TimetableSolver(tasks, facs, secs, rooms)
    status, solution = solver.solve(time_limit_seconds=30)
    
    print(f"Status: {status}")
    if status in ["OPTIMAL", "FEASIBLE"]:
        print("Success!")
    else:
        print("Failed.")

if __name__ == "__main__":
    main()
