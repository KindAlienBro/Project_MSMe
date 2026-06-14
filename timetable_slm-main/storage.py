# storage.py
# Handles all persistent storage: timetable data, saved schedules, change history
# Uses HuggingFace Hub CommitScheduler to persist data across Space restarts.

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path
import threading
import uuid

# ── HuggingFace Persistent Storage Setup ─────────────────────────────────
# On HuggingFace Spaces, files written at runtime are EPHEMERAL.
# CommitScheduler auto-commits changed files back to the repo periodically.

_scheduler = None
_scheduler_lock = threading.Lock()

# Directory where persistent JSON files are stored
DATA_DIR = Path(__file__).resolve().parent  # Always use the directory where storage.py is located

DATA_FILE     = str(DATA_DIR / 'timetable_data.json')
SCHEDULE_FILE = str(DATA_DIR / 'saved_schedule.json')
HISTORY_FILE  = str(DATA_DIR / 'change_history.json')
LEAVE_FILE    = str(DATA_DIR / 'leave_requests.json')
SUB_REQ_FILE  = str(DATA_DIR / 'substitution_requests.json')
ORIGINAL_FILE = str(DATA_DIR / 'original_schedule.json')
VERSIONS_FILE = str(DATA_DIR / 'schedule_versions.json')
PENDING_FILE  = str(DATA_DIR / 'pending_timetables.json')
CANCELLATION_FILE = str(DATA_DIR / 'cancellations.json')

def _get_scheduler():
    """Lazily initialize the CommitScheduler (only on HuggingFace Spaces)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    
    with _scheduler_lock:
        if _scheduler is not None:
            return _scheduler
        
        # Only enable on HuggingFace Spaces (SPACE_ID env var is set)
        space_id = os.environ.get("SPACE_ID")
        if not space_id:
            return None  # Running locally, no scheduler needed
        
        try:
            from huggingface_hub import CommitScheduler
            _scheduler = CommitScheduler(
                repo_id=space_id,
                repo_type="space",
                folder_path=str(DATA_DIR),
                path_in_repo=".",
                every=2,  # Commit every 2 minutes
                allow_patterns=[
                    "*.json",       # All JSON data files
                ],
                squash_history=True,  # Keep repo history clean
            )
            print(f"[storage] CommitScheduler initialized for {space_id}")
        except Exception as e:
            print(f"[storage] CommitScheduler failed to initialize: {e}")
            _scheduler = None
        
        return _scheduler


def _safe_write_json(filepath: str, data):
    """Write JSON to file. The CommitScheduler will auto-commit changes."""
    # Get scheduler to ensure it's initialized (will auto-detect file changes)
    _get_scheduler()
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


def _safe_read_json(filepath: str, default=None):
    """Read JSON from file with error handling."""
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default


# ── Timetable Data (faculties, subjects, sections etc.) ──────────────────
def load_data() -> Dict:
    result = _safe_read_json(DATA_FILE)
    if result:
        return result
    return {'faculties': [], 'subjects': [], 'sections': [],
            'rooms': [], 'allocations': []}

def save_data(data: Dict):
    _safe_write_json(DATA_FILE, data)

# ── Saved Schedule (the fixed semester timetable) ────────────────────────
def save_schedule(solution: Dict[str, Any]):
    """Save the generated timetable as the fixed semester schedule."""
    serializable = {}
    for task_id, info in solution.items():
        serializable[task_id] = {k: v for k, v in info.items() if k != 'task_obj'}
    
    payload = {
        'generated_at': datetime.now().isoformat(),
        'schedule': serializable
    }
    _safe_write_json(SCHEDULE_FILE, payload)

def load_schedule() -> Optional[Dict]:
    """Load the saved semester schedule."""
    return _safe_read_json(SCHEDULE_FILE)

def schedule_exists() -> bool:
    return os.path.exists(SCHEDULE_FILE)

def clear_schedule():
    if os.path.exists(SCHEDULE_FILE):
        os.remove(SCHEDULE_FILE)

# ── Original Schedule (snapshot taken at generation time) ───────────────

def save_original_schedule(solution: Dict[str, Any]):
    """Save a permanent snapshot of the originally generated timetable."""
    serializable = {}
    for task_id, info in solution.items():
        serializable[task_id] = {k: v for k, v in info.items() if k != 'task_obj'}
    payload = {
        'generated_at': datetime.now().isoformat(),
        'schedule': serializable
    }
    _safe_write_json(ORIGINAL_FILE, payload)

def load_original_schedule() -> Optional[Dict]:
    """Load the original (never-modified) timetable snapshot."""
    return _safe_read_json(ORIGINAL_FILE)

def original_schedule_exists() -> bool:
    return os.path.exists(ORIGINAL_FILE)

def clear_original_schedule():
    if os.path.exists(ORIGINAL_FILE):
        os.remove(ORIGINAL_FILE)

# ── Change History ────────────────────────────────────────────────────────
def load_history() -> list:
    return _safe_read_json(HISTORY_FILE, default=[])

def add_history_entry(operation_type: str, description: str, affected_sections: list, changes: list, status: str = "SUCCESS", constraints: list = None):
    history = load_history()
    history.append({
        'id': str(uuid.uuid4()),
        'timestamp': datetime.now().isoformat(),
        'operation_type': operation_type,
        'description': description,
        'affected_sections': affected_sections or [],
        'changes': changes or [],
        'status': status,
        'constraints': constraints or [],
    })
    _safe_write_json(HISTORY_FILE, history)

def save_history(history: list):
    _safe_write_json(HISTORY_FILE, history)

def clear_history():
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)

# ── Schedule Versions ─────────────────────────────────────────────────────

def load_versions() -> list:
    return _safe_read_json(VERSIONS_FILE, default=[])

def save_version(label: str = None):
    """Snapshot the current schedule + history as a version before clearing."""
    if not schedule_exists():
        return None
    sched = load_schedule()
    history = load_history()
    versions = load_versions()
    version_id = str(uuid.uuid4())
    version_num = len(versions) + 1
    auto_label = label or f"Version {version_num}"
    versions.append({
        'id': version_id,
        'label': auto_label,
        'timestamp': datetime.now().isoformat(),
        'generated_at': sched.get('generated_at', ''),
        'schedule': sched.get('schedule', {}),
        'history': history,
    })
    _safe_write_json(VERSIONS_FILE, versions)
    return version_id

def restore_version(version_id: str):
    """Restore a saved version as the active schedule."""
    versions = load_versions()
    target = next((v for v in versions if v['id'] == version_id), None)
    if not target:
        return None
    # Save the schedule (the raw dict, not the wrapper)
    save_schedule(target['schedule'])
    # Restore history
    _safe_write_json(HISTORY_FILE, target.get('history', []))
    return target

# ── Pending Proposals ─────────────────────────────────────────────────────

def load_proposals() -> list:
    return _safe_read_json(PENDING_FILE, default=[])

def save_proposal(proposal: dict):
    proposals = load_proposals()
    proposals.append(proposal)
    _safe_write_json(PENDING_FILE, proposals)

def delete_proposal(proposal_id: str):
    proposals = load_proposals()
    proposals = [p for p in proposals if p.get('id') != proposal_id]
    _safe_write_json(PENDING_FILE, proposals)

# ── Leave Requests ────────────────────────────────────────────────────────

def load_leave_requests() -> list:
    return _safe_read_json(LEAVE_FILE, default=[])

def save_leave_requests(requests: list):
    _safe_write_json(LEAVE_FILE, requests)

def clear_leave_requests():
    if os.path.exists(LEAVE_FILE): os.remove(LEAVE_FILE)

# ── Substitution Requests ─────────────────────────────────────────────────

def load_substitution_requests() -> list:
    return _safe_read_json(SUB_REQ_FILE, default=[])

def save_substitution_requests(requests: list):
    _safe_write_json(SUB_REQ_FILE, requests)

def clear_substitution_requests():
    if os.path.exists(SUB_REQ_FILE): os.remove(SUB_REQ_FILE)

# ── Cancellation Requests ─────────────────────────────────────────────────

def load_cancellations() -> list:
    return _safe_read_json(CANCELLATION_FILE, default=[])

def save_cancellations(requests: list):
    _safe_write_json(CANCELLATION_FILE, requests)
