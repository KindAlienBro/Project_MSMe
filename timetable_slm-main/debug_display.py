
import json
from collections import defaultdict
from models import Faculty, Subject, Section, Room, SubjectType
from data_loader import Allocation, prepare_scheduling_tasks
from solver import TimetableSolver
import constants as const

# --- Models Helpers ---
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
    print("Loading data...")
    with open("timetable_data.json", "r") as f:
        data = json.load(f)

    facs, subs, secs, rooms, allocs = convert_json_to_objects(data)
    tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)
    
    print(f"Scheduling {len(tasks)} tasks...")
    
    solver = TimetableSolver(tasks, facs, secs, rooms)
    status, solution = solver.solve(time_limit_seconds=60)
    
    if status not in ["OPTIMAL", "FEASIBLE"]:
        print(f"Solver failed: {status}")
        return

    print("\n--- Display Logic Simulation ---")
    
    # 1. Identify Parent Sections
    parent_sections = sorted(list(set(s.section_id.split('-')[0].upper() for s in secs)))
    print(f"Parent Sections Found: {parent_sections}")
    
    # 2. Build Grid: merged_grid[parent_sec][day][period] = set of contents
    merged_grid = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))

    for task_id, info in solution.items():
        task_obj = info.get('task_obj')
        sec_id = info['section_id']
        parent_sec = sec_id.split('-')[0].upper()
        
        day, period, dur = info['day_index'], info['period_index'], info['duration']
        
        cell_content = info['subject_code'].upper()

        # Fill grid slots
        for i in range(dur):
            merged_grid[parent_sec][day][period + i].add(cell_content)

    # 3. Print Grid as Dict
    import pprint
    for p_sec, days in merged_grid.items():
        print(f"\nSECTION: {p_sec}")
        for day, periods in days.items():
            print(f"  Day {day}:")
            # The instruction implies a change from 'in' to '==' for a check.
            # The provided snippet introduces new lines with '==' but no 'in' to replace.
            # Assuming 'header_text' would be defined in a more complete context,
            # and applying the '==' as shown in the snippet.
            # For this specific context, 'header_text' is undefined, so these lines are commented out
            # or would require further context to be functional.
            # is_break = (header_text == "10:35-10:50")
            # is_lunch = (header_text == "12:40-1:40")
            for period, contents in sorted(periods.items()):
                print(f"    Period {period}: {contents}")

if __name__ == "__main__":
    main()
