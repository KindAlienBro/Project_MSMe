# -*- coding: utf-8 -*-
"""
Seed script v3 - AIML Department, all semesters, min 15 students per section.

Structure:
  AIML-1A  (Sem 1, Year 1) - 15 students
  AIML-2A  (Sem 2, Year 1) - 15 students
  AIML-3A  (Sem 3, Year 2) - 15 students
  AIML-4A  (Sem 4, Year 2) - 15 students
  AIML-5A  (Sem 5, Year 3) - 15 students
  AIML-6A  (Sem 6, Year 3) - 15 students
  AIML-7A  (Sem 7, Year 4) - 15 students
  AIML-8A  (Sem 8, Year 4) - 15 students
  Total = 120 students

Usage:
    cd backend
    .\\env\\Scripts\\activate
    python seed_aiml_students.py
"""
import sys, io
# Force UTF-8 on Windows console so print() doesn't break
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import Student, Department
import random

User = get_user_model()
DEFAULT_PASSWORD = "Student@123"

# ── Ensure AIML department ─────────────────────────────────────────
dept_aiml, _ = Department.objects.get_or_create(dept_name='AIML')
print(f"[DEPT] AIML dept id={dept_aiml.pk}")

# ── Section -> (semester, year) mapping ───────────────────────────
SECTION_META = {
    'AIML-1A': (1, 1),
    'AIML-1B': (1, 1),
    'AIML-2A': (2, 1),
    'AIML-2B': (2, 1),
    'AIML-3A': (3, 2),
    'AIML-3B': (3, 2),
    'AIML-4A': (4, 2),
    'AIML-4B': (4, 2),
    'AIML-5A': (5, 3),
    'AIML-5B': (5, 3),
    'AIML-6A': (6, 3),
    'AIML-6B': (6, 3),
    'AIML-7A': (7, 4),
    'AIML-7B': (7, 4),
    'AIML-8A': (8, 4),
    'AIML-8B': (8, 4),
}
SECTIONS = list(SECTION_META.keys())

# ── Realistic Indian names ─────────────────────────────────────────
FIRST_NAMES = [
    'Aarav','Aditya','Akash','Ananya','Aniket','Anjali','Arnav','Arjun',
    'Aryan','Bhavya','Chetan','Deepak','Divya','Diya','Farhan','Gaurav',
    'Harini','Ishaan','Ishita','Jatin','Jayesh','Karishma','Karthik',
    'Kavya','Kishan','Kritika','Lakshmi','Lavanya','Manoj','Mansi',
    'Meera','Meet','Mihir','Mitali','Mohit','Nakul','Namrata','Naveen',
    'Neha','Nikhil','Nisha','Nishant','Pallavi','Parth','Pooja','Pranav',
    'Priya','Radhika','Rahul','Rajesh','Ramya','Ranya','Ravi','Riya',
    'Rohan','Rohit','Sachin','Samarth','Sandhya','Sanjay','Sarika',
    'Saurabh','Shivam','Shreya','Shreyansh','Shubham','Siddharth','Simran',
    'Smita','Sneha','Soham','Sumedh','Supriya','Swathi','Tanvi','Tejas',
    'Tulsi','Uday','Urvashi','Vaibhav','Varun','Vedant','Vibha','Vikram',
    'Vineeta','Vishal','Vivaan','Yash','Yashika','Yogesh','Zara','Zubin',
    'Abhishek','Amrita','Bharat','Chetna','Dhruv','Ekta','Gandharv',
    'Hemant','Ipshita','Jyoti','Kunal','Maitri','Naman','Ojasvi','Payal',
]

LAST_NAMES = [
    'Agarwal','Bhat','Bose','Chandra','Chauhan','Chopra','Desai','Deshpande',
    'Dubey','Gandhi','Ghosh','Gowda','Gupta','Hegde','Iyer','Jha','Joshi',
    'Kapoor','Kaur','Khanna','Krishnan','Kumar','Mahajan','Malhotra','Mehta',
    'Menon','Mishra','Modi','Mukherjee','Nair','Naik','Patil','Pillai',
    'Qureshi','Rao','Reddy','Roy','Saxena','Shah','Sharma','Shinde',
    'Singh','Sinha','Srivastava','Subramanian','Tiwari','Trivedi','Varma','Verma',
    'Yadav','Bhatt','Choudhary','Das','Jain','Kulkarni','Lal','Pandey',
]

random.seed(42)

def pick_name(used: set):
    for _ in range(1000):
        f = random.choice(FIRST_NAMES)
        l = random.choice(LAST_NAMES)
        if (f, l) not in used:
            used.add((f, l))
            return f, l
    # Fallback: add a counter suffix to last name
    f = random.choice(FIRST_NAMES)
    l = random.choice(LAST_NAMES) + str(random.randint(10, 99))
    used.add((f, l))
    return f, l

# ── Step 1: Cleanup all existing students ────────────────────────
print("\n[CLEANUP] Deleting all existing student accounts...")
User.objects.filter(role='STUDENT').delete()

MIN_PER_SECTION = 15
used_names: set = set()

print("\n[CREATE] Generating 15 fresh students per section ...")
created_count = 0

for sec in SECTIONS:
    sem, yr = SECTION_META[sec]
    # 2026 batch = Year 1, 2025 = Year 2, …
    yr_code = str(26 - (yr - 1)).zfill(2)
    sec_tag = sec.replace('AIML-', '')   # e.g. "3A", "3B"

    for i in range(MIN_PER_SECTION):
        first, last = pick_name(used_names)
        slot = i + 1
        reg_num = f"1RV{yr_code}AI{sec_tag}{slot:03d}"
        email   = f"aiml{sem}{sec_tag.lower()}{slot:03d}.{last.lower()}@msme.com"

        # Just in case of extreme coincidence
        attempt = 0
        while True:
            try:
                User.objects.get(email=email)
                attempt += 1
                email = f"aiml{sem}{sec_tag.lower()}{slot:03d}.{last.lower()}{attempt}@msme.com"
            except User.DoesNotExist:
                break

        student_user = User.objects.create_user(
            email=email,
            password=DEFAULT_PASSWORD,
            first_name=first,
            last_name=last,
            role='STUDENT',
            is_approved=True,
        )
        Student.objects.create(
            user=student_user,
            dept=dept_aiml,
            semester=sem,
            year=yr,
            section=sec,
            register_number=reg_num,
        )
        created_count += 1
        print(f"  [OK] {student_user.get_full_name()} | {sec} | {email}")

print(f"\n  Created {created_count} new students.")

# ── Step 4: Write credentials file ────────────────────────────────
CRED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'student_credentials.txt')

lines = []
div1 = "=" * 82
div2 = "-" * 82

lines.append(div1)
lines.append("  STUDENT ACCOUNTS -- Login Credentials   (AIML Department)")
lines.append(div1)
lines.append("")
lines.append(f"  Default password for ALL accounts: {DEFAULT_PASSWORD}")
lines.append(f"  Department: AIML (Artificial Intelligence & Machine Learning)")
lines.append("")

for sec in SECTIONS:
    sem, yr = SECTION_META[sec]
    students_in_sec = (
        User.objects.filter(role='STUDENT', is_approved=True, student__section=sec)
        .select_related('student')
        .order_by('first_name', 'last_name')
    )

    lines.append(div2)
    lines.append(f"  Section: {sec}   |   Semester: {sem}   |   Year: {yr}")
    lines.append(div2)
    lines.append(f"  {'#':<4} {'Name':<25} {'Email':<40} {'Reg No':<18} Password")
    lines.append(f"  {'-'*4} {'-'*25} {'-'*40} {'-'*18} {'-'*12}")

    for i, u in enumerate(students_in_sec, 1):
        profile = getattr(u, 'student', None)
        reg = profile.register_number if (profile and profile.register_number) else 'N/A'
        lines.append(f"  {i:<4} {u.get_full_name():<25} {u.email:<40} {reg:<18} {DEFAULT_PASSWORD}")
    lines.append("")

lines.append(div2)
lines.append("Notes:")
lines.append("  - All students are auto-approved and can log in immediately.")
lines.append("  - Section matches timetable section IDs (e.g., AIML-3A).")
lines.append("  - Attendance page: /dashboard/attendance (students only).")
lines.append("  - Teachers mark attendance per section; students see their own stats.")
lines.append("")

with open(CRED_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"\n[DONE] Credentials file written: {os.path.abspath(CRED_PATH)}")

# ── Final summary ──────────────────────────────────────────────────
print("\n[SUMMARY] Final count:")
total = 0
for sec in SECTIONS:
    sem, yr = SECTION_META[sec]
    cnt = User.objects.filter(role='STUDENT', is_approved=True, student__section=sec).count()
    total += cnt
    flag = "OK" if cnt >= MIN_PER_SECTION else "LOW"
    print(f"  [{flag}] {sec} (Sem {sem}): {cnt} students")

grand = User.objects.filter(role='STUDENT', is_approved=True).count()
print(f"\n  Total AIML students in DB: {grand}")
