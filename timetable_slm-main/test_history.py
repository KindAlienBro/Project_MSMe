import sys
sys.path.append(r"c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_slm-main")
import storage

try:
    storage.add_history_entry(
        operation_type="TEST",
        description="test",
        affected_sections=[],
        changes=[],
        status="SUCCESS",
        constraints=[]
    )
    print("add_history_entry succeeded")
except Exception as e:
    import traceback
    traceback.print_exc()
