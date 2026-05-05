# models.py

"""
This file defines all core data models for the VTU Automated Timetable Generator.

These models are solver-agnostic and serve as the standard data structures
used throughout the application, from data loading to constraint modeling.

No OR-Tools or other solver-specific imports are allowed in this file.
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import List, Optional, Set

# --- Enumerations ---

class SubjectType(Enum):
    """
    Enumeration for the type of a subject.
    This helps in applying specific constraints, like duration.
    """
    THEORY = auto()
    LAB = auto()
    SOFTSKILL = auto()
    FORUM = auto()

# --- Core Data Models ---

@dataclass(frozen=True)
class Faculty:
    """
    Represents a faculty member.
    'frozen=True' makes instances of this class immutable, which is a good
    practice for data models to prevent accidental modification.
    """
    id: str
    name: str
    designation: str
    max_hours_per_week: int
    # Availability is a set of compressed slot indices (0-39) where the faculty
    # IS available. If None, the faculty is assumed to be available always.
    availability_slots: Optional[Set[int]] = None

@dataclass(frozen=True)
class Subject:
    """
    Represents a subject or a course.
    """
    subject_code: str
    name: str
    credits: int  # 1 credit = 1 hour/week. Determines the number of classes.
    subject_type: SubjectType
    is_core: bool = True  # Flag for core subjects
    is_heavy: bool = False # Flag for computationally/conceptually heavy subjects

@dataclass(frozen=True)
class Section:
    """
    Represents a class section (e.g., '5th Sem A').
    """
    section_id: str
    semester: int
    student_strength: int

@dataclass(frozen=True)
class Room:
    """
    Represents a physical room, either a classroom or a lab.
    """
    room_id: str
    capacity: int
    is_lab: bool = False
    building: str = "Main" # Used for campus movement optimization

@dataclass(frozen=True)
class Task:
    """
    Represents an atomic, schedulable unit.
    This is the fundamental element the CP-SAT solver will schedule.
    It connects a faculty, a subject, and a section for a specific duration.
    """
    # A unique identifier for the task, e.g., f"{subject_code}-{section_id}-{instance_num}"
    task_id: str
    faculty: Faculty
    subject: Subject
    section: Section
    # Duration in terms of number of continuous teaching slots.
    # Labs, Soft Skills, and Forums are 2-hour blocks. Theory is 1 hour.
    duration: int
    # Optional ID to group tasks that must be scheduled at the same time.
    # e.g., All tasks for a specific elective across different sections.
    elective_group_id: Optional[str] = None

# --- Leave & Substitution Models ---

class LeaveStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class SubstitutionStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    TIMEOUT = "TIMEOUT"
    WITHDRAWN = "WITHDRAWN"

@dataclass
class AffectedSlot:
    subject_code: str
    section_id: str
    day: str
    period: int
    room_id: str

@dataclass
class LeaveRequest:
    leave_id: str
    faculty_id: str
    days: List[str]  # e.g. ["Monday", "Tuesday"]
    reason: str
    status: LeaveStatus

@dataclass
class ProposedSwap:
    subject_code: str
    day: str
    original_period: int
    new_period: int

@dataclass
class SubstitutionRequest:
    request_id: str
    leave_id: str
    affected_slot: AffectedSlot
    original_faculty_id: str
    candidate_faculty_id: str
    priority_level: int
    status: SubstitutionStatus
    sent_at: str  # ISO format datetime
    expires_at: str  # ISO format datetime
    proposed_swap: Optional[ProposedSwap] = None
    responded_at: Optional[str] = None
