"""
Seed script to create 8 dummy student accounts (1 per semester).
Run: python seed_students.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import Student, Department

User = get_user_model()

# Get the first available department (or create a default one)
dept = Department.objects.first()
if not dept:
    dept = Department.objects.create(dept_name='CSE')
    print(f"[INFO] Created default department: {dept.dept_name}")

STUDENTS = [
    {"email": "student.sem1@msme.com", "first_name": "Aarav",   "last_name": "Sharma",   "semester": 1, "year": 1},
    {"email": "student.sem2@msme.com", "first_name": "Diya",    "last_name": "Patel",    "semester": 2, "year": 1},
    {"email": "student.sem3@msme.com", "first_name": "Vivaan",  "last_name": "Singh",    "semester": 3, "year": 2},
    {"email": "student.sem4@msme.com", "first_name": "Ananya",  "last_name": "Reddy",    "semester": 4, "year": 2},
    {"email": "student.sem5@msme.com", "first_name": "Arjun",   "last_name": "Kumar",    "semester": 5, "year": 3},
    {"email": "student.sem6@msme.com", "first_name": "Ishita",  "last_name": "Gupta",    "semester": 6, "year": 3},
    {"email": "student.sem7@msme.com", "first_name": "Rohan",   "last_name": "Verma",    "semester": 7, "year": 4},
    {"email": "student.sem8@msme.com", "first_name": "Priya",   "last_name": "Nair",     "semester": 8, "year": 4},
]

DEFAULT_PASSWORD = "Student@123"

created_count = 0
skipped_count = 0

for s in STUDENTS:
    try:
        user = User.objects.get(email=s["email"])
        print(f"  [SKIP] Already exists: {s['email']}")
        skipped_count += 1
    except User.DoesNotExist:
        user = User.objects.create_user(
            email=s["email"],
            password=DEFAULT_PASSWORD,
            first_name=s["first_name"],
            last_name=s["last_name"],
            role="STUDENT",
            is_approved=True,
        )
        Student.objects.create(
            user=user,
            dept=dept,
            semester=s["semester"],
            year=s["year"],
        )
        print(f"  [OK] Created: {s['email']} (Sem {s['semester']}, Year {s['year']})")
        created_count += 1

print(f"\nDone! Created: {created_count}, Skipped: {skipped_count}")
print(f"Department: {dept.dept_name}")
print(f"Password for all accounts: {DEFAULT_PASSWORD}")
