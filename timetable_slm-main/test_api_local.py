import sys
import unittest.mock as mock

sys.modules['fastapi'] = mock.MagicMock()
sys.modules['fastapi.middleware.cors'] = mock.MagicMock()
sys.modules['pydantic'] = mock.MagicMock()

sys.path.append(r"c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_slm-main")

import api

class MockReq:
    def __init__(self, schedule):
        self.schedule = schedule

req = MockReq({"task_1": {"section_id": "6a-E1", "day_index": 0, "period_index": 1}})

try:
    res = api.overwrite_schedule(req)
    print("Success:", res["status"])
except Exception as e:
    import traceback
    traceback.print_exc()
