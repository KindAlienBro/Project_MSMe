import pandas as pd
import numpy as np

file_path = r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_template (1).xlsx'
out_path = r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_template_updated.xlsx'

mapping = {
    'BAI701': 'DL&RL',
    'BAI701L': 'DL&RL Lab',
    'BAI702': 'ML II',
    'BAI702L': 'ML II Lab',
    'BAD703': 'DS&P',
    'BAD714B': 'BA',
    'BCS714D': 'BDA',
    'Bxx755x': 'OE (Sem 7)',
    'BAI786': 'MP Phase-II (BAI)',
    'BDS701': 'PP',
    'BDS701L': 'PP Lab',
    'BAD702': 'SML for DS',
    'BAD702L': 'SML for DS Lab',
    'BCS703': 'CNS',
    'BCS714A': 'DL',
    'BCD786': 'MP Phase-II (BCD)',
    'BCS501': 'SEPM',
    'BCS502': 'CN',
    'BCS502L': 'CN Lab',
    'BCS503': 'TOC',
    'BAIL504': 'DV Lab',
    'BAI586': 'Mini Project (BAI)',
    'BRMK557': 'RM&IPR',
    'BCS508': 'EVS',
    'BAI515A': 'CV',
    'BAI515E': 'EDA',
    'BCD586': 'Mini Project (BCD)',
    'BCD515C': 'NoSQL DB',
    'BAD515B': 'DW',
    'BCS301': 'Maths for CS',
    'BCS302': 'DDCO',
    'BCS302L': 'DDCO Lab',
    'BCS303': 'OS',
    'BCS304': 'DSA',
    'BCSL305': 'DSA Lab',
    'BCS306A': 'OOP with Java',
    'BCS358C': 'PM with Git',
    'nss': 'NSS',
    'LIB_HR': 'Library',
    'STU_HR': 'Student Hr',
    'FAC_HR': 'Faculty Hr',
    'STDY_HR': 'Study Hr',
    'softskill': 'Soft Skills',
    'forum': 'Forum'
}

xls = pd.ExcelFile(file_path)
sheets = {sheet: xls.parse(sheet) for sheet in xls.sheet_names}

# Update Subjects
if 'Subjects' in sheets:
    df_sub = sheets['Subjects']
    if 'code' in df_sub.columns:
        df_sub['code'] = df_sub['code'].apply(lambda x: mapping.get(str(x), x))
        
# Update Allocations
if 'Allocations' in sheets:
    df_alloc = sheets['Allocations']
    if 'subject_code' in df_alloc.columns:
        df_alloc['subject_code'] = df_alloc['subject_code'].apply(lambda x: mapping.get(str(x), x))

# Update Scheduling Rules
if 'Scheduling Rules' in sheets:
    df_rules = sheets['Scheduling Rules']
    if 'subject_codes' in df_rules.columns:
        def replace_multiple(val):
            if pd.isna(val):
                return val
            parts = str(val).split(',')
            new_parts = [mapping.get(p.strip(), p.strip()) for p in parts]
            return ','.join(new_parts)
        df_rules['subject_codes'] = df_rules['subject_codes'].apply(replace_multiple)

# Write back
with pd.ExcelWriter(out_path, engine='openpyxl') as writer:
    for sheet_name, df in sheets.items():
        df.to_excel(writer, sheet_name=sheet_name, index=False)

print("Excel file updated successfully.")
