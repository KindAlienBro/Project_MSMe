# -*- coding: utf-8 -*-
"""
Script to extract and format teacher credentials into a readable text file.
"""
import sys, io
import os
import django

# Force UTF-8 on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

CRED_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'teacher_credentials.txt')

teachers = User.objects.filter(role__in=['TEACHER', 'SUPER_TEACHER', 'ADMIN']).order_by('role', 'first_name', 'last_name')

lines = []
div1 = "=" * 90
div2 = "-" * 90

lines.append(div1)
lines.append("  TEACHER & ADMIN ACCOUNTS -- Login Credentials")
lines.append(div1)
lines.append("")
lines.append("  Default password for seeded accounts: password123")
lines.append("")
lines.append(f"  {'#':<4} {'Name':<25} {'Email':<35} {'Role':<15} {'Password (Default)'}")
lines.append(f"  {'-'*4} {'-'*25} {'-'*35} {'-'*15} {'-'*18}")

for i, u in enumerate(teachers, 1):
    role_display = u.get_role_display() if hasattr(u, 'get_role_display') else u.role
    lines.append(f"  {i:<4} {u.get_full_name():<25} {u.email:<35} {role_display:<15} password123")

lines.append("")
lines.append(div2)
lines.append("Notes:")
lines.append("  - SUPER_TEACHER / ADMIN can visually edit the timetable, compare histories, and mark anyone's attendance.")
lines.append("  - Regular TEACHER can only mark attendance for their assigned classes.")
lines.append("")

with open(CRED_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"\n[DONE] Teacher credentials written to: {os.path.abspath(CRED_PATH)}")
