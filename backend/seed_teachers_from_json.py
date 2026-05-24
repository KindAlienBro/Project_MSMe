"""
Seed script: Creates teacher accounts from timetable_data.json
- Deletes ALL existing Teacher profiles and teacher/super_teacher CustomUser accounts
- Creates a Department "CSE" if it doesn't exist
- Creates all faculty as TEACHER, except "adrash" who becomes SUPER_TEACHER
- All accounts share the same password: Teacher@123
- All accounts are set as approved and active

Run: python seed_teachers_from_json.py
"""

import os
import sys
import json
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from accounts.models import CustomUser, Teacher, Department

# --- Configuration ---
TIMETABLE_JSON_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', 'timetable_slm-main', 'timetable_data.json'
)
COMMON_PASSWORD = 'Teacher@123'
DEPARTMENT_NAME = 'CSE'
SUPER_TEACHER_ID = 'adrash'

# Designation mapping from JSON to model choices
DESIGNATION_MAP = {
    'Assoc. Prof': 'ASSOCIATE_PROFESSOR',
    'Asst. Prof': 'ASSISTANT_PROFESSOR',
    'Prof': 'PROFESSOR',
    # Fallback for Trainer, Guest, etc.
}
DEFAULT_DESIGNATION = 'ASSISTANT_PROFESSOR'


def run():
    # Load JSON data
    with open(TIMETABLE_JSON_PATH, 'r') as f:
        data = json.load(f)

    faculties = data['faculties']

    # Step 1: Delete existing Teacher profiles and teacher/super_teacher users
    print("=" * 60)
    print("STEP 1: Cleaning up existing teacher accounts...")
    teacher_count = Teacher.objects.count()
    Teacher.objects.all().delete()
    print(f"  Deleted {teacher_count} Teacher profiles.")

    user_count = CustomUser.objects.filter(
        role__in=['TEACHER', 'SUPER_TEACHER']
    ).count()
    CustomUser.objects.filter(role__in=['TEACHER', 'SUPER_TEACHER']).delete()
    print(f"  Deleted {user_count} Teacher/Super Teacher user accounts.")

    # Step 2: Ensure department exists
    dept, created = Department.objects.get_or_create(dept_name=DEPARTMENT_NAME)
    print(f"\n{'Created' if created else 'Found existing'} department: {dept.dept_name}")

    # Step 3: Create teacher accounts
    print(f"\nSTEP 2: Creating {len(faculties)} teacher accounts...")
    print("-" * 60)

    created_accounts = []

    for fac in faculties:
        fac_id = fac['id']
        name = fac['name']
        designation_raw = fac.get('designation', '')
        max_hours = fac.get('max_hours', 18)

        # Parse first and last name from display name
        # Remove prefixes and split
        clean_name = name.replace('Prof. ', '').replace('Dr. ', '').replace('Mr. ', '').replace('Ms. ', '')
        name_parts = clean_name.strip().split()
        first_name = name_parts[0] if name_parts else fac_id.capitalize()
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        # Generate email from faculty ID
        email = f"{fac_id}@college.edu"

        # Determine role
        if fac_id == SUPER_TEACHER_ID:
            role = 'SUPER_TEACHER'
        else:
            role = 'TEACHER'

        # Map designation
        designation = DESIGNATION_MAP.get(designation_raw, DEFAULT_DESIGNATION)

        # Create user
        user = CustomUser.objects.create_user(
            email=email,
            password=COMMON_PASSWORD,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_approved=True,
            is_active=True,
        )

        # Create Teacher profile
        Teacher.objects.create(
            user=user,
            dept=dept,
            designation=designation,
            max_load_per_week=max_hours,
        )

        role_label = "⭐ SUPER TEACHER" if role == 'SUPER_TEACHER' else "   TEACHER"
        created_accounts.append({
            'name': f"{first_name} {last_name}".strip(),
            'email': email,
            'role': role_label,
            'designation': designation,
        })
        print(f"  ✓ {role_label} | {first_name} {last_name} | {email}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total accounts created: {len(created_accounts)}")
    print(f"  Department:             {DEPARTMENT_NAME}")
    print(f"  Password (all):         {COMMON_PASSWORD}")
    print(f"  Super Teacher:          {SUPER_TEACHER_ID}@college.edu")
    print("=" * 60)


if __name__ == '__main__':
    run()
