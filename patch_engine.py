import re

with open('timetable_slm-main/constraint_engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Bypass faculty overlap for DUMMY_STAFF
overlap_target = '''        for faculty_id in intervals_by_faculty:
            self.model.AddNoOverlap(intervals_by_faculty[faculty_id])'''

overlap_replacement = '''        for faculty_id in intervals_by_faculty:
            if faculty_id == "DUMMY_STAFF":
                continue
            self.model.AddNoOverlap(intervals_by_faculty[faculty_id])'''
content = content.replace(overlap_target, overlap_replacement)

# 2. Bypass stretch constraint for DUMMY_STAFF
stretch_target = '''        for task in self.tasks:
            tasks_by_entity[f"fac_{task.faculty.id}"].append(task)
            tasks_by_entity[f"sec_{task.section.section_id}"].append(task)'''

stretch_replacement = '''        for task in self.tasks:
            if task.faculty.id != "DUMMY_STAFF":
                tasks_by_entity[f"fac_{task.faculty.id}"].append(task)
            tasks_by_entity[f"sec_{task.section.section_id}"].append(task)'''
content = content.replace(stretch_target, stretch_replacement)

# 3. Bypass room assignments
room_target = '''    def _get_allowed_rooms(self, task: Task) -> List[int]:
        allowed = []
        for i, room in enumerate(self.rooms):'''

room_replacement = '''    def _get_allowed_rooms(self, task: Task) -> List[int]:
        if task.subject.subject_code in ["LIB_HR", "STU_HR", "FAC_HR", "STDY_HR"]:
            return [-1]
            
        allowed = []
        for i, room in enumerate(self.rooms):'''
content = content.replace(room_target, room_replacement)

with open('timetable_slm-main/constraint_engine.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("constraint_engine.py patched.")
