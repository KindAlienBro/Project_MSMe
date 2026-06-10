import json

data = json.load(open('timetable_data.json'))

if not any(s['id'] == '7a-B1' for s in data['sections']):
    data['sections'].extend([
        {'id': '7a-B1', 'semester': 7, 'strength': 30},
        {'id': '7a-B2', 'semester': 7, 'strength': 30}
    ])

new_allocs = [
    # DLRL Theory (Kavitha)
    {'faculty_id': 'kavitha', 'subject_code': 'dlrl', 'section_id': '7a-B1', 'elective_group': None},
    {'faculty_id': 'kavitha', 'subject_code': 'dlrl', 'section_id': '7a-B2', 'elective_group': None},
    
    # DLRL Lab
    {'faculty_id': 'kavitha', 'subject_code': 'dlrllab', 'section_id': '7a-B1', 'elective_group': None},
    {'faculty_id': 'vijayashekar', 'subject_code': 'dlrllab', 'section_id': '7a-B2', 'elective_group': None},
    
    # ML2 Theory (Vikas)
    {'faculty_id': 'vikas', 'subject_code': 'ml2', 'section_id': '7a-B1', 'elective_group': None},
    {'faculty_id': 'vikas', 'subject_code': 'ml2', 'section_id': '7a-B2', 'elective_group': None},
    
    # ML2 Lab (Vikas)
    {'faculty_id': 'vikas', 'subject_code': 'ml2lab', 'section_id': '7a-B1', 'elective_group': None},
    {'faculty_id': 'vikas', 'subject_code': 'ml2lab', 'section_id': '7a-B2', 'elective_group': None},
    
    # DSP Theory (Jovin)
    {'faculty_id': 'jovin', 'subject_code': 'dsp', 'section_id': '7a-B1', 'elective_group': None},
    {'faculty_id': 'jovin', 'subject_code': 'dsp', 'section_id': '7a-B2', 'elective_group': None},
    
    # BA / BDA Electives
    {'faculty_id': 'surbhi', 'subject_code': 'ba', 'section_id': '7a-B1', 'elective_group': 'sem7_elec_common'},
    {'faculty_id': 'adrash', 'subject_code': 'bda', 'section_id': '7a-B2', 'elective_group': 'sem7_elec_common'},
    
    # OE7 Elective
    {'faculty_id': 'oe_fac_3', 'subject_code': 'oe7', 'section_id': '7a-B1', 'elective_group': 'oe7_common'},
    {'faculty_id': 'oe_fac_3', 'subject_code': 'oe7', 'section_id': '7a-B2', 'elective_group': 'oe7_common'},
    
    # Major Project 2
    {'faculty_id': 'adrash', 'subject_code': 'major2', 'section_id': '7a-B1', 'elective_group': 'sem7_proj_common'},
    {'faculty_id': 'anu', 'subject_code': 'major2', 'section_id': '7a-B2', 'elective_group': 'sem7_proj_common'}
]

existing_keys = set(f"{a['faculty_id']}-{a['subject_code']}-{a['section_id']}" for a in data['allocations'])
for a in new_allocs:
    k = f"{a['faculty_id']}-{a['subject_code']}-{a['section_id']}"
    if k not in existing_keys:
        data['allocations'].append(a)

with open('timetable_data.json', 'w') as f:
    json.dump(data, f, indent=4)
