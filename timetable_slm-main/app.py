# app.py

import streamlit as st
import pandas as pd
from collections import defaultdict
from datetime import datetime

from storage import (load_data, save_data, save_schedule, load_schedule,
                     schedule_exists, clear_schedule, load_history,
                     add_history_entry, clear_history,
                     save_original_schedule, load_original_schedule,
                     original_schedule_exists, clear_original_schedule)
from models import Faculty, Subject, Section, Room, SubjectType
from data_loader import Allocation, prepare_scheduling_tasks
from solver import TimetableSolver
from slm_inference import get_constraint, check_api_health
from partial_optimizer import PartialOptimizer
import constants as const

st.set_page_config(page_title="VTU Timetable Generator", layout="wide")

# ── Helpers ───────────────────────────────────────────────────────────────
def get_subject_type_enum(type_str):
    return {
        "THEORY": SubjectType.THEORY, "LAB": SubjectType.LAB,
        "SOFTSKILL": SubjectType.SOFTSKILL, "FORUM": SubjectType.FORUM
    }.get(type_str.upper(), SubjectType.THEORY)

def convert_json_to_objects(data):
    fac_objs  = [Faculty(f['id'], f['name'], f['designation'], f['max_hours'])
                 for f in data['faculties']]
    sub_objs  = [Subject(s['code'], s['name'], s['credits'],
                         get_subject_type_enum(s['type']),
                         s.get('is_core', True), s.get('is_heavy', False))
                 for s in data['subjects']]
    sec_objs  = [Section(s['id'], s['semester'], s['strength'])
                 for s in data['sections']]
    room_objs = [Room(r['id'], r['capacity'], r['is_lab'], r['building'])
                 for r in data['rooms']]
    alloc_objs = [Allocation(a['faculty_id'], a['subject_code'],
                             a['section_id'], a.get('elective_group'))
                  for a in data['allocations']]
    return fac_objs, sub_objs, sec_objs, room_objs, alloc_objs

def rebuild_objects(data):
    """Rebuild all domain objects from stored data."""
    return convert_json_to_objects(data)

def render_timetable_html(solution, sections):
    """Render the timetable as an HTML table."""
    parent_sections = sorted(list(set(
        s.section_id.split('-')[0].upper() for s in sections)))

    # Grid stores list of (subject_code, faculty_name) per slot
    merged_grid = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for task_id, info in solution.items():
        sec_id     = info.get('section_id', '')
        parent_sec = sec_id.split('-')[0].upper()
        day        = info.get('day_index', 0)
        period     = info.get('period_index', 0)
        dur        = info.get('duration', 1)
        subject    = info.get('subject_code', '?').upper()
        faculty    = info.get('faculty_name', '')
        short_fac  = (faculty.replace('Prof. ','').replace('Dr. ','')
                      .replace('Mr. ','').replace('Ms. ',''))
        for i in range(dur):
            entry = (subject, short_fac)
            if entry not in merged_grid[parent_sec][day][period + i]:
                merged_grid[parent_sec][day][period + i].append(entry)

    st.markdown("""
    <style>
    table.tt { width:100%; border-collapse:collapse; font-size:0.82em; }
    table.tt th, table.tt td {
        border:2px solid #555; padding:5px 4px;
        text-align:center; vertical-align:middle; min-width:80px;
    }
    table.tt th { background:#2b2b2b; color:#fff; font-weight:bold; }
    .vt  { writing-mode:vertical-rl; transform:rotate(180deg);
           font-weight:bold; background:#1e1e1e; color:#ccc; }
    .dh  { font-weight:bold; background:#1a1a2e; color:#fff; }
    .subj { font-weight:bold; font-size:0.95em; color:#4fc3f7; }
    .fac  { font-size:0.78em; color:#aaa; margin-top:2px; }
    .multi-subj { border-top:1px dashed #555; margin-top:3px; padding-top:3px; }
    </style>""", unsafe_allow_html=True)

    for p_sec in parent_sections:
        st.markdown(f"### Section: {p_sec}")
        html = '<table class="tt"><tr><th>Day \\ Time</th>'
        for h in const.TIMETABLE_HEADERS:
            html += f'<th>{h}</th>'
        html += '</tr>'

        # Detect all days that have classes (including Saturday from extra classes)
        days_in_solution = set()
        for task_id, info in solution.items():
            sec = info.get('section_id','')
            if sec.split('-')[0].upper() == p_sec or sec.upper() == p_sec:
                days_in_solution.add(info['day_index'])

        # Always show Mon-Fri; add Saturday only if it has classes
        all_day_indices = list(range(len(const.DAYS)))
        sat_index = 5  # Saturday index
        if sat_index in days_in_solution and sat_index not in all_day_indices:
            all_day_indices.append(sat_index)

        # Day name lookup including Saturday
        all_day_names = list(const.DAYS) + (['SAT'] if len(const.DAYS) <= 5 else [])

        total_days = len(all_day_indices)

        for row_num, day_idx in enumerate(all_day_indices):
            day_name = all_day_names[day_idx] if day_idx < len(all_day_names) else f'Day{day_idx}'
            html += f'<tr><td class="dh">{day_name}</td>'
            period_counter = 0
            for header_text in const.TIMETABLE_HEADERS:
                is_break = (header_text == "10:35-10:50")
                is_lunch = (header_text == "12:40-1:40")
                if is_break:
                    if row_num == 0:
                        html += f'<td rowspan="{total_days}" class="vt">Tea Break</td>'
                elif is_lunch:
                    if row_num == 0:
                        html += f'<td rowspan="{total_days}" class="vt">Lunch Break</td>'
                else:
                    entries = merged_grid[p_sec][day_idx].get(period_counter, [])
                    if entries:
                        cell = ''
                        for idx, (subj, fac) in enumerate(entries):
                            div_cls = 'multi-subj' if idx > 0 else ''
                            cell += (f'<div class="{div_cls}">'
                                     f'<div class="subj">{subj}</div>'
                                     f'<div class="fac">{fac}</div>'
                                     f'</div>')
                        html += f'<td>{cell}</td>'
                    else:
                        html += '<td></td>'
                    period_counter += 1
            html += '</tr>'
        html += '</table><br>'
        st.markdown(html, unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────
st.sidebar.title("🎓 VTU Timetable System")

# Show schedule status in sidebar
if schedule_exists():
    sched = load_schedule()
    gen_at = sched.get('generated_at', '')[:16].replace('T', ' ')
    st.sidebar.success(f"📅 Schedule active\nGenerated: {gen_at}")
else:
    st.sidebar.warning("No schedule generated yet")

page = st.sidebar.radio("Navigate", [
    "🗓️ Generate Timetable",
    "✏️ Update Timetable",
    "📊 Original vs Current",
    "📋 Change History",
    "👥 Manage Faculties",
    "📚 Manage Subjects",
    "🏛️ Manage Sections",
    "🚪 Manage Rooms",
    "🔗 Manage Allocations",
])

data = load_data()

# ═════════════════════════════════════════════════════════════════════════════
# PAGE: GENERATE TIMETABLE
# ═════════════════════════════════════════════════════════════════════════════
if page == "🗓️ Generate Timetable":
    st.header("🗓️ Generate Semester Timetable")

    if schedule_exists():
        st.warning("⚠️ A timetable is already active for this semester.")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("📄 View Current Timetable"):
                st.session_state['show_current'] = True
        with col2:
            if st.button("🔄 Generate New Timetable (replaces current)", type="secondary"):
                clear_schedule()
                clear_history()
                clear_original_schedule()
                st.rerun()

        if st.session_state.get('show_current'):
            sched = load_schedule()
            if sched:
                solution = sched['schedule']
                _, _, secs, _, _ = rebuild_objects(data)
                render_timetable_html(solution, secs)

    else:
        st.info("Generate the timetable once — it will be fixed for the semester. "
                "Use 'Update Timetable' to make changes later via prompts.")

        time_limit = st.slider("Solver time limit (seconds)", 10, 240, 120)

        st.markdown("### 📝 Add Constraints Before Generating (Optional)")
        st.caption("These rules will be baked into the timetable from the start.")

        # Constraint input area
        if 'pre_constraints' not in st.session_state:
            st.session_state['pre_constraints'] = []

        col1, col2 = st.columns([4, 1])
        with col1:
            new_prompt = st.text_input(
                "Type a constraint:",
                placeholder="e.g. Prof. Anu is not available on Friday",
                key="pre_constraint_input"
            )
        with col2:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("➕ Add") and new_prompt.strip():
                st.session_state['pre_constraints'].append(new_prompt.strip())
                st.rerun()

        # Show added constraints
        if st.session_state['pre_constraints']:
            st.markdown("**Constraints to apply:**")
            for i, c in enumerate(st.session_state['pre_constraints']):
                col1, col2 = st.columns([5, 1])
                col1.markdown(f"• {c}")
                if col2.button("❌", key=f"del_{i}"):
                    st.session_state['pre_constraints'].pop(i)
                    st.rerun()
        else:
            st.info("No constraints added — timetable will be generated with default rules only.")

        st.divider()

        if st.button("🚀 Generate Timetable", type="primary"):
            try:
                facs, subs, secs, rooms, allocs = convert_json_to_objects(data)
                tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)
                st.write(f"Scheduling {len(tasks)} tasks...")

                # Convert pre-constraints via SLM
                pre_slm_constraints = []
                if st.session_state.get('pre_constraints'):
                    with st.spinner("Converting constraints via SLM API..."):
                        from slm_inference import get_constraints_batch
                        pre_slm_constraints = get_constraints_batch(
                            st.session_state['pre_constraints'])
                    st.write(f"✅ {len(pre_slm_constraints)} constraint(s) parsed")

                solver = TimetableSolver(tasks, facs, secs, rooms)
                with st.spinner("Optimizing schedule..."):
                    status, solution = solver.solve(
                        time_limit_seconds=time_limit,
                        enable_soft_constraints=True,
                        slm_constraints=pre_slm_constraints)

                if status in ("OPTIMAL", "FEASIBLE"):
                    save_schedule(solution)
                    save_original_schedule(solution)  # permanent snapshot
                    st.success(f"✅ Timetable Generated! Status: {status}")
                    st.balloons()
                    render_timetable_html(solution, secs)
                else:
                    st.error(f"❌ Solver failed: {status}")
            except Exception as e:
                st.error(f"Error: {e}")
                import traceback; st.code(traceback.format_exc())

# ═════════════════════════════════════════════════════════════════════════════
# PAGE: UPDATE TIMETABLE
# ═════════════════════════════════════════════════════════════════════════════
elif page == "✏️ Update Timetable":
    st.header("✏️ Update Timetable with Natural Language")

    if not schedule_exists():
        st.error("❌ No timetable generated yet. Go to 'Generate Timetable' first.")
        st.stop()

    # API Health Check
    with st.spinner("Checking SLM API..."):
        api_ok = check_api_health()
    if api_ok:
        st.success("✅ SLM API is online")
    else:
        st.error("❌ SLM API is offline. Check HuggingFace Space.")
        st.stop()

    st.markdown("""
    **How it works:** Type a natural language instruction. Only the affected 
    slots will be rescheduled — the rest of the timetable stays unchanged.
    
    **Examples:**
    - `Prof. Anu is not available on Friday`
    - `NLP Lab must be in consecutive slots`  
    - `ML should be scheduled in the morning`
    - `Slot 5 is the lunch break`
    - `Limit Sanjay to 3 hours per day`
    - `Prof. Kavitha should have Wednesday free`
    """)

    st.divider()

    prompt = st.text_input("💬 Enter your instruction:",
                           placeholder="e.g. Prof. Anu is not available on Friday")

    col1, col2 = st.columns([1, 3])
    with col1:
        apply = st.button("✅ Apply Change", type="primary",
                          disabled=not prompt.strip())
    with col2:
        preview = st.button("👁️ Preview Constraint Only",
                            disabled=not prompt.strip())

    # Preview mode — just show the constraint without applying
    if preview and prompt.strip():
        from slm_inference import smart_parse
        local = smart_parse(prompt, data['faculties'],
                            data.get('subjects',[]), data.get('sections',[]))
        if local:
            st.subheader("Constraint that would be applied (local parser):")
            st.json(local)
        else:
            with st.spinner("Calling SLM API..."):
                result = get_constraint(prompt)
            if result.get('success'):
                st.subheader("Constraint that would be applied (SLM API):")
                for c in result['constraints']:
                    st.json(c)
            else:
                st.error(f"Failed to parse: {result.get('error')}")
                st.code(result.get('raw', ''))

    # Apply mode — actually update the timetable
    if apply and prompt.strip():
        from slm_inference import smart_parse

        # ── Step 1: Try smart_parse FIRST for high-confidence direct operations ──
        # These patterns are reliably detected locally without needing the SLM
        priority_keywords = [
            # Faculty operations
            'replace','substitute','take over','will take','on leave','cover',
            'permanently','change faculty','hand over','assign all',
            # Cancel / holiday
            'cancel','no class','holiday','off day',
            'no toc','no nlp','no ml','no cn','no sepm','no nosql',
            'no rmipr','no dvlab','no cnlab','no nlplab','no mllab',
            'no iks','no evs','no genai','no devops','no hcai',
            # Move / reschedule
            'move','shift','reschedule','transfer','relocate',
            # Room
            'change room','to lab','to room','assign room',
            # Extra class
            'extra class','makeup','compensatory','schedule extra',
            'add extra','add makeup','additional session','extra session',
            'extra ml','extra nlp','extra toc','extra cn','extra sepm',
            'schedule.*class','add.*class',
            # Swap / freeze
            'swap','exchange','freeze','lock slot',
            # NO_FREE_PERIOD — must be here so smart_parse runs first
            'should not be free','must not be free','cannot be free',
            'must have a class','should have a class','always occupied',
            'no free period','no free slot','must be filled',
            'first hour','first period','last period','last hour',
        ]
        use_smart_parse_first = any(kw in prompt.lower() for kw in priority_keywords)
        constraints = []

        if use_smart_parse_first:
            local = smart_parse(prompt, data['faculties'],
                                data.get('subjects',[]), data.get('sections',[]))
            if local:
                constraints = [local]
                st.info(f"🔄 Operation detected: `{local['type']}`")

        # ── Step 2: Fall back to SLM API if smart_parse couldn't handle it ──
        if not constraints:
            with st.spinner("🤖 Converting instruction to constraint..."):
                result = get_constraint(prompt)
            if not result.get('success'):
                st.error(f"❌ Could not parse instruction: {result.get('error')}")
                st.code(result.get('raw', ''))
                st.stop()
            constraints = result.get('constraints', [])
            if constraints:
                st.info(f"Parsed constraint: `{constraints[0].get('type','?')}`")

        if not constraints:
            st.error("No constraints parsed."); st.stop()

        st.info(f"Parsed constraint: `{constraints[0]['type'] if constraints else 'none'}`")

        # Load current schedule and rebuild objects
        sched = load_schedule()
        current_solution = sched['schedule']
        facs, subs, secs, rooms, allocs = rebuild_objects(data)
        tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)

        # Rebuild task objects into solution (attach task_obj)
        tasks_by_id = {t.task_id: t for t in tasks}
        for tid, info in current_solution.items():
            if tid in tasks_by_id:
                info['task_obj'] = tasks_by_id[tid]

        # Run partial optimizer for each constraint
        all_changes = []
        final_solution = current_solution

        for constraint in constraints:
            with st.spinner(f"Rescheduling tasks for: {constraint['type']}..."):
                optimizer = PartialOptimizer(
                    tasks, facs, secs, rooms, final_solution)
                status, new_solution, affected, summary = \
                    optimizer.apply_constraint_and_reoptimize(constraint)

            if status in ('OPTIMAL', 'FEASIBLE', 'NO_CHANGE'):
                final_solution = new_solution
                all_changes.append(summary)
            else:
                st.warning(f"⚠️ {summary}")

        # Save updated schedule
        save_schedule(final_solution)
        add_history_entry(
            operation_type="LLM_UPDATE",
            description=f"AI Update: {prompt}",
            affected_sections=[],
            changes=[],
            status='SUCCESS',
            constraints=constraints
        )

        # Show results
        st.success("✅ Timetable updated!")
        for change in all_changes:
            st.markdown(change)

        st.divider()

        # ── Side-by-side: Original vs Updated ────────────────────────────
        col_orig, col_new = st.columns(2)
        with col_orig:
            st.subheader("📋 Original Timetable")
            render_timetable_html(current_solution, secs)
        with col_new:
            st.subheader("📅 Updated Timetable")
            render_timetable_html(final_solution, secs)

    # ── Show current timetable below ──────────────────────────────────────
    st.divider()
    with st.expander("📄 View Current Full Timetable"):
        sched = load_schedule()
        if sched:
            _, _, secs, _, _ = rebuild_objects(data)
            render_timetable_html(sched['schedule'], secs)

# ═════════════════════════════════════════════════════════════════════════════
# PAGE: ORIGINAL VS CURRENT
# ═════════════════════════════════════════════════════════════════════════════
elif page == "📊 Original vs Current":
    st.header("📊 Original vs Current Timetable")

    if not schedule_exists():
        st.error("❌ No timetable generated yet.")
        st.stop()

    _, _, secs, _, _ = rebuild_objects(data)

    has_orig = original_schedule_exists()
    orig     = load_original_schedule() if has_orig else None
    current  = load_schedule()

    if orig:
        orig_at = orig.get('generated_at', '')[:16].replace('T', ' ')
    curr_at = current.get('generated_at', '')[:16].replace('T', ' ') if current else ''

    # Summary badge
    history = load_history()
    n_changes = len(history)
    col1, col2, col3 = st.columns(3)
    col1.metric("Original Generated", orig_at if orig else "N/A")
    col2.metric("Last Updated", curr_at)
    col3.metric("Total Changes Applied", n_changes)

    st.divider()

    if orig:
        tab1, tab2 = st.tabs(["🗂️ Original Timetable", "📅 Current Timetable"])
        with tab1:
            st.caption(f"Generated on {orig_at} — never modified")
            render_timetable_html(orig['schedule'], secs)
        with tab2:
            st.caption(f"Last updated: {curr_at} — {n_changes} change(s) applied")
            render_timetable_html(current['schedule'], secs)
    else:
        st.info("Original snapshot not available. "
                "Regenerate the timetable to create one.")
        st.subheader("Current Timetable")
        render_timetable_html(current['schedule'], secs)

# ═════════════════════════════════════════════════════════════════════════════
# PAGE: CHANGE HISTORY
# ═════════════════════════════════════════════════════════════════════════════
elif page == "📋 Change History":
    st.header("📋 Change History")

    history = load_history()
    if not history:
        st.info("No changes have been made yet.")
    else:
        st.write(f"**{len(history)} change(s) recorded**")
        for i, entry in enumerate(reversed(history)):
            ts = entry['timestamp'][:16].replace('T', ' ')
            desc = entry.get('description', entry.get('prompt', ''))
            op_type = entry.get('operation_type', 'UPDATE')
            with st.expander(f"#{len(history)-i} — {ts} — [{op_type}] {desc}"):
                st.markdown(f"**Description:** {desc}")
                st.markdown(f"**Operation:** {op_type}")
                st.markdown(f"**Status:** {entry.get('status', 'UNKNOWN')}")
                sections = entry.get('affected_sections', [])
                if sections:
                    st.markdown(f"**Affected Sections:** {', '.join(sections)}")
                changes = entry.get('changes', [])
                if changes:
                    st.subheader(f"Detailed Changes ({len(changes)} cells)")
                    for c in changes[:20]:
                        st.json(c)
                if entry.get('constraints'):
                    st.subheader("Constraint applied:")
                    st.json(entry['constraints'])

        if st.button("🗑️ Clear History"):
            clear_history()
            st.rerun()

# ═════════════════════════════════════════════════════════════════════════════
# MANAGEMENT PAGES (unchanged from original)
# ═════════════════════════════════════════════════════════════════════════════
elif page == "👥 Manage Faculties":
    st.header("Manage Faculties")
    with st.form("add_faculty"):
        col1, col2 = st.columns(2)
        f_id   = col1.text_input("ID (e.g., 'F001')")
        f_name = col2.text_input("Name")
        f_desig = col1.selectbox("Designation",
                                  ["Professor","Assoc. Prof","Asst. Prof","Guest"])
        f_max  = col2.number_input("Max Hours/Week", min_value=1, value=18)
        if st.form_submit_button("Add Faculty"):
            if f_id and f_name:
                data['faculties'].append({"id": f_id, "name": f_name,
                                          "designation": f_desig, "max_hours": f_max})
                save_data(data); st.success("Added!"); st.rerun()
            else:
                st.error("ID and Name are required.")
    if data['faculties']:
        st.dataframe(pd.DataFrame(data['faculties']))
        if st.button("Clear All Faculties"):
            data['faculties'] = []; save_data(data); st.rerun()

elif page == "📚 Manage Subjects":
    st.header("Manage Subjects")
    with st.form("add_subject"):
        col1, col2 = st.columns(2)
        s_code  = col1.text_input("Code")
        s_name  = col2.text_input("Name")
        s_type  = col1.selectbox("Type", ["THEORY","LAB","SOFTSKILL","FORUM"])
        s_cred  = col2.number_input("Credits", min_value=0, value=3)
        s_core  = col1.checkbox("Is Core?", value=True)
        s_heavy = col2.checkbox("Is Heavy?", value=False)
        if st.form_submit_button("Add Subject"):
            if s_code:
                data['subjects'].append({"code": s_code, "name": s_name,
                    "type": s_type, "credits": s_cred,
                    "is_core": s_core, "is_heavy": s_heavy})
                save_data(data); st.success("Added!"); st.rerun()
    if data['subjects']:
        st.dataframe(pd.DataFrame(data['subjects']))
        if st.button("Clear All Subjects"):
            data['subjects'] = []; save_data(data); st.rerun()

elif page == "🏛️ Manage Sections":
    st.header("Manage Sections")
    with st.form("add_section"):
        col1, col2 = st.columns(2)
        sec_id   = col1.text_input("Section ID (e.g., '6A')")
        sem      = col2.number_input("Semester", min_value=1, value=6)
        strength = col1.number_input("Student Strength", min_value=1, value=60)
        if st.form_submit_button("Add Section"):
            if sec_id:
                data['sections'].append({"id": sec_id, "semester": sem,
                                         "strength": strength})
                save_data(data); st.success("Added!"); st.rerun()
    if data['sections']:
        st.dataframe(pd.DataFrame(data['sections']))
        if st.button("Clear All Sections"):
            data['sections'] = []; save_data(data); st.rerun()

elif page == "🚪 Manage Rooms":
    st.header("Manage Rooms")
    with st.form("add_room"):
        col1, col2 = st.columns(2)
        r_id  = col1.text_input("Room ID")
        cap   = col2.number_input("Capacity", min_value=1, value=80)
        is_lab = col1.checkbox("Is Lab?", value=False)
        bld   = col2.text_input("Building", value="Main")
        if st.form_submit_button("Add Room"):
            if r_id:
                data['rooms'].append({"id": r_id, "capacity": cap,
                                      "is_lab": is_lab, "building": bld})
                save_data(data); st.success("Added!"); st.rerun()
    if data['rooms']:
        st.dataframe(pd.DataFrame(data['rooms']))
        if st.button("Clear All Rooms"):
            data['rooms'] = []; save_data(data); st.rerun()

elif page == "🔗 Manage Allocations":
    st.header("Manage Allocations")
    if not (data['faculties'] and data['subjects'] and data['sections']):
        st.warning("Add Faculties, Subjects, and Sections first.")
    else:
        fac_opts = {f['name']: f['id'] for f in data['faculties']}
        sub_opts = {s['name']: s['code'] for s in data['subjects']}
        sec_opts = [s['id'] for s in data['sections']]
        with st.form("add_alloc"):
            col1, col2 = st.columns(2)
            f   = col1.selectbox("Faculty", list(fac_opts.keys()))
            s   = col2.selectbox("Subject", list(sub_opts.keys()))
            sec = col1.selectbox("Section", sec_opts)
            grp = col2.text_input("Elective Group ID (Optional)")
            if st.form_submit_button("Add Allocation"):
                data['allocations'].append({
                    "faculty_id":    fac_opts[f],
                    "subject_code":  sub_opts[s],
                    "section_id":    sec,
                    "elective_group": grp if grp else None
                })
                save_data(data); st.success("Allocation Added!"); st.rerun()
        if data['allocations']:
            st.dataframe(pd.DataFrame(data['allocations']))
            if st.button("Clear Allocations"):
                data['allocations'] = []; save_data(data); st.rerun()