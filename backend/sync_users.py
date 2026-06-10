import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

import json
import re
from django.contrib.auth import get_user_model

User = get_user_model()

# Define hardcoded fixes for known fuzzy match collisions
fixes = {
    'surbhi@example.com': ('Prof.', 'Surbhi'),
    'sanjay@example.com': ('Prof.', 'Sanjay'),
    'oe_fac_2@example.com': ('', 'OE Teacher 2'),
    'anu@example.com': ('Dr.', 'Anu Pallavi S'),
    'adrash@example.com': ('Prof.', 'Adarsha S P'),
    'kavitha@example.com': ('Dr.', 'Kavitha Nair R'),
    'praveen@example.com': ('Prof.', 'Praveen')
}

updated_count = 0

for email, (fname, lname) in fixes.items():
    u = User.objects.filter(email=email).first()
    if u:
        u.first_name = fname
        u.last_name = lname
        u.save()
        print(f'Synchronized {email}: {fname} {lname}')
        updated_count += 1

print(f'\nTotal accounts synchronized: {updated_count}')
