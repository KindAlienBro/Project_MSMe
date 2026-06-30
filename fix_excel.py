import pandas as pd
import numpy as np

file_path = r'c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\timetable_template.xlsx'

# Read all sheets
xls = pd.ExcelFile(file_path)
sheets = {sheet: xls.parse(sheet) for sheet in xls.sheet_names}

if 'Allocations' in sheets:
    df = sheets['Allocations']
    
    # 1. Fix the faculty assigned to DV Lab for 5A-B1
    # It was AI00755, should be AI01204 (Abhijith S)
    mask_dv_5a_b1 = (df['section_id'] == '5A-B1') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5a_b1, 'faculty_id'] = 'AI01204'

    # 2. Add elective_group for 5A labs
    mask_cn_5a_b1 = (df['section_id'] == '5A-B1') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5a_b1, 'elective_group'] = 'lab_pair_5A_1'
    
    mask_dv_5a_b2 = (df['section_id'] == '5A-B2') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5a_b2, 'elective_group'] = 'lab_pair_5A_1'
    
    mask_cn_5a_b2 = (df['section_id'] == '5A-B2') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5a_b2, 'elective_group'] = 'lab_pair_5A_2'
    
    mask_dv_5a_b1 = (df['section_id'] == '5A-B1') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5a_b1, 'elective_group'] = 'lab_pair_5A_2'

    # 3. Add elective_group for 5B labs
    mask_cn_5b_b1 = (df['section_id'] == '5B-B1') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5b_b1, 'elective_group'] = 'lab_pair_5B_1'
    
    mask_dv_5b_b2 = (df['section_id'] == '5B-B2') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5b_b2, 'elective_group'] = 'lab_pair_5B_1'
    
    mask_cn_5b_b2 = (df['section_id'] == '5B-B2') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5b_b2, 'elective_group'] = 'lab_pair_5B_2'
    
    mask_dv_5b_b1 = (df['section_id'] == '5B-B1') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5b_b1, 'elective_group'] = 'lab_pair_5B_2'

    # 4. Add elective_group for 5DS labs
    mask_cn_5ds_b1 = (df['section_id'] == '5DS-B1') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5ds_b1, 'elective_group'] = 'lab_pair_5DS_1'
    
    mask_dv_5ds_b2 = (df['section_id'] == '5DS-B2') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5ds_b2, 'elective_group'] = 'lab_pair_5DS_1'
    
    mask_cn_5ds_b2 = (df['section_id'] == '5DS-B2') & (df['subject_code'] == 'CN Lab')
    df.loc[mask_cn_5ds_b2, 'elective_group'] = 'lab_pair_5DS_2'
    
    mask_dv_5ds_b1 = (df['section_id'] == '5DS-B1') & (df['subject_code'] == 'DV Lab')
    df.loc[mask_dv_5ds_b1, 'elective_group'] = 'lab_pair_5DS_2'

    sheets['Allocations'] = df

# Write back
with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
    for sheet_name, df_sheet in sheets.items():
        df_sheet.to_excel(writer, sheet_name=sheet_name, index=False)

print("Excel file fixed successfully.")
