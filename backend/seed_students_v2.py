"""
Seed script — 20 realistic Indian student accounts across sections.
Updates existing students to add section info too.

Usage:
    cd backend
    .\\env\\Scripts\\activate
    python seed_students_v2.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import Student, Department

User = get_user_model()

# ──────────────────────────────────────────────────────
# Ensure department exists
# ──────────────────────────────────────────────────────
dept_cse, _ = Department.objects.get_or_create(dept_name='CSE')
dept_ise, _ = Department.objects.get_or_create(dept_name='ISE')

DEFAULT_PASSWORD = "Student@123"

# ──────────────────────────────────────────────────────
# Update existing 8 students with section info
# ──────────────────────────────────────────────────────
EXISTING_UPDATES = [
    {"email": "student.sem1@msme.com", "section": "CSE-1A"},
    {"email": "student.sem2@msme.com", "section": "CSE-1B"},
    {"email": "student.sem3@msme.com", "section": "CSE-3A"},
    {"email": "student.sem4@msme.com", "section": "CSE-3B"},
    {"email": "student.sem5@msme.com", "section": "CSE-5A"},
    {"email": "student.sem6@msme.com", "section": "CSE-5B"},
    {"email": "student.sem7@msme.com", "section": "CSE-7A"},
    {"email": "student.sem8@msme.com", "section": "CSE-7B"},
]

for u in EXISTING_UPDATES:
    try:
        user = User.objects.get(email=u["email"])
        profile = user.student
        profile.section = u["section"]
        profile.save()
        print(f"  [UPDATE] {user.email} -> section={u['section']}")
    except Exception as e:
        print(f"  [SKIP] {u['email']}: {e}")

# ──────────────────────────────────────────────────────
# New students
# ──────────────────────────────────────────────────────
NEW_STUDENTS = [
    # CSE-3A — 6 students
    {"email": "cse3a.001@msme.com", "first_name": "Aditya",   "last_name": "Kapoor",    "semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS001", "dept": dept_cse},
    {"email": "cse3a.002@msme.com", "first_name": "Meera",    "last_name": "Iyer",      "semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS002", "dept": dept_cse},
    {"email": "cse3a.003@msme.com", "first_name": "Karthik",  "last_name": "Nair",      "semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS003", "dept": dept_cse},
    {"email": "cse3a.004@msme.com", "first_name": "Priya",    "last_name": "Menon",     "semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS004", "dept": dept_cse},
    {"email": "cse3a.005@msme.com", "first_name": "Rahul",    "last_name": "Srivastava","semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS005", "dept": dept_cse},
    {"email": "cse3a.006@msme.com", "first_name": "Shreya",   "last_name": "Bose",      "semester": 3, "year": 2, "section": "CSE-3A", "reg": "1RV22CS006", "dept": dept_cse},

    # CSE-3B — 5 students
    {"email": "cse3b.001@msme.com", "first_name": "Naveen",   "last_name": "Kumar",     "semester": 3, "year": 2, "section": "CSE-3B", "reg": "1RV22CS051", "dept": dept_cse},
    {"email": "cse3b.002@msme.com", "first_name": "Divya",    "last_name": "Krishnan",  "semester": 3, "year": 2, "section": "CSE-3B", "reg": "1RV22CS052", "dept": dept_cse},
    {"email": "cse3b.003@msme.com", "first_name": "Arnav",    "last_name": "Joshi",     "semester": 3, "year": 2, "section": "CSE-3B", "reg": "1RV22CS053", "dept": dept_cse},
    {"email": "cse3b.004@msme.com", "first_name": "Tanvi",    "last_name": "Shah",      "semester": 3, "year": 2, "section": "CSE-3B", "reg": "1RV22CS054", "dept": dept_cse},
    {"email": "cse3b.005@msme.com", "first_name": "Yash",     "last_name": "Mehta",     "semester": 3, "year": 2, "section": "CSE-3B", "reg": "1RV22CS055", "dept": dept_cse},

    # CSE-5A — 5 students
    {"email": "cse5a.001@msme.com", "first_name": "Siddharth","last_name": "Rao",       "semester": 5, "year": 3, "section": "CSE-5A", "reg": "1RV21CS001", "dept": dept_cse},
    {"email": "cse5a.002@msme.com", "first_name": "Ananya",   "last_name": "Pillai",    "semester": 5, "year": 3, "section": "CSE-5A", "reg": "1RV21CS002", "dept": dept_cse},
    {"email": "cse5a.003@msme.com", "first_name": "Varun",    "last_name": "Malhotra",  "semester": 5, "year": 3, "section": "CSE-5A", "reg": "1RV21CS003", "dept": dept_cse},
    {"email": "cse5a.004@msme.com", "first_name": "Riya",     "last_name": "Desai",     "semester": 5, "year": 3, "section": "CSE-5A", "reg": "1RV21CS004", "dept": dept_cse},

    # ISE-3A — 4 students
    {"email": "ise3a.001@msme.com", "first_name": "Aniket",   "last_name": "Patil",     "semester": 3, "year": 2, "section": "ISE-3A", "reg": "1RV22IS001", "dept": dept_ise},
    {"email": "ise3a.002@msme.com", "first_name": "Swathi",   "last_name": "Gowda",     "semester": 3, "year": 2, "section": "ISE-3A", "reg": "1RV22IS002", "dept": dept_ise},
    {"email": "ise3a.003@msme.com", "first_name": "Manoj",    "last_name": "Hegde",     "semester": 3, "year": 2, "section": "ISE-3A", "reg": "1RV22IS003", "dept": dept_ise},
    {"email": "ise3a.004@msme.com", "first_name": "Lakshmi",  "last_name": "Rao",       "semester": 3, "year": 2, "section": "ISE-3A", "reg": "1RV22IS004", "dept": dept_ise},
    {"email": "ise3a.005@msme.com", "first_name": "Akash",    "last_name": "Sharma",    "semester": 3, "year": 2, "section": "ISE-3A", "reg": "1RV22IS005", "dept": dept_ise},
]

created_count   = 0
skipped_count   = 0
new_credentials = []

for s in NEW_STUDENTS:
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
            dept=s["dept"],
            semester=s["semester"],
            year=s["year"],
            section=s["section"],
            register_number=s["reg"],
        )
        print(f"  [OK] {user.get_full_name()} | {s['section']} | {s['email']}")
        created_count += 1
        new_credentials.append({
            "name": user.get_full_name(),
            "email": s["email"],
            "semester": s["semester"],
            "section": s["section"],
            "reg": s["reg"],
            "dept": s["dept"].dept_name,
        })

print(f"\nDone. Created={created_count}, Skipped={skipped_count}")
print(f"Password for all accounts: {DEFAULT_PASSWORD}\n")

# ──────────────────────────────────────────────────────
# Write updated credentials file
# ──────────────────────────────────────────────────────
import os as _os

CRED_PATH = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'student_credentials.txt')

lines = []
lines.append("=" * 70)
lines.append("  STUDENT DUMMY ACCOUNTS — Login Credentials")
lines.append("=" * 70)
lines.append("")
lines.append(f"Default password for all accounts: {DEFAULT_PASSWORD}")
lines.append("")
lines.append("── ORIGINAL ACCOUNTS (section updated) ──────────────────────────────")
lines.append("")

ORIGINAL = [
    ("Aarav Sharma",  "student.sem1@msme.com", 1, "CSE-1A"),
    ("Diya Patel",    "student.sem2@msme.com", 2, "CSE-1B"),
    ("Vivaan Singh",  "student.sem3@msme.com", 3, "CSE-3A"),
    ("Ananya Reddy",  "student.sem4@msme.com", 4, "CSE-3B"),
    ("Arjun Kumar",   "student.sem5@msme.com", 5, "CSE-5A"),
    ("Ishita Gupta",  "student.sem6@msme.com", 6, "CSE-5B"),
    ("Rohan Verma",   "student.sem7@msme.com", 7, "CSE-7A"),
    ("Priya Nair",    "student.sem8@msme.com", 8, "CSE-7B"),
]
lines.append(f"{'#':<4} {'Name':<20} {'Email':<35} {'Sem':<5} {'Section':<12} {'Password'}")
lines.append("-" * 90)
for i, (name, email, sem, sec) in enumerate(ORIGINAL, 1):
    lines.append(f"{i:<4} {name:<20} {email:<35} {sem:<5} {sec:<12} {DEFAULT_PASSWORD}")

lines.append("")
lines.append("── NEW ACCOUNTS (20 students across sections) ───────────────────────")
lines.append("")
lines.append(f"{'#':<4} {'Name':<22} {'Email':<32} {'Dept':<6} {'Section':<10} {'Sem':<5} {'Reg No':<16} {'Password'}")
lines.append("-" * 105)

if new_credentials:
    for i, s in enumerate(new_credentials, 1):
        lines.append(f"{i:<4} {s['name']:<22} {s['email']:<32} {s['dept']:<6} {s['section']:<10} {s['semester']:<5} {s['reg']:<16} {DEFAULT_PASSWORD}")
else:
    # If all skipped, still list them
    for i, s in enumerate(NEW_STUDENTS, 1):
        name = f"{s['first_name']} {s['last_name']}"
        lines.append(f"{i:<4} {name:<22} {s['email']:<32} {s['dept'].dept_name:<6} {s['section']:<10} {s['semester']:<5} {s['reg']:<16} {DEFAULT_PASSWORD}")

lines.append("")
lines.append("Notes:")
lines.append("- All students are auto-approved and can log in immediately.")
lines.append("- Section field matches timetable section IDs (e.g., CSE-3A).")
lines.append("- Teachers mark attendance per section; students see their own stats.")
lines.append("")

with open(CRED_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"Credentials file updated: {_os.path.abspath(CRED_PATH)}")
