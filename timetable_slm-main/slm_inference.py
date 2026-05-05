# slm_inference.py
import re, requests
from typing import List, Dict, Any, Optional

API_URL = 'https://vishwasmsme-timetable-slm-api.hf.space'
DAY_WORDS = {
    'monday':'MON','tuesday':'TUE','wednesday':'WED',
    'thursday':'THU','friday':'FRI','saturday':'SAT',
    'mon':'MON','tue':'TUE','wed':'WED',
    'thu':'THU','fri':'FRI','sat':'SAT',
}

def get_constraint(instruction):
    try:
        r = requests.post(f'{API_URL}/constraint',json={'instruction':instruction},timeout=60)
        r.raise_for_status(); return r.json()
    except Exception as e:
        return {'success':False,'error':str(e),'constraints':[]}

def get_constraints_batch(instructions):
    try:
        r = requests.post(f'{API_URL}/constraints/batch',json={'instructions':instructions},timeout=120)
        r.raise_for_status(); return r.json().get('all_constraints',[])
    except Exception as e:
        print(f'API Error: {e}'); return []

def check_api_health():
    try:
        return requests.get(f'{API_URL}/health',timeout=10).json().get('model_loaded',False)
    except: return False

def smart_parse(prompt, faculties_data, subjects_data=None, sections_data=None):
    p = prompt.lower().strip()
    fac_map = _build_fac_map(faculties_data)
    sub_map = _build_sub_map(subjects_data or [])
    days    = _extract_all_days(p)
    period  = _extract_period(p)

    # NO FREE PERIOD — "first hour should not be free", "period 1 must have a class"
    no_free_kw = ['should not be free', 'must not be free', 'cannot be free',
                  'should always be occupied', 'always be occupied', 'always occupied',
                  'no free slot in', 'free slot in period', 'no free in',
                  'must have a class', 'should have a class', 'always occupied',
                  'no free period', 'no free slot', 'must be filled',
                  'first hour should not', 'last period should not']
    if any(kw in p for kw in no_free_kw):
        # Detect which period(s) are required
        periods = []
        if any(w in p for w in ['first hour', 'period 1', 'p1', 'first period', 'slot 1']):
            periods = [0]   # 0-indexed: P1
        elif any(w in p for w in ['last hour', 'last period', 'last slot']):
            periods = [-1]  # will resolve to last period dynamically
        elif any(w in p for w in ['second period', 'period 2', 'p2']):
            periods = [1]
        elif any(w in p for w in ['third period', 'period 3', 'p3']):
            periods = [2]
        else:
            # Try to extract any period number mentioned
            nums = re.findall(r'period\s*(\d+)|p\s*(\d+)|slot\s*(\d+)', p)
            for g in nums:
                n = next((int(x) for x in g if x), None)
                if n: periods.append(n - 1)
        if not periods:
            periods = [0]  # default: first period
        return {
            'type':      'NO_FREE_PERIOD',
            'periods':   periods,
            'section_id': _extract_section(p, sections_data),
        }

    # FACULTY SUBSTITUTION
    if any(kw in p for kw in ['replace','substitute','take over','will take','on leave',
                                'covering','cover for','instead of','will cover','deputed']):
        facs = _find_two_faculties(p, fac_map)
        if facs:
            return {'type':'FACULTY_SUBSTITUTION','from_faculty_id':facs[0],
                    'to_faculty_id':facs[1],'days':days,
                    'subject_codes':_extract_subjects(p,sub_map)}

    # NO SUBJECT ON DAY — "No TOC on Thursday", "No NLP class on Friday for 5A"
    no_subj_kw = ['no toc', 'no nlp', 'no ml', 'no cn', 'no sepm', 'no nosql',
                  'no rmipr', 'no iks', 'no evs', 'no dvlab', 'no cnlab',
                  'no nlplab', 'no mllab', 'no miniproj', 'no major', 'no genai',
                  'no devops', 'no hcai', 'no cc ', 'no forum', 'no softskill']
    has_no_subj = any(kw in p for kw in no_subj_kw)
    # Also catch "no [subject_name] class/on/for"
    has_no_class = bool(re.search(r'no\s+\w+\s+(class|on|for)', p))
    if has_no_subj or has_no_class:
        subs = _extract_subjects(p, sub_map)
        if subs and days:
            return {
                'type':         'CANCEL_CLASS',
                'subject_code': subs[0],
                'day':          days[0],
                'section_id':   _extract_section(p, sections_data),
                'faculty_id':   None,
                'period':       None,
            }

    # CANCEL / HOLIDAY
    holiday_kws = ['holiday','off day','public holiday','is a holiday','college is closed',
                   'closed on','college closed','no classes on','no classes for all',
                   'is holiday']
    cancel_kws2 = ['cancel','no class','no lecture','cancelled','remove','delete','drop']
    is_holiday = any(kw in p for kw in holiday_kws)
    is_cancel  = any(kw in p for kw in cancel_kws2)

    # Whole-day clear: holiday OR (cancel/no classes with NO subject mentioned)
    subs_found = _extract_subjects(p, sub_map)
    fid_found  = _extract_one_faculty(p, fac_map)
    whole_day  = is_holiday or (is_cancel and not subs_found and not fid_found and not period)

    if (is_holiday or is_cancel) and days:
        if whole_day:
            return {'type':'MARK_HOLIDAY', 'days':days,
                    'section_id':_extract_section(p, sections_data)}
        return {'type':'CANCEL_CLASS', 'day':days[0], 'period':period,
                'subject_code': subs_found[0] if subs_found else None,
                'section_id':   _extract_section(p, sections_data),
                'faculty_id':   fid_found}

    # CHANGE ROOM — detect "to Lab 2", "to R3", "shift all labs to L3"
    # Must run BEFORE move/reschedule to prevent "Move NLPLAB to Lab 2" → RESCHEDULE_LAB
    room_match = re.search(r'\b(lab\s*\d+|l\d+|r\d+|room\s*\d+)\b', p)
    room_val = room_match.group(1).replace(' ','').upper() if room_match else None
    room_dest_kws = ['to lab ', 'to l', 'to r', 'to room', 'change room',
                     'assign room', 'move to lab', 'move to room', 'labs to']
    has_room_dest = any(kw in p for kw in room_dest_kws) and room_val
    if has_room_dest:
        subs_r = _extract_subjects(p, sub_map)
        return {'type':         'CHANGE_ROOM',
                'new_room_id':  room_val,
                'room_id':      room_val,
                'subject_code': subs_r[0] if subs_r else None,
                'section_id':   _extract_section(p, sections_data),
                'day':          days[0] if days else None,
                'all_labs':     'all' in p and 'lab' in p}

    # MOVE / RESCHEDULE — only if NOT a cancel/remove keyword
    move_kws = ['move','shift','reschedule','transfer','relocate']
    cancel_kws = ['cancel','remove','delete','drop','no class','holiday']
    is_move   = any(kw in p for kw in move_kws)
    is_cancel = any(kw in p for kw in cancel_kws)
    if is_move and not is_cancel:
        subs = _extract_subjects(p, sub_map)
        is_lab = ('lab' in p or (subs and any(s.lower().endswith('lab') for s in subs)))
        if is_lab and subs:
            # "from X to Y" → days[0]=from, days[1]=to
            # "to Y" only   → days[0]=to, from_day=None
            from_day = days[0] if len(days) >= 2 else None
            to_day   = days[1] if len(days) >= 2 else (days[0] if days else None)
            return {'type':'RESCHEDULE_LAB',
                    'subject_code': subs[0],
                    'section_id':   _extract_section(p, sections_data),
                    'from_day':     from_day,
                    'to_day':       to_day,
                    'to_period':    period or 1}
        if len(days) >= 2:
            subs = _extract_subjects(p, sub_map)
            return {'type':'MOVE_CLASS',
                    'from_day':     days[0],
                    'to_day':       days[1],
                    'subject_code': subs[0] if subs else None,
                    'section_id':   _extract_section(p, sections_data),
                    'faculty_id':   _extract_one_faculty(p, fac_map)}

    # CHANGE ROOM
    if any(kw in p for kw in ['change room','move to room','to lab','to room','assign room']):
        rm = re.search(r'\b([rl]\d+|lab\s*\d*|room\s*\d+)\b', p)
        return {'type':'CHANGE_ROOM',
                'room_id':rm.group(1).replace(' ','') if rm else None,
                'subject_code':(_extract_subjects(p,sub_map) or [None])[0],
                'section_id':_extract_section(p,sections_data),
                'day':days[0] if days else None}

    # ADD EXTRA / MAKEUP
    # Check for "schedule [subject] session/class" pattern like "Schedule extra ML session"
    import re as _re
    has_schedule_class = bool(_re.search(
        r'(schedule|add)\s+(extra|additional|makeup|compensatory)?\s*\w+\s*(class|session)', p))
    extra_keywords = ['extra class','makeup','additional class','make up',
                      'compensatory','add class','schedule extra','extra session',
                      'additional session','schedule.*class','add.*session']
    if has_schedule_class or any(kw in p for kw in extra_keywords):
        subs = _extract_subjects(p, sub_map)
        return {'type':'ADD_EXTRA_CLASS',
                'subject_code':subs[0] if subs else None,
                'section_id':_extract_section(p,sections_data),
                'faculty_id':_extract_one_faculty(p,fac_map),
                'day':days[0] if days else None,
                'period': period or (5 if 'afternoon' in p else
                                     1 if 'morning' in p else None)}

    # CHANGE FACULTY (permanent)
    perm_kws = ['permanently','all classes','change faculty','hand over',
                'assign all','transfer all']
    if any(kw in p for kw in perm_kws):
        facs  = _find_two_faculties(p, fac_map) or []
        scodes = _extract_subjects(p, sub_map)
        # "Assign all X to Y" / "Transfer A's classes to B" → to_fac = LAST mentioned
        # "Change faculty from A to B" → from=A (first), to=B (second)
        if len(facs) >= 2:
            # "from A to B" order → from=facs[0], to=facs[1]
            if 'from' in p and 'to' in p:
                from_fac, to_fac = facs[0], facs[1]
            else:
                # "assign all ... to Syed" → to_fac is the one after "to"
                to_idx = p.rfind(' to ')
                if to_idx > 0:
                    after_to = p[to_idx+4:]
                    to_fac   = next((fi for n,fi in fac_map.items() if n and n in after_to), facs[-1])
                    from_fac = next((fi for fi in facs if fi != to_fac), facs[0])
                else:
                    from_fac, to_fac = facs[0], facs[1]
        elif len(facs) == 0:
            # Try single faculty extraction
            single = _extract_one_faculty(p, fac_map)
            from_fac, to_fac = None, single
        elif len(facs) == 1:
            # Only one faculty mentioned — they're the target (to_fac)
            from_fac, to_fac = None, facs[0]
        else:
            from_fac, to_fac = None, None
        if to_fac or (scodes and not facs):
            # If no faculty found but subject found, still create constraint
            # (partial — will match by subject code only)
            return {'type':'CHANGE_FACULTY',
                    'from_faculty_id': from_fac,
                    'to_faculty_id':   to_fac,
                    'subject_codes':   scodes,
                    'subject_code':    scodes[0] if scodes else None,
                    'section_id':_extract_section(p,sections_data)}

    # SWAP
    if any(kw in p for kw in ['swap','exchange']):
        import re as _re
        periods = _re.findall(r'p(?:eriod)?\s*(\d+)', p)
        subs    = _extract_subjects(p, sub_map)
        # Extract faculty ids in order of appearance in prompt
        fac_found = sorted(
            [(name, fid, p.index(name)) for name, fid in fac_map.items()
             if name and name in p],
            key=lambda x: x[2]
        )
        # Deduplicate by fid keeping first occurrence
        seen, fac_ids = set(), []
        for _, fid, _ in fac_found:
            if fid not in seen:
                fac_ids.append(fid); seen.add(fid)
        return {'type':          'SWAP_CLASSES',
                'day1':          days[0] if len(days) > 0 else None,
                'day2':          days[1] if len(days) > 1 else None,
                'period1':       int(periods[0]) if len(periods) > 0 else None,
                'period2':       int(periods[1]) if len(periods) > 1 else None,
                'subject_code1': subs[0]    if len(subs)    > 0 else None,
                'subject_code2': subs[1]    if len(subs)    > 1 else None,
                'subject_codes': subs,
                'faculty_id1':   fac_ids[0] if len(fac_ids) > 0 else None,
                'faculty_id2':   fac_ids[1] if len(fac_ids) > 1 else None,
                'section_id':    _extract_section(p, sections_data)}

    # FREEZE
    if any(kw in p for kw in ['freeze','lock slot','fix this slot','keep this',
                                'lock ','don\'t move','do not move','should not change',
                                'it should not change','fix mllab','fix nlplab',
                                'fix cnlab','fix dvlab']):
        subs = _extract_subjects(p, sub_map)
        return {'type':'FREEZE_SLOT','day':days[0] if days else None,'period':period,
                'subject_code':subs[0] if subs else None,
                'section_id':_extract_section(p,sections_data)}

    return None

def _build_fac_map(fds):
    m = {}
    for f in fds:
        m[f['name'].lower()] = f['id']
        short = re.sub(r'(prof\.|dr\.|mr\.|ms\.)\s*','',f['name'],flags=re.I).strip()
        m[short.lower()] = f['id']
        m[f['id'].lower()] = f['id']
    return m

def _build_sub_map(sds):
    m = {}
    for s in sds:
        m[s['name'].lower()] = s['code']
        m[s['code'].lower()]  = s['code']
    return m

def _extract_all_days(text):
    found, seen = [], set()
    for w, d in DAY_WORDS.items():
        idx = text.find(w)
        if idx >= 0 and d not in seen:
            found.append((idx,d)); seen.add(d)
    found.sort(); return [d for _,d in found]

def _extract_period(text):
    m = re.search(r'p(?:eriod)?\s*(\d+)', text)
    return int(m.group(1)) if m else None

def _extract_subjects(text, sub_map):
    # Sort by name length descending so "nlplab" matches before "nlp"
    sorted_items = sorted(sub_map.items(), key=lambda x: -len(x[0]))
    seen_codes, seen_names, results = set(), set(), []
    for name, code in sorted_items:
        if not name or name not in text: continue
        if code in seen_codes: continue
        # Skip if a longer name already matched that contains this name
        # e.g. skip "nlp" if "nlplab" already matched
        already_covered = any(matched for matched in seen_names if name in matched)
        if already_covered: continue
        results.append(code)
        seen_codes.add(code)
        seen_names.add(name)
    return results

def _extract_one_faculty(text, fac_map):
    for name,fid in fac_map.items():
        if name and name in text: return fid
    return None

def _find_two_faculties(text, fac_map):
    found = []
    for name,fid in sorted(fac_map.items(), key=lambda x:-len(x[0])):
        if name and name in text and fid not in found:
            found.append(fid)
        if len(found)==2: break
    return found if len(found)==2 else None

def _extract_section(text, sections_data):
    if not sections_data: return None
    # Sort by length descending so "6a-e1" matches before "6a"
    for s in sorted(sections_data, key=lambda x: -len(x['id'])):
        if s['id'].lower() in text:
            return s['id']
    # Match shorthand like "6a" -> return prefix as parent filter
    # e.g. "6a" matches 6a-E1 AND 6a-E2 -> return "6A" (prefix)
    # caller uses this to filter all sub-sections of 6A
    prefixes = {}
    for s in sections_data:
        prefix = s['id'].split('-')[0].lower()
        prefixes.setdefault(prefix, []).append(s['id'])
    for prefix, ids in sorted(prefixes.items(), key=lambda x: -len(x[0])):
        pattern = r'(?<![a-z0-9])' + re.escape(prefix) + r'(?![a-z0-9])'
        if re.search(pattern, text):
            if len(ids) == 1:
                return ids[0]        # unique — return full id
            else:
                return prefix.upper()  # ambiguous — return parent "6A", "5A" etc.
    return None
    # Sort by length descending so "6a-e1" matches before "6a"
    for s in sorted(sections_data, key=lambda x: -len(x['id'])):
        if s['id'].lower() in text:
            return s['id']
    # Match shorthand like "6a" -> returns None if multiple sections share prefix
    # e.g. "6a" matches 6a-E1 AND 6a-E2, so return None (move all of them)
    prefixes = {}
    for s in sections_data:
        prefix = s['id'].split('-')[0].lower()
        prefixes.setdefault(prefix, []).append(s['id'])
    for prefix, ids in prefixes.items():
        if re.search(r'' + prefix + r'', text):
            if len(ids) == 1:
                return ids[0]  # unique match
            # multiple sections with same prefix — return None (affects all)
    return None

def parse_substitution_prompt(prompt, faculties_data):
    result = smart_parse(prompt, faculties_data)
    return result if result and result.get('type')=='FACULTY_SUBSTITUTION' else {}