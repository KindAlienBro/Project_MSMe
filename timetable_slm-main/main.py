# main.py

"""
This is the main entry point for the VTU Automated Timetable Generator.

It performs the following steps:
1. Defines sample academic data (Faculties, Subjects, Sections, Rooms).
2. Uses the data_loader to convert this data into atomic 'Task' objects.
3. Initializes the TimetableSolver.
4. Runs the solver to generate a valid timetable.
5. Prints the resulting schedule in a human-readable grid format.
6. (Optional) Demonstrates the Emergency Re-optimizer functionality.

This file is a standalone script and can be replaced by a UI or API layer.
"""

import sys
from typing import List, Dict, Any

# Import project modules
from models import Faculty, Subject, Section, Room, SubjectType
from data_loader import Allocation, prepare_scheduling_tasks
from solver import TimetableSolver
from reoptimizer import EmergencyReoptimizer
import constants as const

def create_sample_data():
    """
    Creates mock data for a Computer Science department (3rd & 5th Semester).
    """
    print("Creating sample data...")

    # --- 1. Faculties ---
    # Define a mix of senior and junior faculties
    faculties = [
        Faculty("F01", "Dr. Alice", "Professor", max_hours_per_week=12),
        Faculty("F02", "Prof. Bob", "Assoc. Prof", max_hours_per_week=16),
        Faculty("F03", "Prof. Charlie", "Asst. Prof", max_hours_per_week=18),
        Faculty("F04", "Prof. Dave", "Asst. Prof", max_hours_per_week=18),
        Faculty("F05", "Prof. Eve", "Asst. Prof", max_hours_per_week=18),
        Faculty("F06", "Guest Fac", "Guest", max_hours_per_week=8),
    ]

    # --- 2. Subjects ---
    # Core Subjects, Labs, and Electives
    subjects = [
        # 5th Sem
        Subject("CS51", "Mgmt & Entrepren", 3, SubjectType.THEORY),
        Subject("CS52", "Computer Networks", 4, SubjectType.THEORY, is_core=True, is_heavy=True),
        Subject("CS53", "Database Mgmt", 4, SubjectType.THEORY, is_core=True, is_heavy=True),
        Subject("CS54", "Automata Theory", 3, SubjectType.THEORY, is_core=True),
        Subject("CS55", "Python Elective", 3, SubjectType.THEORY), # Elective
        Subject("CS56", "Java Elective", 3, SubjectType.THEORY),   # Elective
        Subject("CSL57", "Networks Lab", 1, SubjectType.LAB),      # 2-hour block
        Subject("CSL58", "DBMS Lab", 1, SubjectType.LAB),          # 2-hour block
        
        # 3rd Sem
        Subject("CS31", "Maths III", 3, SubjectType.THEORY, is_core=True),
        Subject("CS32", "Data Structures", 4, SubjectType.THEORY, is_core=True, is_heavy=True),
        Subject("CS33", "Analog Digital", 3, SubjectType.THEORY),
        Subject("CS34", "COA", 3, SubjectType.THEORY),
        Subject("CSL37", "DS Lab", 1, SubjectType.LAB),
        Subject("CSL38", "AD Lab", 1, SubjectType.LAB),
    ]

    # --- 3. Sections ---
    sections = [
        Section("5A", 5, 60),
        Section("5B", 5, 60),
        Section("3A", 3, 65),
    ]

    # --- 4. Rooms ---
    rooms = [
        # Classrooms
        Room("R101", 70, is_lab=False, building="Main Block"),
        Room("R102", 70, is_lab=False, building="Main Block"),
        Room("R103", 70, is_lab=False, building="Main Block"),
        # Labs
        Room("LAB1", 30, is_lab=True, building="Lab Block"), # Small lab
        Room("LAB2", 70, is_lab=True, building="Lab Block"), # Big lab
    ]

    # --- 5. Allocations (Who teaches what to whom) ---
    allocations = [
        # --- 5th Sem Section A ---
        Allocation("F01", "CS51", "5A"),
        Allocation("F02", "CS52", "5A"),
        Allocation("F03", "CS53", "5A"),
        Allocation("F04", "CS54", "5A"),
        # Elective: Group 1 (Split class)
        Allocation("F05", "CS55", "5A", elective_group_id="ELEC_5_GRP1"), 
        # Labs
        Allocation("F02", "CSL57", "5A"),
        Allocation("F03", "CSL58", "5A"),

        # --- 5th Sem Section B ---
        Allocation("F01", "CS51", "5B"),
        Allocation("F02", "CS52", "5B"),
        Allocation("F03", "CS53", "5B"),
        Allocation("F04", "CS54", "5B"),
        # Elective: Same Group ID to align slot (if cross-section) or different if purely parallel
        # Here we assume 5A and 5B might have electives at same time
        Allocation("F06", "CS56", "5B", elective_group_id="ELEC_5_GRP1"),
        # Labs
        Allocation("F02", "CSL57", "5B"),
        Allocation("F03", "CSL58", "5B"),

        # --- 3rd Sem Section A ---
        Allocation("F04", "CS31", "3A"),
        Allocation("F05", "CS32", "3A"),
        Allocation("F06", "CS33", "3A"),
        Allocation("F01", "CS34", "3A"),
        Allocation("F05", "CSL37", "3A"),
        Allocation("F06", "CSL38", "3A"),
    ]

    return faculties, subjects, sections, rooms, allocations


def print_timetable_grid(solution: Dict[str, Any], sections: List[Section]):
    """
    Prints the generated timetable with explicit Break and Lunch columns.
    """
    if not solution:
        print("No solution to display.")
        return

    # 1. Organize data into a nested dictionary
    # Structure: grid[section_id][day_index][period_index] = "Subject (Faculty)"
    grid = {sec.section_id: {d: {} for d in range(const.NUM_WORKING_DAYS)} for sec in sections}

    for task_id, info in solution.items():
        sec_id = info['section_id']
        day = info['day_index']
        start_period = info['period_index']
        duration = info['duration']
        
        # Format the label
        # e.g., "NLP (Anu) [R1]"
        label = f"{info['subject_code']} ({info['faculty_name']}) [{info['room_id']}]"
        
        for i in range(duration):
            current_period = start_period + i
            if current_period < const.NUM_TEACHING_SLOTS_PER_DAY:
                grid[sec_id][day][current_period] = label

    # 2. Print the Grid
    for sec in sections:
        print(f"\n{'='*100}")
        print(f"TIMETABLE FOR SECTION: {sec.section_id}")
        print(f"{'='*100}")

        # --- Build Header Row ---
        header = f"{'DAY':<10} |"
        separator = f"{'-'*10}-+"
        
        for i in range(const.NUM_TEACHING_SLOTS_PER_DAY):
            # Print Period Number
            header += f" P{i+1:<13} |"
            separator += f"{'-'*15}-+"
            
            # Inject Break Header
            if i == const.BREAK_AFTER_INDEX:
                header += " BREAK (15m) |"
                separator += f"{'-'*13}-+"
            # Inject Lunch Header
            elif i == const.LUNCH_AFTER_INDEX:
                header += " LUNCH (1h)  |"
                separator += f"{'-'*13}-+"
                
        print(header)
        print(separator)

        # --- Build Data Rows ---
        for d_idx, day_name in enumerate(const.DAYS):
            row = f"{day_name:<10} |"
            
            for p_idx in range(const.NUM_TEACHING_SLOTS_PER_DAY):
                # Get the class info, default to empty
                cell_data = grid[sec.section_id][d_idx].get(p_idx, "")
                
                # Truncate to fit column
                row += f" {cell_data[:13]:<13} |"
                
                # Inject Break Column
                if p_idx == const.BREAK_AFTER_INDEX:
                    row += f" {'***':<11} |"
                # Inject Lunch Column
                elif p_idx == const.LUNCH_AFTER_INDEX:
                    row += f" {'---':<11} |"
            
            print(row)
        print(separator)


def main():
    # 1. Load Data
    faculties, subjects, sections, rooms, allocations = create_sample_data()

    # 2. Prepare Tasks
    print(f"Generating tasks from {len(allocations)} allocations...")
    tasks = prepare_scheduling_tasks(allocations, faculties, subjects, sections)
    print(f"Total atomic tasks to schedule: {len(tasks)}")

    # 3. Initialize Solver
    solver = TimetableSolver(tasks, faculties, sections, rooms)

    # 4. Solve
    print("\nRunning Solver...")
    status, solution = solver.solve(
        time_limit_seconds=10,
        enable_soft_constraints=True,
        soft_constraint_weights={
            "subject_repetition": 10,
            "morning_core": 5,
            "late_heavy": 10,
            "faculty_gaps": 2,
            "campus_movement": 5,
            "no_first_hour_free": 20
        }
    )

    if status in ["OPTIMAL", "FEASIBLE"]:
        # 5. Display Results
        print_timetable_grid(solution, sections)
        
        # 6. Emergency Re-optimization Demo
        print("\n" + "!"*80)
        print("SIMULATING EMERGENCY: Faculty 'Prof. Bob' (F02) takes leave on Tuesday.")
        print("!"*80)
        
        reoptimizer = EmergencyReoptimizer(tasks, faculties, sections, rooms)
        
        # Tuesday is index 1
        reopt_status, new_solution = reoptimizer.reoptimize_for_faculty_leave(
            current_schedule=solution,
            faculty_id="F02",
            leave_day_index=1, 
            time_limit_seconds=10
        )
        
        if reopt_status in ["OPTIMAL", "FEASIBLE"]:
            print("\nRe-optimized Timetable (Changes minimized):")
            print_timetable_grid(new_solution, sections)
        else:
            print("Failed to re-optimize.")
            
    else:
        print(f"Solver failed to find a solution. Status: {status}")

if __name__ == "__main__":
    main()