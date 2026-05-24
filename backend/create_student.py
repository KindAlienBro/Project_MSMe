import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# Create student credentials
email = "student@msme.com"
password = "password123"

try:
    user = User.objects.get(email=email)
    print(f"Student user already exists: {email}")
except User.DoesNotExist:
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name="Jane",
        last_name="Doe",
        role="STUDENT",
        is_approved=True  # Important: ensure they can log in
    )
    print(f"✅ Created student user! \nEmail: {email}\nPassword: {password}")
