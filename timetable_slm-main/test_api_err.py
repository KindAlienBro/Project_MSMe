import sys
import os

sys.path.append(r"c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_slm-main")

try:
    from api import diff_schedules, _clean
    
    old_sched = {
        "task1": {"section_id": "6a-E1", "day_index": 0, "period_index": 1}
    }
    new_sched = {
        "task1": {"section_id": "6a-E1", "day_index": 0, "period_index": 2}
    }
    
    old_c = _clean(old_sched)
    new_c = _clean(new_sched)
    print("Clean successful")
    
    changes, affected = diff_schedules(old_c, new_c)
    print("Diff successful", changes, affected)
except Exception as e:
    import traceback
    traceback.print_exc()
