# data_loader.py

"""
This module is responsible for converting raw input data into a list of
atomic 'Task' objects that the solver can schedule.

Responsibilities:
- Ingest lists of faculties, subjects, sections, and their allocations.
- Convert subject credits into the correct number of weekly Task instances.
- Ensure THEORY subjects create 1-hour tasks per credit.
- Ensure LAB, SOFTSKILL, and FORUM subjects create a single 2-hour task.
- Assign a unique ID to each task.
- Populate each task with its corresponding faculty, subject, and section.
- Correctly handle elective groups for multi-hour subjects.

This module performs NO scheduling logic, constraint creation, or optimization.
It is purely a data transformation and preparation layer.
"""

from dataclasses import dataclass
from typing import List, Optional

# Import the core data models
from models import Faculty, Subject, Section, Task, SubjectType
from constants import TOTAL_TEACHING_SLOTS_PER_WEEK

@dataclass(frozen=True)
class Allocation:
    """
    A simple dataclass to represent the raw input mapping of who teaches what
    to whom. This is a cleaner alternative to using tuples or dicts.
    """
    faculty_id: str
    subject_code: str
    section_id: str
    elective_group_id: Optional[str] = None


def prepare_scheduling_tasks(
    allocations: List[Allocation],
    faculties: List[Faculty],
    subjects: List[Subject],
    sections: List[Section]
) -> List[Task]:
    """
    Processes raw allocation data and generates a flat list of atomic Task
    objects ready for the solver.

    Args:
        allocations: A list of Allocation objects defining the teaching load.
        faculties: A list of all available Faculty objects.
        subjects: A list of all available Subject objects.
        sections: A list of all available Section objects.

    Returns:
        A list of Task objects, where each task is an atomic unit to be scheduled.
    """
    # Create lookup dictionaries for efficient access
    faculties_by_id = {f.id: f for f in faculties}
    subjects_by_code = {s.subject_code: s for s in subjects}
    sections_by_id = {s.section_id: s for s in sections}

    all_tasks: List[Task] = []
    section_duration_sums = {s.section_id: 0 for s in sections}

    # Group allocations for co-teaching support
    from collections import defaultdict
    grouped_allocs = defaultdict(list)
    for alloc in allocations:
        key = (alloc.subject_code, alloc.section_id, alloc.elective_group_id)
        grouped_allocs[key].append(alloc)

    for key, alloc_group in grouped_allocs.items():
        subject_code, section_id, alloc_elective_group_id = key
        
        try:
            subject = subjects_by_code[subject_code]
            section = sections_by_id[section_id]
            facs = [faculties_by_id[a.faculty_id] for a in alloc_group]
        except KeyError as e:
            print(f"Error: Invalid ID in allocation group {key}. Missing key: {e}")
            continue
            
        if len(facs) == 1:
            faculty = facs[0]
        else:
            # Create composite faculty to avoid generating duplicate tasks
            comp_id = "_".join(f.id for f in facs)
            comp_name = " / ".join(f.name.replace("Prof. ", "").replace("Dr. ", "").replace("Mr. ", "").replace("Ms. ", "").strip() for f in facs)
            faculty = Faculty(id=comp_id, name=comp_name, designation="Co-Teaching", max_hours_per_week=99)

        # --- Task Generation Logic ---

        if subject.subject_type == SubjectType.THEORY:
            # For a theory subject, create one 1-hour task for each credit.
            for i in range(subject.credits):
                # *** CRITICAL FIX FOR ELECTIVES ***
                # For a 3-credit elective, we need groups like 'group_0', 'group_1', 'group_2'
                # to pair the correct hours across different sections.
                
                group_id = None
                if alloc_elective_group_id:
                    group_id = f"{alloc_elective_group_id}_{i}"
                elif subject.is_core:
                    # Treat Core Theory as a "Joint Class" for all batches in the section (e.g. 6a-E1 + 6a-E2)
                    # We generate a synthetic group ID: CORE_CS101_6A_0
                    parent_sec = section.section_id.split('-')[0]
                    group_id = f"CORE_{subject.subject_code}_{parent_sec}_{i}"

                task = Task(
                    task_id=f"{subject.subject_code}-{section.section_id}-{i}",
                    faculty=faculty,
                    subject=subject,
                    section=section,
                    duration=1,
                    elective_group_id=group_id
                )
                all_tasks.append(task)
                section_duration_sums[section.section_id] += task.duration
        
        elif subject.subject_type in [SubjectType.LAB, SubjectType.SOFTSKILL, SubjectType.FORUM]:
            # For labs and other block sessions, create exactly ONE 2-hour task.
            # The elective group applies to the entire 2-hour block as a single unit.
            task = Task(
                task_id=f"{subject.subject_code}-{section.section_id}-BLOCK",
                faculty=faculty,
                subject=subject,
                section=section,
                duration=2,
                elective_group_id=alloc_elective_group_id
            )
            all_tasks.append(task)
            section_duration_sums[section.section_id] += task.duration
    # --- Gap Filler Logic ---
    try:
        if "DUMMY_STAFF" in faculties_by_id and "LIB_HR" in subjects_by_code:
            dummy_fac = faculties_by_id["DUMMY_STAFF"]
            dummy_subjects_pool = [
                subjects_by_code["LIB_HR"],
                subjects_by_code["STU_HR"],
                subjects_by_code["FAC_HR"],
                subjects_by_code["STDY_HR"]
            ]
            
            for section in sections:
                if '-' in section.section_id or section.section_id == 'OE_AI':
                    continue
                batch_durations = [
                    section_duration_sums.get(b.section_id, 0)
                    for b in sections if b.section_id.startswith(f"{section.section_id}-")
                ]
                max_batch_duration = max(batch_durations) if batch_durations else 0
                current_duration = section_duration_sums.get(section.section_id, 0) + max_batch_duration
                
                # Dynamically adjust filler buffer based on problem size (massive math = lower fillers)
                num_allocations = len(allocations)
                if num_allocations > 100:
                    buffer = 8  # Massive math: keep 8 hours free to reduce dummy tasks
                elif num_allocations > 50:
                    buffer = 4  # Moderate math: keep 4 hours free
                else:
                    buffer = 2  # Normal math: keep 2 hours free
                    
                gaps = max(0, TOTAL_TEACHING_SLOTS_PER_WEEK - current_duration - buffer)
                
                if gaps > 0:
                    for i in range(gaps):
                        subj = dummy_subjects_pool[i % len(dummy_subjects_pool)]
                        task = Task(
                            task_id=f"FILLER-{subj.subject_code}-{section.section_id}-{i}",
                            faculty=dummy_fac,
                            subject=subj,
                            section=section,
                            duration=1,
                            elective_group_id=None
                        )
                        all_tasks.append(task)
                        # No need to update duration_sums since we are done
    except KeyError as e:
        print(f"Skipping gap filling, missing dummy setup: {e}")

    return all_tasks


# --- Example Usage ---
if __name__ == '__main__':
    # This block demonstrates how to use the prepare_scheduling_tasks function.
    # It will only run when this file is executed directly.

    # 1. Define sample data using the core models
    faculty1 = Faculty(id="F001", name="Dr. Smith", designation="Professor", max_hours_per_week=10)
    faculty2 = Faculty(id="F002", name="Dr. Jones", designation="Asst. Professor", max_hours_per_week=12)

    subject_theory = Subject(subject_code="CS101", name="Intro to CS", credits=4, subject_type=SubjectType.THEORY)
    subject_lab = Subject(subject_code="CS101L", name="CS Lab", credits=1, subject_type=SubjectType.LAB)
    subject_elective = Subject(subject_code="CS555", name="Advanced AI", credits=3, subject_type=SubjectType.THEORY)


    section_a = Section(section_id="5A", semester=5, student_strength=60)
    section_b = Section(section_id="5B", semester=5, student_strength=62)

    # 2. Define the teaching allocations
    sample_allocations = [
        Allocation(faculty_id="F001", subject_code="CS101", section_id="5A"),
        Allocation(faculty_id="F002", subject_code="CS101L", section_id="5A"),
        # Elective subject taught by the same faculty to both sections
        Allocation(faculty_id="F001", subject_code="CS555", section_id="5A", elective_group_id="ELEC01"),
        Allocation(faculty_id="F001", subject_code="CS555", section_id="5B", elective_group_id="ELEC01"),
    ]

    # 3. Call the data loader function
    generated_tasks = prepare_scheduling_tasks(
        allocations=sample_allocations,
        faculties=[faculty1, faculty2],
        subjects=[subject_theory, subject_lab, subject_elective],
        sections=[section_a, section_b]
    )

    # 4. Print the results to verify
    print(f"--- Generated {len(generated_tasks)} Tasks ---\n")
    for task in generated_tasks:
        print(f"Task ID: {task.task_id}")
        print(f"  Subject: {task.subject.name} ({task.subject.subject_type.name})")
        print(f"  Faculty: {task.faculty.name}")
        print(f"  Section: {task.section.section_id}")
        print(f"  Duration: {task.duration} hour(s)")
        if task.elective_group_id:
            print(f"  Elective Group: {task.elective_group_id}")
        print("-" * 20)

    # Expected Output:
    # Elective tasks for CS555 will now have group IDs like "ELEC01_0", "ELEC01_1", "ELEC01_2"