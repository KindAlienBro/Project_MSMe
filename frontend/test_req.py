import json
import urllib.request
import urllib.error

data = json.dumps({"schedule": {"task_1": {"section_id": "6a-E1", "day_index": 0, "period_index": 1}}}).encode("utf-8")
req = urllib.request.Request("https://kindalien-timetable-gen.hf.space/schedule/overwrite", data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as f:
        print(f.status)
        print(f.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode("utf-8"))
