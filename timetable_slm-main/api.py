from fastapi import FastAPI, HTTPException, File, UploadFile, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from collections import defaultdict
import traceback
from datetime import datetime

from storage import (
    load_data, save_data,
    save_schedule, save_original_schedule,
    schedule_exists, load_schedule,
    original_schedule_exists, load_original_schedule,
    load_history, add_history_entry, save_history,
    clear_schedule, clear_history, clear_original_schedule,
    save_version, load_versions, restore_version,
)
from models import Faculty, Subject, Section, Room, SubjectType
from data_loader import Allocation, prepare_scheduling_tasks
from solver import TimetableSolver
from partial_optimizer import PartialOptimizer
from slm_inference import get_constraints_batch, smart_parse, get_constraint, check_api_health
from substitution_engine import (
    process_leave_approval, handle_acceptance, handle_decline, check_timeouts
)
from storage import (
    load_leave_requests, save_leave_requests, load_substitution_requests,
    save_substitution_requests, load_cancellations, save_cancellations
)
from models import LeaveRequest, LeaveStatus
import uuid
import constants as const

app = FastAPI(title="VTU Timetable Generator API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _subject_type(type_str: str) -> SubjectType:
    return {
        "THEORY": SubjectType.THEORY,
        "LAB": SubjectType.LAB,
        "SOFTSKILL": SubjectType.SOFTSKILL,
        "FORUM": SubjectType.FORUM,
    }.get(type_str.upper(), SubjectType.THEORY)


def _build_objects(data: dict):
    """Convert raw JSON data dicts into domain model objects."""
    facs = [Faculty(f["id"], f["name"], f["designation"], f["max_hours"])
            for f in data["faculties"]]
    subs = [Subject(s["code"], s["name"], s["credits"],
                    _subject_type(s["type"]),
                    s.get("is_core", True), s.get("is_heavy", False))
            for s in data["subjects"]]
    secs = [Section(s["id"], s["semester"], s["strength"])
            for s in data["sections"]]
    rooms = [Room(r["id"], r["capacity"], r["is_lab"], r["building"])
             for r in data["rooms"]]
    allocs = [Allocation(a["faculty_id"], a["subject_code"],
                         a["section_id"], a.get("elective_group"))
              for a in data["allocations"]]
    return facs, subs, secs, rooms, allocs


def _clean(solution: dict) -> dict:
    """Remove non-serialisable task_obj from solution."""
    return {k: {kk: vv for kk, vv in v.items() if kk != "task_obj"}
            for k, v in solution.items()}

def diff_schedules(old_sched: dict, new_sched: dict):
    changes = []
    affected_sections = set()
    all_keys = set(old_sched.keys()) | set(new_sched.keys())
    for k in all_keys:
        old_val = old_sched.get(k)
        new_val = new_sched.get(k)
        if old_val != new_val:
            changes.append({
                "task_id": k,
                "before": old_val,
                "after": new_val
            })
            if old_val: affected_sections.add(old_val.get("section_id", "").split("-")[0].upper())
            if new_val: affected_sections.add(new_val.get("section_id", "").split("-")[0].upper())
    return changes, list(affected_sections)


def _build_grid(solution: dict, allocations: list = None) -> dict:
    """
    Merge sub-sections (6a-E1, 6a-E2) into their parent (6A) —
    exactly what render_timetable_html does in app.py.
    
    Now also enriches grid entries with:
      - duration: from the schedule entry
      - elective_group: from allocations data
      - is_open_elective: true if elective_group contains 'oe'
    """
    if allocations is None:
        allocations = load_data().get("allocations", [])

    # Build allocation lookup: (section_id, subject_code, faculty_id) -> elective_group
    alloc_lookup = {}
    if allocations:
        for a in allocations:
            key = (
                a.get("section_id", "").lower(),
                a.get("subject_code", "").lower(),
                a.get("faculty_id", "").lower(),
            )
            alloc_lookup[key] = a.get("elective_group")

    # Build faculty_id reverse lookup from data
    # The schedule stores faculty_name (e.g. "Prof. Anu") but allocations use faculty_id (e.g. "anu")
    # We'll also try matching by section_id + subject_code only as fallback
    alloc_by_sec_sub = {}
    if allocations:
        for a in allocations:
            key2 = (a.get("section_id", "").lower(), a.get("subject_code", "").lower())
            alloc_by_sec_sub[key2] = a.get("elective_group")

    parent_sections = sorted(set(
        info.get("section_id", "").split("-")[0].upper()
        for info in solution.values()
    ))

    merged = {ps: defaultdict(lambda: defaultdict(list)) for ps in parent_sections}
    days_seen = {ps: set() for ps in parent_sections}

    for task_id, info in solution.items():
        sec_id = info.get("section_id", "")
        ps = sec_id.split("-")[0].upper()
        day = info.get("day_index", 0)
        period = info.get("period_index", 0)
        dur = info.get("duration", 1)
        subject = info.get("subject_code", "?").upper()
        faculty = info.get("faculty_name", "")
        short_fac = (faculty.replace("Prof. ", "").replace("Dr. ", "")
                            .replace("Mr. ", "").replace("Ms. ", ""))

        # Look up elective_group from allocations
        eg = alloc_by_sec_sub.get((sec_id.lower(), info.get("subject_code", "").lower()))
        is_oe = bool(eg and "oe" in eg.lower())

        days_seen[ps].add(day)

        for i in range(dur):
            entry = {
                "task_id": task_id,
                "subject": subject,
                "faculty": short_fac,
                "duration": dur,
                "elective_group": eg,
                "is_open_elective": is_oe,
            }
            # Propagate substitution metadata so frontend can highlight
            if info.get("is_substituted"):
                entry["is_substituted"] = True
                orig = info.get("original_faculty_name", "")
                entry["original_faculty"] = (orig.replace("Prof. ", "").replace("Dr. ", "")
                                              .replace("Mr. ", "").replace("Ms. ", ""))
            slot = merged[ps][day][period + i]
            if not any(e["subject"] == entry["subject"] and e["faculty"] == entry["faculty"] for e in slot):
                slot.append(entry)

    grid = {}
    for ps in parent_sections:
        day_indices = list(range(len(const.DAYS)))   # always Mon–Fri
        if 5 in days_seen[ps]:                       # Saturday only if needed
            day_indices.append(5)

        slots = {}
        for day in day_indices:
            slots[str(day)] = {
                str(p): merged[ps][day].get(p, [])
                for p in range(const.NUM_TEACHING_SLOTS_PER_DAY)
            }

        grid[ps] = {"days": day_indices, "slots": slots}

    return grid


def _timetable_constants() -> dict:
    return {
        "days": const.DAYS,
        "headers": const.TIMETABLE_HEADERS,
        "num_periods": const.NUM_TEACHING_SLOTS_PER_DAY,
        "break_after_index": const.BREAK_AFTER_INDEX,
        "lunch_after_index": const.LUNCH_AFTER_INDEX,
    }


# ═════════════════════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS
# ═════════════════════════════════════════════════════════════════════════════

class FacultyIn(BaseModel):
    id: str
    name: str
    designation: str
    max_hours: int = 18

class SubjectIn(BaseModel):
    code: str
    name: str
    credits: int
    type: str = "THEORY"   # THEORY | LAB | SOFTSKILL | FORUM
    is_core: bool = True
    is_heavy: bool = False

class SectionIn(BaseModel):
    id: str
    semester: int
    strength: int

class RoomIn(BaseModel):
    id: str
    capacity: int
    is_lab: bool = False
    building: str = "Main"

class AllocationIn(BaseModel):
    faculty_id: str
    subject_code: str
    section_id: str
    elective_group: Optional[str] = None

class GenerateRequest(BaseModel):
    time_limit_seconds: int = 30
    version_label: Optional[str] = None
    semesters: Optional[List[int]] = None  # e.g. [5, 7] for odd sems only

class UpdateRequest(BaseModel):
    prompt: str
    preview_only: bool = False
    propose_only: bool = False

class OverwriteRequest(BaseModel):
    schedule: dict

class ProposeRequest(BaseModel):
    schedule: dict
    proposer: str
    proposer_name: str
    description: str = "Proposed timetable change"

class InjectEntry(BaseModel):
    section_id: str          # e.g. "6A" (parent section)
    day_index: int           # 0-4 (Mon-Fri)
    period_index: int        # 0-7 teaching period
    subject_code: str        # e.g. "ml"
    faculty_name: str        # e.g. "Dr. Kavitha"
    duration: int = 1        # 1 for theory, 2 for lab
    room_id: Optional[str] = None

class InjectRequest(BaseModel):
    entries: list[InjectEntry]

class RemoveRequest(BaseModel):
    task_id: str


# ═════════════════════════════════════════════════════════════════════════════
# HEALTH & CONSTANTS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    """API liveness check — also returns timetable constants for convenience."""
    return {
        "status": "ok",
        "schedule_exists": schedule_exists(),
        **_timetable_constants(),
    }

@app.get("/slm/health")
def slm_health():
    """Check whether the external flan-t5 SLM API is reachable."""
    ok = check_api_health()
    return {"slm_online": ok, "message": "SLM API is online" if ok else "SLM API is offline"}

@app.get("/constants")
def get_constants():
    """Timetable rendering constants (days, time headers, period indices)."""
    return _timetable_constants()


# ═════════════════════════════════════════════════════════════════════════════
# ALL DATA
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data")
def get_all_data():
    """Return all stored academic data in one call."""
    return load_data()



import pandas as pd
import io

@app.get("/data/template/excel")
def get_excel_template():
    df_faculties = pd.DataFrame(columns=["id", "name", "designation", "max_hours"])
    df_subjects = pd.DataFrame(columns=["code", "name", "type", "credits", "is_core", "is_heavy"])
    df_sections = pd.DataFrame(columns=["id", "semester", "strength"])
    df_rooms = pd.DataFrame(columns=["id", "capacity", "is_lab", "building"])
    df_allocations = pd.DataFrame(columns=["faculty_id", "subject_code", "section_id", "elective_group"])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_faculties.to_excel(writer, sheet_name='Faculties', index=False)
        df_subjects.to_excel(writer, sheet_name='Subjects', index=False)
        df_sections.to_excel(writer, sheet_name='Sections', index=False)
        df_rooms.to_excel(writer, sheet_name='Rooms', index=False)
        df_allocations.to_excel(writer, sheet_name='Allocations', index=False)
    
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=timetable_template.xlsx"}
    )

@app.post("/data/import/excel")
async def import_excel(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        xls = pd.ExcelFile(io.BytesIO(contents))
        data = {
            "faculties": [],
            "subjects": [],
            "sections": [],
            "rooms": [],
            "allocations": [],
            "scheduling_rules": []
        }
        
        if 'Faculties' in xls.sheet_names:
            df = pd.read_excel(xls, 'Faculties').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["faculties"].append({
                        "id": str(row.get('id')),
                        "name": str(row.get('name', '')),
                        "designation": str(row.get('designation', 'Asst. Prof')),
                        "max_hours": int(row.get('max_hours', 18) or 18)
                    })
                    
        if 'Subjects' in xls.sheet_names:
            df = pd.read_excel(xls, 'Subjects').fillna('')
            for _, row in df.iterrows():
                if row.get('code'):
                    data["subjects"].append({
                        "code": str(row.get('code')),
                        "name": str(row.get('name', '')),
                        "type": str(row.get('type', 'THEORY')),
                        "credits": int(row.get('credits', 3) or 3),
                        "is_core": bool(row.get('is_core', True)),
                        "is_heavy": bool(row.get('is_heavy', False))
                    })
                    
        if 'Sections' in xls.sheet_names:
            df = pd.read_excel(xls, 'Sections').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["sections"].append({
                        "id": str(row.get('id')),
                        "semester": int(row.get('semester', 1) or 1),
                        "strength": int(row.get('strength', 60) or 60)
                    })
                    
        if 'Rooms' in xls.sheet_names:
            df = pd.read_excel(xls, 'Rooms').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["rooms"].append({
                        "id": str(row.get('id')),
                        "capacity": int(row.get('capacity', 60) or 60),
                        "is_lab": bool(row.get('is_lab', False)),
                        "building": str(row.get('building', 'Main'))
                    })
                    
        if 'Allocations' in xls.sheet_names:
            df = pd.read_excel(xls, 'Allocations').fillna('')
            for _, row in df.iterrows():
                if row.get('faculty_id') and row.get('subject_code') and row.get('section_id'):
                    eg = row.get('elective_group')
                    data["allocations"].append({
                        "faculty_id": str(row.get('faculty_id')),
                        "subject_code": str(row.get('subject_code')),
                        "section_id": str(row.get('section_id')),
                        "elective_group": str(eg) if eg else None
                    })
        
        # Merge with existing scheduling_rules to preserve them
        existing_data = load_data()
        data["scheduling_rules"] = existing_data.get("scheduling_rules", [])
        
        save_data(data)
        return {"message": "Data imported successfully", "imported": {k: len(v) for k, v in data.items()}}
        
    except Exception as e:
        raise HTTPException(400, f"Failed to parse Excel file: {str(e)}")

# ═════════════════════════════════════════════════════════════════════════════
# MANAGE FACULTIES
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data/faculties")
def list_faculties():
    return {"faculties": load_data()["faculties"]}

@app.post("/data/faculties", status_code=201)
def add_faculty(faculty: FacultyIn):
    data = load_data()
    if any(f["id"] == faculty.id for f in data["faculties"]):
        raise HTTPException(400, f"Faculty ID '{faculty.id}' already exists.")
    data["faculties"].append(faculty.model_dump())
    save_data(data)
    return {"message": "Faculty added.", "faculty": faculty.model_dump()}


@app.put("/data/faculties/{faculty_id}")
def update_faculty(faculty_id: str, faculty: FacultyIn):
    data = load_data()
    for i, f in enumerate(data["faculties"]):
        if f["id"] == faculty_id:
            updated = faculty.model_dump()
            updated["id"] = faculty_id
            data["faculties"][i] = updated
            save_data(data)
            return {"message": "Faculty updated.", "faculty": updated}
    raise HTTPException(404, f"Faculty '{faculty_id}' not found.")

@app.delete("/data/faculties")
def clear_faculties():
    data = load_data()
    data["faculties"] = []
    save_data(data)
    return {"message": "All faculties cleared."}

@app.delete("/data/faculties/{faculty_id}")
def delete_faculty(faculty_id: str):
    data = load_data()
    before = len(data["faculties"])
    data["faculties"] = [f for f in data["faculties"] if f["id"] != faculty_id]
    if len(data["faculties"]) == before:
        raise HTTPException(404, f"Faculty '{faculty_id}' not found.")
    save_data(data)
    return {"message": f"Faculty '{faculty_id}' deleted."}


# ═════════════════════════════════════════════════════════════════════════════
# MANAGE SUBJECTS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data/subjects")
def list_subjects():
    return {"subjects": load_data()["subjects"]}

@app.post("/data/subjects", status_code=201)
def add_subject(subject: SubjectIn):
    data = load_data()
    if any(s["code"] == subject.code for s in data["subjects"]):
        raise HTTPException(400, f"Subject code '{subject.code}' already exists.")
    data["subjects"].append(subject.model_dump())
    save_data(data)
    return {"message": "Subject added.", "subject": subject.model_dump()}


@app.put("/data/subjects/{subject_code}")
def update_subject(subject_code: str, subject: SubjectIn):
    data = load_data()
    for i, s in enumerate(data["subjects"]):
        if s["code"] == subject_code:
            updated = subject.model_dump()
            updated["code"] = subject_code
            data["subjects"][i] = updated
            save_data(data)
            return {"message": "Subject updated.", "subject": updated}
    raise HTTPException(404, f"Subject '{subject_code}' not found.")

@app.delete("/data/subjects")
def clear_subjects():
    data = load_data()
    data["subjects"] = []
    save_data(data)
    return {"message": "All subjects cleared."}

@app.delete("/data/subjects/{subject_code}")
def delete_subject(subject_code: str):
    data = load_data()
    before = len(data["subjects"])
    data["subjects"] = [s for s in data["subjects"] if s["code"] != subject_code]
    if len(data["subjects"]) == before:
        raise HTTPException(404, f"Subject '{subject_code}' not found.")
    save_data(data)
    return {"message": f"Subject '{subject_code}' deleted."}


# ═════════════════════════════════════════════════════════════════════════════
# MANAGE SECTIONS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data/sections")
def list_sections():
    return {"sections": load_data()["sections"]}

@app.post("/data/sections", status_code=201)
def add_section(section: SectionIn):
    data = load_data()
    if any(s["id"] == section.id for s in data["sections"]):
        raise HTTPException(400, f"Section ID '{section.id}' already exists.")
    data["sections"].append(section.model_dump())
    save_data(data)
    return {"message": "Section added.", "section": section.model_dump()}


@app.put("/data/sections/{section_id}")
def update_section(section_id: str, section: SectionIn):
    data = load_data()
    for i, s in enumerate(data["sections"]):
        if s["id"] == section_id:
            updated = section.model_dump()
            updated["id"] = section_id
            data["sections"][i] = updated
            save_data(data)
            return {"message": "Section updated.", "section": updated}
    raise HTTPException(404, f"Section '{section_id}' not found.")

@app.delete("/data/sections")
def clear_sections():
    data = load_data()
    data["sections"] = []
    save_data(data)
    return {"message": "All sections cleared."}

@app.get("/data/semesters")
def list_semesters():
    """Return all unique semester numbers from sections data."""
    data = load_data()
    semesters = sorted(set(s["semester"] for s in data.get("sections", [])))
    return {"semesters": semesters}


@app.delete("/data/sections/{section_id}")
def delete_section(section_id: str):
    data = load_data()
    before = len(data["sections"])
    data["sections"] = [s for s in data["sections"] if s["id"] != section_id]
    if len(data["sections"]) == before:
        raise HTTPException(404, f"Section '{section_id}' not found.")
    save_data(data)
    return {"message": f"Section '{section_id}' deleted."}


# ═════════════════════════════════════════════════════════════════════════════
# MANAGE ROOMS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data/rooms")
def list_rooms():
    return {"rooms": load_data()["rooms"]}

@app.post("/data/rooms", status_code=201)
def add_room(room: RoomIn):
    data = load_data()
    if any(r["id"] == room.id for r in data["rooms"]):
        raise HTTPException(400, f"Room ID '{room.id}' already exists.")
    data["rooms"].append(room.model_dump())
    save_data(data)
    return {"message": "Room added.", "room": room.model_dump()}


@app.put("/data/rooms/{room_id}")
def update_room(room_id: str, room: RoomIn):
    data = load_data()
    for i, r in enumerate(data["rooms"]):
        if r["id"] == room_id:
            updated = room.model_dump()
            updated["id"] = room_id
            data["rooms"][i] = updated
            save_data(data)
            return {"message": "Room updated.", "room": updated}
    raise HTTPException(404, f"Room '{room_id}' not found.")

@app.delete("/data/rooms")
def clear_rooms():
    data = load_data()
    data["rooms"] = []
    save_data(data)
    return {"message": "All rooms cleared."}

@app.delete("/data/rooms/{room_id}")
def delete_room(room_id: str):
    data = load_data()
    before = len(data["rooms"])
    data["rooms"] = [r for r in data["rooms"] if r["id"] != room_id]
    if len(data["rooms"]) == before:
        raise HTTPException(404, f"Room '{room_id}' not found.")
    save_data(data)
    return {"message": f"Room '{room_id}' deleted."}


# ═════════════════════════════════════════════════════════════════════════════
# MANAGE ALLOCATIONS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/data/allocations")
def list_allocations():
    return {"allocations": load_data()["allocations"]}

@app.post("/data/allocations", status_code=201)
def add_allocation(alloc: AllocationIn):
    data = load_data()
    data["allocations"].append(alloc.model_dump())
    save_data(data)
    return {"message": "Allocation added.", "allocation": alloc.model_dump()}


@app.put("/data/allocations/{idx}")
def update_allocation(idx: int, alloc: AllocationIn):
    data = load_data()
    if idx < 0 or idx >= len(data["allocations"]):
        raise HTTPException(404, f"Allocation index {idx} out of range.")
    data["allocations"][idx] = alloc.model_dump()
    save_data(data)
    return {"message": "Allocation updated.", "allocation": alloc.model_dump()}

@app.delete("/data/allocations")
def clear_allocations():
    data = load_data()
    data["allocations"] = []
    save_data(data)
    return {"message": "All allocations cleared."}

@app.delete("/data/allocations/{idx}")
def delete_allocation(idx: int):
    """Delete allocation by its 0-based index in the list."""
    data = load_data()
    if idx < 0 or idx >= len(data["allocations"]):
        raise HTTPException(404, f"Allocation index {idx} out of range.")
    removed = data["allocations"].pop(idx)
    save_data(data)
    return {"message": "Allocation deleted.", "removed": removed}


# ═════════════════════════════════════════════════════════════════════════════
# SCHEDULING RULES
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/scheduling-rules")
def get_scheduling_rules():
    data = load_data()
    return {"rules": data.get("scheduling_rules", [])}

@app.post("/scheduling-rules")
def add_scheduling_rule(rule: dict):
    import uuid as _uuid
    data = load_data()
    rules = data.get("scheduling_rules", [])
    rule["id"] = str(_uuid.uuid4())
    rules.append(rule)
    data["scheduling_rules"] = rules
    save_data(data)
    return {"message": "Rule added.", "rule": rule}


@app.put("/scheduling-rules/{rule_id}")
def update_scheduling_rule(rule_id: str, rule: dict):
    data = load_data()
    rules = data.get("scheduling_rules", [])
    for i, r in enumerate(rules):
        if r.get("id") == rule_id:
            rule["id"] = rule_id
            rules[i] = rule
            data["scheduling_rules"] = rules
            save_data(data)
            return {"message": "Rule updated.", "rule": rule}
    raise HTTPException(404, "Rule not found.")

@app.delete("/scheduling-rules/{rule_id}")
def delete_scheduling_rule(rule_id: str):
    data = load_data()
    rules = data.get("scheduling_rules", [])
    data["scheduling_rules"] = [r for r in rules if r.get("id") != rule_id]
    save_data(data)
    return {"message": "Rule deleted."}


# ═════════════════════════════════════════════════════════════════════════════
# GENERATE TIMETABLE
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/generate")
def generate(req: GenerateRequest):
    try:
        data = load_data()

        missing = [k for k in ("faculties", "subjects", "sections", "rooms", "allocations")
                   if not data.get(k)]
        if missing:
            raise HTTPException(400, f"Missing data for: {', '.join(missing)}.")

        # ── Semester filtering ────────────────────────────────────────────
        if req.semesters:
            selected_sems = set(req.semesters)
            # 1. Filter sections to only selected semesters
            data["sections"] = [
                s for s in data["sections"] if s["semester"] in selected_sems
            ]
            if not data["sections"]:
                raise HTTPException(400, f"No sections found for semesters: {req.semesters}")

            # 2. Filter allocations to only reference surviving sections
            valid_section_ids = {s["id"] for s in data["sections"]}
            data["allocations"] = [
                a for a in data["allocations"]
                if a["section_id"] in valid_section_ids
            ]

            # 3. Filter subjects to only those referenced by surviving allocations
            used_subject_codes = {a["subject_code"] for a in data["allocations"]}
            data["subjects"] = [
                s for s in data["subjects"] if s["code"] in used_subject_codes
            ]

            # 4. Filter faculties to only those referenced by surviving allocations
            used_faculty_ids = {a["faculty_id"] for a in data["allocations"]}
            data["faculties"] = [
                f for f in data["faculties"] if f["id"] in used_faculty_ids
            ]

            print(f"[generate] Filtered to semesters {req.semesters}: "
                  f"{len(data['sections'])} sections, {len(data['allocations'])} allocations, "
                  f"{len(data['subjects'])} subjects, {len(data['faculties'])} faculties")

        facs, subs, secs, rooms, allocs = _build_objects(data)
        tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)

        if not tasks:
            raise HTTPException(400, "No schedulable tasks found. Check your allocations.")

        solver = TimetableSolver(tasks, facs, secs, rooms)
        status, solution = solver.solve(
            time_limit_seconds=req.time_limit_seconds,
            enable_soft_constraints=True,
            scheduling_rules=data.get("scheduling_rules", []),
        )

        if status not in ("OPTIMAL", "FEASIBLE"):
            raise HTTPException(400, f"Solver returned: {status}.")

        # Auto-save current schedule as a version before overwriting
        if schedule_exists():
            save_version(label=req.version_label)

        save_schedule(solution)
        save_original_schedule(solution)
        clean = _clean(solution)

        return {
            "status": status,
            "task_count": len(tasks),
            "semesters_generated": req.semesters or "all",
            "schedule": clean,
            "grid": _build_grid(clean),
            **_timetable_constants(),
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, traceback.format_exc())


# ═════════════════════════════════════════════════════════════════════════════
# GET / DELETE TIMETABLE
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/schedule")
def get_schedule():
    if not schedule_exists():
        return {"exists": False, "schedule": None, "grid": None}
    data = load_schedule()
    clean = _clean(data["schedule"])
    return {
        "exists": True,
        "generated_at": data.get("generated_at"),
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

@app.get("/schedule/original")
def get_original_schedule():
    if not original_schedule_exists():
        return {"exists": False, "grid": None}
    data = load_original_schedule()
    clean = _clean(data["schedule"])
    return {
        "exists": True,
        "generated_at": data.get("generated_at"),
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

@app.delete("/schedule")
def delete_schedule(version_label: Optional[str] = None):
    # Auto-save as version before clearing
    if schedule_exists():
        save_version(label=version_label)
    clear_schedule()
    clear_original_schedule()
    clear_history()
    return {"message": "Schedule saved as version and cleared."}

@app.post("/schedule/revert")
def revert_schedule():
    if not original_schedule_exists():
        raise HTTPException(400, "No original schedule found to revert to.")
    data = load_original_schedule()
    save_schedule(data["schedule"])
    clear_history()
    clean = _clean(data["schedule"])
    return {
        "status": "SUCCESS",
        "message": "Reverted to original schedule and cleared history.",
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

# ═════════════════════════════════════════════════════════════════════════════
# SCHEDULE VERSIONS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/schedule/versions")
def get_versions():
    versions = load_versions()
    # Return summary only (not full schedule data) for the list view
    return {
        "versions": [
            {
                "id": v["id"],
                "label": v.get("label", f"Version {i+1}"),
                "timestamp": v.get("timestamp", ""),
                "generated_at": v.get("generated_at", ""),
                "history_count": len(v.get("history", [])),
            }
            for i, v in enumerate(versions)
        ]
    }

@app.get("/schedule/versions/{version_id}")
def get_version_details(version_id: str):
    versions = load_versions()
    target = next((v for v in versions if v["id"] == version_id), None)
    if not target:
        raise HTTPException(404, "Version not found.")
    clean = _clean(target.get("schedule", {}))
    return {
        "status": "SUCCESS",
        "version_id": version_id,
        "label": target.get("label"),
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

@app.post("/schedule/versions/restore/{version_id}")
def restore_version_endpoint(version_id: str):
    # Auto-save current as a version before restoring
    if schedule_exists():
        save_version()
    result = restore_version(version_id)
    if not result:
        raise HTTPException(404, "Version not found.")
    clean = _clean(result["schedule"])
    return {
        "status": "SUCCESS",
        "message": f"Restored version: {result.get('label', version_id)}",
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

@app.post("/schedule/overwrite")
def overwrite_schedule(req: OverwriteRequest):
    if not req.schedule:
        raise HTTPException(400, "Schedule payload cannot be empty.")
    
    old_raw = load_schedule()
    old_schedule = _clean(old_raw.get("schedule", {})) if old_raw else {}
    clean_new = _clean(req.schedule)
    
    changes, affected = diff_schedules(old_schedule, clean_new)
    
    save_schedule(clean_new)
    if changes:
        add_history_entry(
            operation_type="MANUAL_OVERWRITE",
            description=f"Manual drag & drop modifications ({len(changes)} cells affected)",
            affected_sections=affected,
            changes=changes,
            status="SUCCESS",
            constraints=[]
        )
    return {
        "status": "SUCCESS",
        "message": "Schedule overwritten manually.",
        "schedule": clean_new,
        "grid": _build_grid(clean_new),
        **_timetable_constants(),
    }


# ═════════════════════════════════════════════════════════════════════════════
# SCHEDULE PROPOSALS (SUPER TEACHER WORKFLOW)
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/schedule/proposals")
def get_proposals():
    from storage import load_proposals
    return {"proposals": load_proposals()}

@app.post("/schedule/propose")
def propose_schedule(req: ProposeRequest):
    from storage import save_proposal
    import uuid as _uuid
    
    old_raw = load_schedule()
    old_schedule = _clean(old_raw.get("schedule", {})) if old_raw else {}
    clean_new = _clean(req.schedule)
    
    changes, affected = diff_schedules(old_schedule, clean_new)
    
    proposal = {
        "id": str(_uuid.uuid4()),
        "proposer": req.proposer,
        "proposer_name": req.proposer_name,
        "description": req.description,
        "timestamp": datetime.now().isoformat(),
        "changes_count": len(changes),
        "changes": changes,
        "schedule": clean_new,
        "status": "PENDING"
    }
    save_proposal(proposal)
    return {"status": "SUCCESS", "message": "Proposal submitted.", "proposal": proposal}

@app.post("/schedule/proposals/{proposal_id}/approve")
def approve_proposal(proposal_id: str):
    from storage import load_proposals, delete_proposal
    proposals = load_proposals()
    target = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not target:
        raise HTTPException(404, "Proposal not found.")
    
    clean_new = target["schedule"]
    save_schedule(clean_new)
    if target.get("changes"):
        add_history_entry(
            operation_type="PROPOSAL_APPROVED",
            description=f"Approved changes by {target.get('proposer_name')} ({len(target['changes'])} cells affected)",
            affected_sections=[],
            changes=target["changes"],
            status="SUCCESS",
            constraints=[]
        )
    
    delete_proposal(proposal_id)
    return {"status": "SUCCESS", "message": "Proposal approved and applied."}

@app.delete("/schedule/proposals/{proposal_id}")
def reject_proposal(proposal_id: str):
    from storage import delete_proposal
    delete_proposal(proposal_id)
    return {"status": "SUCCESS", "message": "Proposal rejected."}


# ═════════════════════════════════════════════════════════════════════════════
# INJECT SUBJECT (ADD TO TIMETABLE)
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/schedule/inject")
def inject_subject(req: InjectRequest):
    """Insert one or more new class entries into the current schedule."""
    if not schedule_exists():
        raise HTTPException(400, "No timetable generated yet. Call POST /generate first.")

    if not req.entries:
        raise HTTPException(400, "No entries provided.")

    data = load_data()
    sched_data = load_schedule()
    current = sched_data["schedule"]
    old_schedule = _clean(dict(current))  # snapshot before mutation

    # Build a set of existing task IDs to avoid collisions
    existing_ids = set(current.keys())

    # Build a lookup of faculty_name -> faculty for room assignment
    rooms = data.get("rooms", [])
    subjects_lookup = {s["code"].lower(): s for s in data.get("subjects", [])}

    injected_entries = []

    for entry in req.entries:
        # Check for section collisions first
        for t_id, info in current.items():
            if info.get("section_id") == entry.section_id and info.get("day_index") == entry.day_index:
                c_start = info.get("period_index", 0)
                c_dur = info.get("duration", 1)
                c_end = c_start + c_dur
                
                e_start = entry.period_index
                e_dur = entry.duration
                e_end = e_start + e_dur
                
                if max(c_start, e_start) < min(c_end, e_end):
                    raise HTTPException(400, f"Section {entry.section_id} already has a class scheduled at {const.DAYS[entry.day_index]} Period {e_start + 1}.")

        # Determine room: use provided room_id, or auto-pick first available
        room_id = entry.room_id or ""
        room_name = ""
        if room_id:
            for r in rooms:
                if r["id"] == room_id:
                    room_name = f"{r['id']} ({'Lab' if r.get('is_lab') else r.get('building', 'Main')})"
                    break
        elif rooms:
            # Auto-assign: pick a room not occupied at this slot
            occupied_rooms = set()
            for info in current.values():
                if info.get("day_index") == entry.day_index and info.get("period_index") == entry.period_index:
                    occupied_rooms.add(info.get("room_id", ""))
                # For multi-period blocks, also check period_index + 1
                dur = info.get("duration", 1)
                if dur > 1:
                    for di in range(dur):
                        if info.get("day_index") == entry.day_index and info.get("period_index") + di == entry.period_index:
                            occupied_rooms.add(info.get("room_id", ""))

            # Prefer labs for lab subjects, regular rooms for theory
            sub_info = subjects_lookup.get(entry.subject_code.lower(), {})
            is_lab_subject = sub_info.get("type", "THEORY").upper() == "LAB"

            for r in rooms:
                if r["id"] not in occupied_rooms:
                    if is_lab_subject and r.get("is_lab"):
                        room_id = r["id"]
                        room_name = f"{r['id']} (Lab)"
                        break
                    elif not is_lab_subject and not r.get("is_lab"):
                        room_id = r["id"]
                        room_name = f"{r['id']} ({r.get('building', 'Main')})"
                        break
            # Fallback: just pick the first available
            if not room_id:
                for r in rooms:
                    if r["id"] not in occupied_rooms:
                        room_id = r["id"]
                        room_name = f"{r['id']} ({r.get('building', 'Main')})"
                        break

        # Generate a unique task ID
        base_id = f"{entry.subject_code.lower()}-{entry.section_id.lower()}-INJECT"
        task_id = base_id
        counter = 0
        while task_id in existing_ids:
            counter += 1
            task_id = f"{base_id}-{counter}"
        existing_ids.add(task_id)

        # Compute start_slot for compatibility
        start_slot = entry.day_index * const.NUM_TEACHING_SLOTS_PER_DAY + entry.period_index

        schedule_entry = {
            "start_slot": start_slot,
            "day_index": entry.day_index,
            "day_name": const.DAYS[entry.day_index] if entry.day_index < len(const.DAYS) else f"Day{entry.day_index}",
            "period_index": entry.period_index,
            "room_id": room_id,
            "room_name": room_name,
            "faculty_name": entry.faculty_name,
            "subject_code": entry.subject_code.lower(),
            "section_id": entry.section_id,
            "duration": entry.duration,
        }

        current[task_id] = schedule_entry
        injected_entries.append({"task_id": task_id, **schedule_entry})

    # Save updated schedule
    save_schedule(current)
    # Log history
    clean = _clean(current)
    changes, affected = diff_schedules(old_schedule, clean)
    if changes:
        add_history_entry(
            operation_type="INJECT_SUBJECT",
            description=f"Injected {len(injected_entries)} class(es) (e.g. {injected_entries[0].get('subject_code') if injected_entries else 'subject'})",
            affected_sections=affected,
            changes=changes,
            status="SUCCESS",
            constraints=[]
        )

    return {
        "status": "SUCCESS",
        "message": f"Injected {len(injected_entries)} class(es) into the timetable.",
        "injected": injected_entries,
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }

@app.post("/schedule/remove")
def remove_class(req: RemoveRequest):
    """Remove a specific class from the timetable manually."""
    if not schedule_exists():
        raise HTTPException(400, "No timetable generated yet.")

    sched_data = load_schedule()
    current = sched_data["schedule"]
    old_schedule = _clean(dict(current))  # snapshot before mutation

    if req.task_id not in current:
        raise HTTPException(404, f"Class with ID {req.task_id} not found.")

    removed_entry = current.pop(req.task_id)

    # Save updated schedule
    save_schedule(current)
    clean = _clean(current)
    changes, affected = diff_schedules(old_schedule, clean)
    if changes:
        add_history_entry(
            operation_type="REMOVE_SUBJECT",
            description=f"Removed class: {removed_entry.get('subject_code')} from {removed_entry.get('section_id')}",
            affected_sections=affected,
            changes=changes,
            status="SUCCESS",
            constraints=[]
        )

    clean = _clean(current)
    return {
        "status": "SUCCESS",
        "message": "Class removed successfully.",
        "removed": req.task_id,
        "schedule": clean,
        "grid": _build_grid(clean),
        **_timetable_constants(),
    }


@app.get("/schedule/free-teachers")
def get_free_teachers(day_index: int, period_index: int):
    """Return teachers who have NO class at the given (day, period) slot."""
    if not schedule_exists():
        raise HTTPException(400, "No timetable generated yet.")

    data = load_data()
    sched_data = load_schedule()
    current = sched_data["schedule"]
    faculties = data.get("faculties", [])

    # Find all faculty names busy at this slot
    busy_names = set()
    for info in current.values():
        d = info.get("day_index")
        p = info.get("period_index")
        dur = info.get("duration", 1)
        if d == day_index:
            for i in range(dur):
                if p + i == period_index:
                    busy_names.add(info.get("faculty_name", "").strip().lower())

    # Return faculties NOT busy
    free = []
    busy = []
    for fac in faculties:
        fac_name = fac.get("name", "").strip()
        if fac_name.lower() in busy_names:
            busy.append({
                "id": fac["id"],
                "name": fac_name,
                "designation": fac.get("designation", ""),
                "max_hours": fac.get("max_hours", 18),
                "status": "busy",
            })
        else:
            free.append({
                "id": fac["id"],
                "name": fac_name,
                "designation": fac.get("designation", ""),
                "max_hours": fac.get("max_hours", 18),
                "status": "free",
            })

    return {
        "day_index": day_index,
        "period_index": period_index,
        "free_count": len(free),
        "busy_count": len(busy),
        "free_teachers": free,
        "busy_teachers": busy,
    }


# ═════════════════════════════════════════════════════════════════════════════
# UPDATE TIMETABLE
# ═════════════════════════════════════════════════════════════════════════════

_PRIORITY_KEYWORDS = [
    "replace", "substitute", "take over", "will take", "on leave", "cover",
    "permanently", "change faculty", "hand over", "assign all",
    "cancel", "no class", "holiday", "off day",
    "no toc", "no nlp", "no ml", "no cn", "no sepm", "no nosql",
    "move", "shift", "reschedule", "transfer", "relocate",
    "change room", "to lab", "to room", "assign room",
    "extra class", "makeup", "compensatory", "schedule extra",
    "swap", "exchange", "freeze", "lock slot",
    "should not be free", "must not be free", "cannot be free",
    "must have a class", "should have a class", "no free period",
    "first hour", "first period", "last period", "last hour",
]

@app.post("/update")
def update(req: UpdateRequest):
    if not schedule_exists():
        raise HTTPException(400, "No timetable generated yet. Call POST /generate first.")

    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(400, "Prompt cannot be empty.")

    try:
        data = load_data()
        constraints = []

        use_local = any(kw in prompt.lower() for kw in _PRIORITY_KEYWORDS)
        if use_local:
            local = smart_parse(prompt, data["faculties"],
                                data.get("subjects", []), data.get("sections", []))
            if local:
                constraints = [local]

        if not constraints:
            result = get_constraint(prompt)
            if not result.get("success"):
                raise HTTPException(400, result.get("error", "Constraint parse failed."))
            constraints = result.get("constraints", [])

        if not constraints:
            raise HTTPException(422, "Could not parse any constraint from the instruction.")

        if req.preview_only:
            return {
                "preview": True,
                "parsed_constraints": constraints,
                "constraint_type": constraints[0].get("type", "?"),
            }

        sched = load_schedule()
        current_solution = sched["schedule"]
        previous_schedule_clean = _clean(current_solution)

        facs, subs, secs, rooms, allocs = _build_objects(data)
        tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)
        tasks_by_id = {t.task_id: t for t in tasks}

        for tid, info in current_solution.items():
            if tid in tasks_by_id:
                info["task_obj"] = tasks_by_id[tid]

        final_solution = current_solution
        all_changes = []

        for constraint in constraints:
            optimizer = PartialOptimizer(tasks, facs, secs, rooms, final_solution)
            op_status, new_solution, _, summary = \
                optimizer.apply_constraint_and_reoptimize(constraint)

            if op_status in ("OPTIMAL", "FEASIBLE", "NO_CHANGE"):
                final_solution = new_solution
                all_changes.append(summary)
            else:
                all_changes.append(f"⚠️ {summary}")

        if req.propose_only:
            # Compute but don't save — return schedule for the frontend to propose
            clean = _clean(final_solution)
            return {
                "status": "PROPOSED",
                "parsed_constraints": constraints,
                "changes": all_changes,
                "schedule": clean,
            }

        save_schedule(final_solution)
        clean = _clean(final_solution)
        changes, affected = diff_schedules(previous_schedule_clean, clean)
        
        add_history_entry(
            operation_type="SLM_UPDATE",
            description=f"AI Update: {prompt}",
            affected_sections=affected,
            changes=changes,
            status="SUCCESS",
            constraints=constraints
        )

        clean = _clean(final_solution)
        return {
            "status": "SUCCESS",
            "parsed_constraints": constraints,
            "constraint_type": constraints[0].get("type", "?"),
            "changes": all_changes,
            "previous_schedule": previous_schedule_clean,
            "updated_schedule": clean,
            "grid": _build_grid(clean),
            **_timetable_constants(),
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, traceback.format_exc())


# ═════════════════════════════════════════════════════════════════════════════
# LEAVES & SUBSTITUTIONS
# ═════════════════════════════════════════════════════════════════════════════

class LeaveRequestIn(BaseModel):
    faculty_id: str
    days: list[str]
    reason: str

@app.get("/leave")
def get_leaves():
    return {"leaves": load_leave_requests()}

@app.post("/leave", status_code=201)
def create_leave(req: LeaveRequestIn):
    leaves = load_leave_requests()
    leave_id = str(uuid.uuid4())
    new_leave = {
        "leave_id": leave_id,
        "faculty_id": req.faculty_id,
        "days": req.days,
        "reason": req.reason,
        "status": "PENDING"
    }
    leaves.append(new_leave)
    save_leave_requests(leaves)
    return {"message": "Leave request created", "leave": new_leave}

@app.post("/leave/approve/{leave_id}")
def approve_leave(leave_id: str):
    leaves = load_leave_requests()
    target_leave: dict | None = next((l for l in leaves if l.get("leave_id") == leave_id), None)
            
    if not target_leave:
        raise HTTPException(404, "Leave request not found")
        
    if target_leave.get("status") != "PENDING":
        raise HTTPException(400, f"Leave is already {target_leave.get('status')}")
        
    target_leave["status"] = "APPROVED"
    save_leave_requests(leaves)
    
    # Convert dict to namedtuple or dataclass instance expected by engine
    from models import LeaveRequest as LRModel
    lr_obj = LRModel(**target_leave)
    
    # Trigger substitution finder
    process_leave_approval(lr_obj)
    
    return {"message": "Leave approved and substitution process started."}

@app.post("/leave/reject/{leave_id}")
def reject_leave(leave_id: str):
    leaves = load_leave_requests()
    target = next((l for l in leaves if l["leave_id"] == leave_id), None)
    if not target: raise HTTPException(404, "Leave request not found")
    target["status"] = "REJECTED"
    save_leave_requests(leaves)
    return {"message": "Leave request rejected."}

@app.get("/substitution")
@app.get("/substitution/pending")
def get_pending_substitutions(faculty_id: str | None = None):
    check_timeouts()
    reqs = load_substitution_requests()
    
    if faculty_id:
        reqs = [r for r in reqs if r["candidate_faculty_id"] == faculty_id and r["status"] == "PENDING"]
    else:
        reqs = [r for r in reqs if r["status"] == "PENDING"]
        
    return {"substitutions": reqs}

@app.post("/substitution/{request_id}/accept")
def accept_substitution(request_id: str):
    success, msg = handle_acceptance(request_id)
    if not success:
        raise HTTPException(400, msg)
    return {"message": msg}

@app.post("/substitution/{request_id}/decline")
def decline_substitution(request_id: str):
    success, msg = handle_decline(request_id)
    if not success:
        raise HTTPException(400, msg)
    return {"message": msg}

@app.get("/substitution/unresolved")
def get_unresolved_substitutions():
    check_timeouts()
    # A slot is unresolved if all requests for it are DECLINED/TIMEOUT, and no ACCEPTED exists
    # Or if no requests were generated at all (handled separately or indicated by lack of requests)
    reqs = load_substitution_requests()
    leaves = load_leave_requests()
    
    unresolved_slots = []
    # simplified logic: find slots where all reqs are not PENDING/ACCEPTED
    # A true implementation would group by leave_id + slot
    
    return {"unresolved": unresolved_slots, "message": "Not fully implemented for MVP"}

# ═════════════════════════════════════════════════════════════════════════════
# CANCELLATION REQUESTS
# ═════════════════════════════════════════════════════════════════════════════

class CancellationRequestIn(BaseModel):
    section_id: str
    day: str
    period: int
    subject: str
    reason: str
    faculty_id: str

@app.post("/cancellations/request", status_code=201)
def create_cancellation_request(req: CancellationRequestIn):
    cancellations = load_cancellations()
    cancel_id = str(uuid.uuid4())
    new_cancel = {
        "id": cancel_id,
        "section_id": req.section_id,
        "day": req.day,
        "period": req.period,
        "subject": req.subject,
        "reason": req.reason,
        "faculty_id": req.faculty_id,
        "status": "PENDING",
        "created_at": datetime.now().isoformat()
    }
    cancellations.append(new_cancel)
    save_cancellations(cancellations)
    return {"message": "Cancellation request submitted", "cancellation": new_cancel}

@app.get("/cancellations")
def get_cancellations():
    return {"cancellations": load_cancellations()}

@app.post("/cancellations/{cancel_id}/status")
def update_cancellation_status(cancel_id: str, payload: dict = Body(...)):
    status = payload.get("status")
    if not status:
        raise HTTPException(400, "Missing status")
        
    cancellations = load_cancellations()
    target = next((c for c in cancellations if c["id"] == cancel_id), None)
    if not target:
        raise HTTPException(404, "Cancellation not found")
    
    target["status"] = status
    save_cancellations(cancellations)
    return {"message": f"Cancellation marked as {status}", "cancellation": target}

# ═════════════════════════════════════════════════════════════════════════════
# CHANGE HISTORY
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/history")
def get_history():
    history = load_history()
    return {
        "count": len(history),
        "history": list(reversed(history)),
    }

@app.post("/history/revert/{history_id}")
def revert_history(history_id: str, force: bool = False):
    history = load_history()
    entry = next((e for e in history if e.get("id") == history_id), None)
    if not entry:
        raise HTTPException(404, "History entry not found.")
    
    sched_raw = load_schedule() or {}
    current_sched = sched_raw.get("schedule", {}) if isinstance(sched_raw, dict) else {}
    changes = entry.get("changes", [])
    
    if not force:
        # Check for conflicts
        conflicts = []
        for c in changes:
            tid = c["task_id"]
            curr_val = _clean({tid: current_sched[tid]}).get(tid) if tid in current_sched else None
            after_val = c["after"]
            if curr_val != after_val:
                conflicts.append(tid)
        
        if conflicts:
            raise HTTPException(409, {
                "message": "Conflict detected: The timetable has been modified since this change was made. Reverting will overwrite those newer modifications. Do you want to force revert?",
                "conflicts": conflicts
            })
    
    # Apply revert
    new_sched = dict(current_sched)
    for c in changes:
        tid = c["task_id"]
        before_val = c["before"]
        if before_val is None:
            if tid in new_sched:
                del new_sched[tid]
        else:
            new_sched[tid] = dict(before_val)
            
    clean_new = _clean(new_sched)
    save_schedule(clean_new)
    
    # Mark the original entry as REVERTED (keep it visible)
    entry["status"] = "REVERTED"
    save_history(history)
    
    # Log the revert itself as a new entry
    rev_changes, rev_affected = diff_schedules(_clean(current_sched), clean_new)
    if rev_changes:
        add_history_entry(
            operation_type="REVERT",
            description=f"Reverted: {entry.get('description', history_id)}",
            affected_sections=rev_affected,
            changes=rev_changes,
            status="SUCCESS"
        )
        
    return {
        "status": "SUCCESS",
        "message": "Revert successful.",
        "schedule": clean_new,
        "grid": _build_grid(clean_new),
        **_timetable_constants(),
    }

@app.delete("/history")
def delete_history():
    clear_history()
    return {"message": "History cleared."}
