import uuid
from datetime import datetime, timedelta
import json
from typing import List, Optional, Dict, Any

from models import (
    LeaveRequest, LeaveStatus, SubstitutionRequest, SubstitutionStatus,
    AffectedSlot, ProposedSwap
)
from storage import (
    load_schedule, load_data, save_schedule, add_history_entry,
    load_substitution_requests, save_substitution_requests,
    load_leave_requests, save_leave_requests
)
import constants as const

def _get_faculty_id_by_name(name: str, faculties: list) -> Optional[str]:
    """Resolve a faculty display name (e.g. 'Prof. Anu') to its internal ID ('anu')."""
    name_clean = name.replace("Prof. ", "").replace("Dr. ", "").replace("Mr. ", "").replace("Ms. ", "").strip().lower()
    # Exact ID match first
    for f in faculties:
        if name_clean == f["id"].lower():
            return f["id"]
    # Substring / partial match
    for f in faculties:
        if name_clean in f["id"].lower() or name_clean in f["name"].lower():
            return f["id"]
        # Also check the other direction
        if f["id"].lower() in name_clean or f["name"].replace("Prof. ", "").replace("Dr. ", "").replace("Mr. ", "").replace("Ms. ", "").strip().lower() in name_clean:
            return f["id"]
    # Word-level match: check if any word in the input matches a faculty ID
    for word in name_clean.split():
        for f in faculties:
            if word == f["id"].lower():
                return f["id"]
    return None

def _get_faculty_name_by_id(fac_id: str, faculties: list) -> str:
    for f in faculties:
        if f["id"] == fac_id:
            return f["name"]
    return fac_id

def _resolve_faculty_id(raw_id: str, faculties: list) -> Optional[str]:
    """
    Given a raw faculty identifier (could be an internal ID like 'anu',
    a display name like 'Prof. Anu', or a user full name like 'Anu Sharma'),
    resolve it to the canonical internal faculty ID.
    """
    # 1. Direct match on ID
    for f in faculties:
        if f["id"].lower() == raw_id.lower():
            return f["id"]
    # 2. Direct match on name
    for f in faculties:
        if f["name"].lower() == raw_id.lower():
            return f["id"]
    # 3. Try _get_faculty_id_by_name (handles prefix stripping)
    result = _get_faculty_id_by_name(raw_id, faculties)
    if result:
        return result
    # 4. Word-level: check each word of raw_id against faculty IDs
    words = raw_id.replace("Prof. ", "").replace("Dr. ", "").replace("Mr. ", "").replace("Ms. ", "").strip().lower().split()
    for word in words:
        if len(word) < 2:  # skip very short words
            continue
        for f in faculties:
            if word == f["id"].lower():
                return f["id"]
            fname_clean = f["name"].replace("Prof. ", "").replace("Dr. ", "").replace("Mr. ", "").replace("Ms. ", "").strip().lower()
            if word == fname_clean or word in fname_clean.split():
                return f["id"]
    return None

def _parent_section(section_id: str) -> str:
    """Merge sub-sections like '6b-E1', '6b-E2' into parent '6b'."""
    return section_id.split("-")[0] if "-" in section_id else section_id

def process_leave_approval(leave: LeaveRequest):
    """Entry point when a leave is approved. Finds affected slots and starts substitution process."""
    schedule_data = load_schedule()
    if not schedule_data or not schedule_data.get("schedule"):
        return

    data = load_data()
    faculties = data.get("faculties", [])
    allocations = data.get("allocations", [])

    # Resolve the leave's faculty_id to the canonical internal ID.
    # The frontend may send a display name like "Anu Sharma" instead of "anu".
    resolved_fac_id = _resolve_faculty_id(leave.faculty_id, faculties)
    if not resolved_fac_id:
        # Fallback: try using the raw value
        resolved_fac_id = leave.faculty_id

    leave_fac_name = _get_faculty_name_by_id(resolved_fac_id, faculties)

    affected_tasks = []
    current_solution = schedule_data["schedule"]
    
    # Track which (parent_section, subject, day, period) combos we've already added
    # to avoid duplicate requests for E1/E2 batches of the same class
    seen_slots = set()
    
    # Identify affected classes for the given days
    for task_id, info in current_solution.items():
        faculty_name = info.get("faculty_name", "")
        # Resolve this task's faculty to an internal ID for reliable comparison
        task_fac_id = _get_faculty_id_by_name(faculty_name, faculties)
        
        day_index = info.get("day_index", 0)
        day_name = const.DAYS[day_index] if day_index < len(const.DAYS) else f"Day {day_index}"
        
        # Check if the task belongs to the leaving faculty and on one of their leave days
        if task_fac_id and task_fac_id == resolved_fac_id and day_name in leave.days:
            # Handle duration (labs are 2 hours, theory 1 hour)
            duration = info.get("duration", 1)
            period = info.get("period_index", 0)
            subject = info.get("subject_code", "")
            parent_sec = _parent_section(info.get("section_id", ""))
            
            for i in range(duration):
                slot_key = (subject, parent_sec, day_name, period + i)
                if slot_key in seen_slots:
                    continue  # Skip E2 if E1 already added for same class
                seen_slots.add(slot_key)
                
                affected_tasks.append(AffectedSlot(
                    subject_code=subject,
                    section_id=parent_sec,  # Use parent section (e.g., '6b' not '6b-E1')
                    day=day_name,
                    period=period + i,
                    room_id=info.get("room_id", "")
                ))

    # For each affected slot, find substitutes
    for slot in affected_tasks:
        find_substitutes_for_slot(slot, resolved_fac_id, leave.leave_id, current_solution, data)

def find_substitutes_for_slot(slot: AffectedSlot, leave_faculty_id: str, leave_id: str, current_solution: dict, data: dict):
    """Applies the Priority Ladder to find substitutes."""
    faculties = data.get("faculties", [])
    
    # Find all faculties teaching the same subject anywhere
    teach_same_subject = set()
    for task_id, info in current_solution.items():
        if info.get("subject_code") == slot.subject_code:
            fac_id = _get_faculty_id_by_name(info.get("faculty_name", ""), faculties)
            if fac_id and fac_id != leave_faculty_id:
                teach_same_subject.add(fac_id)
                
    # Build a map of faculty busyness
    busyness = {f["id"]: [] for f in faculties}
    day_idx = const.DAYS.index(slot.day) if slot.day in const.DAYS else -1
    for task_id, info in current_solution.items():
        if info.get("day_index") == day_idx:
            fac_id = _get_faculty_id_by_name(info.get("faculty_name", ""), faculties)
            if fac_id:
                duration = info.get("duration", 1)
                start_p = info.get("period_index", 0)
                for i in range(duration):
                    busyness[fac_id].append(start_p + i)
                    
    # Also exclude anyone who is currently on an approved leave for this day
    leave_requests = load_leave_requests()
    on_leave_today = set()
    # Always include the leaving faculty
    on_leave_today.add(leave_faculty_id)
    for lr in leave_requests:
        if lr.get("status") == "APPROVED" and slot.day in lr.get("days", []):
            # Resolve the raw faculty_id to internal ID so it matches
            resolved = _resolve_faculty_id(lr.get("faculty_id", ""), faculties)
            if resolved:
                on_leave_today.add(resolved)
            on_leave_today.add(lr.get("faculty_id"))  # keep raw value too

    candidates_p1 = []  # Same subject, free
    candidates_p2 = []  # Same subject, busy
    candidates_p3 = []  # Free, any subject

    # Priority 1 & 2
    for fac_id in teach_same_subject:
        if fac_id in on_leave_today: continue
        if slot.period not in busyness.get(fac_id, []):
            candidates_p1.append(fac_id)
        else:
            candidates_p2.append(fac_id)

    # Priority 3
    for fac in faculties:
        fac_id = fac["id"]
        if fac_id == leave_faculty_id or fac_id in on_leave_today: continue
        if slot.period not in busyness.get(fac_id, []) and fac_id not in candidates_p1:
            candidates_p3.append(fac_id)

    # Dispatch logic
    if candidates_p1:
        _dispatch_requests(candidates_p1, slot, leave_faculty_id, leave_id, 1)
    elif candidates_p2:
        # P2 needs a swap. For simplicity, just pick a random free slot of the candidate
        # that the leaving teacher is not using. This requires a bit more logic.
        # For MVP, we'll try to find any free slot for candidate `f` and propose a swap.
        for fac_id in candidates_p2:
             free_slots = [p for p in range(const.NUM_TEACHING_SLOTS_PER_DAY) if p not in busyness[fac_id] and p not in busyness.get(leave_faculty_id, [])]
             if free_slots:
                 swap = ProposedSwap(
                     subject_code=slot.subject_code,
                     day=slot.day,
                     original_period=slot.period,
                     new_period=free_slots[0]
                 )
                 _dispatch_requests([fac_id], slot, leave_faculty_id, leave_id, 2, swap)
                 return # Just propose one for now
        
        # Fallback to P3 if no swaps found
        if candidates_p3:
             _dispatch_requests(candidates_p3, slot, leave_faculty_id, leave_id, 3)
    elif candidates_p3:
        _dispatch_requests(candidates_p3, slot, leave_faculty_id, leave_id, 3)
    else:
        # Priority 4: Nobody available, escalate to Admin.
        pass

def _dispatch_requests(candidates: list, slot: AffectedSlot, original_fac_id: str, leave_id: str, priority: int, swap: Optional[ProposedSwap] = None):
    requests = load_substitution_requests()
    now = datetime.now()
    expires = now + timedelta(hours=24)
    
    for fac_id in candidates:
        # NEVER send a substitute request to the original faculty
        if fac_id == original_fac_id:
            continue
        # don't send duplicates
        existing = [r for r in requests if r["leave_id"] == leave_id and r["affected_slot"]["period"] == slot.period and r["affected_slot"]["section_id"] == slot.section_id and r["candidate_faculty_id"] == fac_id and r["status"] == "PENDING"]
        if existing: continue

        req = SubstitutionRequest(
            request_id=str(uuid.uuid4()),
            leave_id=leave_id,
            affected_slot=slot,
            original_faculty_id=original_fac_id,
            candidate_faculty_id=fac_id,
            priority_level=priority,
            status=SubstitutionStatus.PENDING,
            sent_at=now.isoformat(),
            expires_at=expires.isoformat(),
            proposed_swap=swap
        )
        import dataclasses
        requests.append(dataclasses.asdict(req))
    
    save_substitution_requests(requests)

def handle_acceptance(request_id: str):
    requests = load_substitution_requests()
    target_req = next((r for r in requests if r["request_id"] == request_id), None)
    if not target_req or target_req["status"] != "PENDING":
        return False, "Request not found or not pending."
        
    target_req["status"] = "ACCEPTED"
    target_req["responded_at"] = datetime.now().isoformat()
    
    # Withdraw others for the same slot+day combination
    for r in requests:
        if (r["leave_id"] == target_req["leave_id"] 
            and r["affected_slot"]["period"] == target_req["affected_slot"]["period"]
            and r["affected_slot"]["day"] == target_req["affected_slot"]["day"]
            and r["request_id"] != request_id):
            if r["status"] == "PENDING":
                 r["status"] = "WITHDRAWN"
                 
    save_substitution_requests(requests)
    
    # Update Timetable
    schedule_data = load_schedule()
    if not schedule_data or not schedule_data.get("schedule"):
        return True, "Substitution accepted but no schedule to update."

    current_solution = schedule_data.get("schedule", {})
    data = load_data()
    faculties = data.get("faculties", [])
    
    # Resolve faculty IDs reliably
    original_fac_id = _resolve_faculty_id(target_req["original_faculty_id"], faculties) or target_req["original_faculty_id"]
    sub_fac_id = _resolve_faculty_id(target_req["candidate_faculty_id"], faculties) or target_req["candidate_faculty_id"]
    
    leave_fac_name = _get_faculty_name_by_id(original_fac_id, faculties)
    sub_fac_name = _get_faculty_name_by_id(sub_fac_id, faculties)
                            
    day_idx = const.DAYS.index(target_req["affected_slot"]["day"]) if target_req["affected_slot"]["day"] in const.DAYS else -1
    
    # The affected_slot section_id is a parent section (e.g., '6b').
    # We must update ALL sub-sections (6b-E1, 6b-E2, etc.) that match.
    parent_sec = target_req["affected_slot"]["section_id"]
    
    updated = False
    for task_id, info in current_solution.items():
         faculty_name = info.get("faculty_name", "")
         # Use ID-based matching instead of fragile name stripping
         task_fac_id = _get_faculty_id_by_name(faculty_name, faculties)
         
         # Match by parent section (e.g., task '6b-E1' matches parent '6b')
         task_parent_sec = info.get("section_id", "").split("-")[0] if "-" in info.get("section_id", "") else info.get("section_id", "")
         
         if (task_fac_id and task_fac_id == original_fac_id 
             and info.get("day_index") == day_idx
             and task_parent_sec == parent_sec):
              # Match period
              duration = info.get("duration", 1)
              start_p = info.get("period_index", 0)
              if start_p <= target_req["affected_slot"]["period"] < start_p + duration:
                   # Update to the substitute teacher
                   info["faculty_name"] = sub_fac_name
                   info["is_substituted"] = True
                   info["original_faculty_name"] = leave_fac_name
                   updated = True
                   # DON'T break — update ALL sub-sections (E1, E2, etc.)
                   
    # If swap involved, swap the slots
    if target_req.get("proposed_swap"):
         swap = target_req["proposed_swap"]
         # Not fully implemented atomic swap for brevity, but this is where it'd go
         pass

    # Save the updated schedule using the storage module (supports CommitScheduler)
    save_schedule(current_solution)
    
    add_history_entry(
        operation_type="SUBSTITUTION",
        description=f"Substituted {leave_fac_name} with {sub_fac_name} for {target_req['affected_slot']['subject_code']} on {target_req['affected_slot']['day']} P{target_req['affected_slot']['period']+1}",
        affected_sections=[target_req['affected_slot'].get('section_id', '')],
        changes=[],
        status="SUCCESS",
    )
    
    return True, "Substitution accepted and timetable updated."

def handle_decline(request_id: str):
    requests = load_substitution_requests()
    target_req = next((r for r in requests if r["request_id"] == request_id), None)
    if not target_req or target_req["status"] != "PENDING":
        return False, "Request not found or not pending."
        
    target_req["status"] = "DECLINED"
    target_req["responded_at"] = datetime.now().isoformat()
    save_substitution_requests(requests)
    
    # Ideally, trigger find_substitutes_for_slot again here or move to next priority level.
    # We would need to keep track of which priority level we are currently exploring for this slot.
    
    return True, "Substitution declined."

def check_timeouts():
    requests = load_substitution_requests()
    changed = False
    now = datetime.now()
    for r in requests:
        if r["status"] == "PENDING" and datetime.fromisoformat(r["expires_at"]) < now:
            r["status"] = "TIMEOUT"
            changed = True
    if changed:
        save_substitution_requests(requests)
