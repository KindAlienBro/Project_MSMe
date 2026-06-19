import io

with open('timetable_slm-main/api.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add File, UploadFile
if 'File, UploadFile' not in content:
    content = content.replace('from fastapi import FastAPI, HTTPException', 'from fastapi import FastAPI, HTTPException, File, UploadFile')
if 'StreamingResponse' not in content:
    if 'from fastapi.responses import JSONResponse' in content:
        content = content.replace('from fastapi.responses import JSONResponse', 'from fastapi.responses import JSONResponse, StreamingResponse')
    else:
        content = content.replace('from fastapi import FastAPI, HTTPException, File, UploadFile\n', 'from fastapi import FastAPI, HTTPException, File, UploadFile\nfrom fastapi.responses import StreamingResponse\n')

# Add Excel import/export endpoints
excel_endpoints = """
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
        
        import re
        def parse_int(val, default):
            if pd.isna(val) or val == '': return default
            try:
                return int(val)
            except (ValueError, TypeError):
                m = re.search(r'\d+', str(val))
                return int(m.group()) if m else default

        if 'Faculties' in xls.sheet_names:
            df = pd.read_excel(xls, 'Faculties').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["faculties"].append({
                        "id": str(row.get('id')),
                        "name": str(row.get('name', '')),
                        "designation": str(row.get('designation', 'Asst. Prof')),
                        "max_hours": parse_int(row.get('max_hours'), 18)
                    })
                    
        if 'Subjects' in xls.sheet_names:
            df = pd.read_excel(xls, 'Subjects').fillna('')
            for _, row in df.iterrows():
                if row.get('code'):
                    data["subjects"].append({
                        "code": str(row.get('code')),
                        "name": str(row.get('name', '')),
                        "type": str(row.get('type', 'THEORY')),
                        "credits": parse_int(row.get('credits'), 3),
                        "is_core": bool(row.get('is_core', True)),
                        "is_heavy": bool(row.get('is_heavy', False))
                    })
                    
        if 'Sections' in xls.sheet_names:
            df = pd.read_excel(xls, 'Sections').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["sections"].append({
                        "id": str(row.get('id')),
                        "semester": parse_int(row.get('semester'), 1),
                        "strength": parse_int(row.get('strength'), 60)
                    })
                    
        if 'Rooms' in xls.sheet_names:
            df = pd.read_excel(xls, 'Rooms').fillna('')
            for _, row in df.iterrows():
                if row.get('id'):
                    data["rooms"].append({
                        "id": str(row.get('id')),
                        "capacity": parse_int(row.get('capacity'), 60),
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
"""
if '/data/template/excel' not in content:
    content = content.replace('# ═════════════════════════════════════════════════════════════════════════════\n# MANAGE FACULTIES', excel_endpoints + '# MANAGE FACULTIES')

# Add PUT for faculties
put_fac = """
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

"""
if '@app.put("/data/faculties/{faculty_id}")' not in content:
    content = content.replace('@app.delete("/data/faculties")', put_fac + '@app.delete("/data/faculties")')

# Add PUT for subjects
put_sub = """
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

"""
if '@app.put("/data/subjects/{subject_code}")' not in content:
    content = content.replace('@app.delete("/data/subjects")', put_sub + '@app.delete("/data/subjects")')

# Add PUT for sections
put_sec = """
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

"""
if '@app.put("/data/sections/{section_id}")' not in content:
    content = content.replace('@app.delete("/data/sections")', put_sec + '@app.delete("/data/sections")')

# Add PUT for rooms
put_room = """
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

"""
if '@app.put("/data/rooms/{room_id}")' not in content:
    content = content.replace('@app.delete("/data/rooms")', put_room + '@app.delete("/data/rooms")')

# Add PUT for allocations
put_alloc = """
@app.put("/data/allocations/{idx}")
def update_allocation(idx: int, alloc: AllocationIn):
    data = load_data()
    if idx < 0 or idx >= len(data["allocations"]):
        raise HTTPException(404, f"Allocation index {idx} out of range.")
    data["allocations"][idx] = alloc.model_dump()
    save_data(data)
    return {"message": "Allocation updated.", "allocation": alloc.model_dump()}

"""
if '@app.put("/data/allocations/{idx}")' not in content:
    content = content.replace('@app.delete("/data/allocations")', put_alloc + '@app.delete("/data/allocations")')

# Add PUT for scheduling rules
put_rule = """
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

"""
if '@app.put("/scheduling-rules/{rule_id}")' not in content:
    content = content.replace('@app.delete("/scheduling-rules/{rule_id}")', put_rule + '@app.delete("/scheduling-rules/{rule_id}")')

with open('timetable_slm-main/api.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added PUT and Excel endpoints.")
