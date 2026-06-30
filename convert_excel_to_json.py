import pandas as pd
import io
import json
import os
import re

file_path = r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_template.xlsx'
json_path = r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_slm-main\timetable_data.json'

def parse_int(val, default):
    if pd.isna(val) or val == '': return default
    try:
        return int(val)
    except (ValueError, TypeError):
        m = re.search(r'\d+', str(val))
        return int(m.group()) if m else default

try:
    xls = pd.ExcelFile(file_path)
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
                    "max_hours": parse_int(row.get('max_hours', 18), 18)
                })
                
    if 'Subjects' in xls.sheet_names:
        df = pd.read_excel(xls, 'Subjects').fillna('')
        for _, row in df.iterrows():
            if row.get('code'):
                data["subjects"].append({
                    "code": str(row.get('code')),
                    "name": str(row.get('name', '')),
                    "type": str(row.get('type', 'THEORY')),
                    "credits": parse_int(row.get('credits', 3), 3),
                    "is_core": bool(row.get('is_core', True)),
                    "is_heavy": bool(row.get('is_heavy', False))
                })
                
    if 'Sections' in xls.sheet_names:
        df = pd.read_excel(xls, 'Sections').fillna('')
        for _, row in df.iterrows():
            if row.get('id'):
                data["sections"].append({
                    "id": str(row.get('id')),
                    "semester": parse_int(row.get('semester', 1), 1),
                    "strength": parse_int(row.get('strength', 60), 60)
                })
                
    if 'Rooms' in xls.sheet_names:
        df = pd.read_excel(xls, 'Rooms').fillna('')
        for _, row in df.iterrows():
            if row.get('id'):
                data["rooms"].append({
                    "id": str(row.get('id')),
                    "capacity": parse_int(row.get('capacity', 60), 60),
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
    
    if 'Scheduling Rules' in xls.sheet_names:
        import uuid as _uuid
        df = pd.read_excel(xls, 'Scheduling Rules').fillna('')
        for _, row in df.iterrows():
            rule_type = str(row.get('rule_type', '')).strip()
            if not rule_type:
                continue
            rule = {"id": str(_uuid.uuid4()), "rule_type": rule_type}
            
            sc = str(row.get('subject_codes', '')).strip()
            rule["subject_codes"] = [s.strip() for s in sc.split(',') if s.strip()] if sc else []
            
            st = str(row.get('subject_types', '')).strip()
            rule["subject_types"] = [s.strip() for s in st.split(',') if s.strip()] if st else []
            
            period_str = str(row.get('period', '')).strip()
            if period_str and 'Period' in period_str:
                try:
                    rule["period_index"] = int(period_str.replace('Period ', '')) - 1
                except ValueError:
                    pass
            
            max_period_str = str(row.get('max_period', '')).strip()
            if max_period_str and 'Period' in max_period_str:
                try:
                    rule["max_period_index"] = int(max_period_str.replace('Period ', '')) - 1
                except ValueError:
                    pass
            
            days_str = str(row.get('days', '')).strip()
            if days_str:
                rule["days"] = [d.strip() for d in days_str.split(',') if d.strip()]
            
            data["scheduling_rules"].append(rule)
    else:
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                existing_data = json.load(f)
            data["scheduling_rules"] = existing_data.get("scheduling_rules", [])

    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)

    print("Successfully converted timetable_template.xlsx to timetable_data.json!")

except Exception as e:
    print(f"Error: {e}")
