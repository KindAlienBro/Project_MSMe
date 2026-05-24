import os
import json
from django.core.management.base import BaseCommand
from accounts.models import CustomUser, Teacher, Department

class Command(BaseCommand):
    help = 'Seeds teacher accounts from timetable_data.json and sets "adrash" as Super Teacher.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting to seed teachers...")
        
        # Resolve the json file path (two levels up from base dir, into timetable_slm-main)
        from django.conf import settings
        json_path = os.path.join(settings.BASE_DIR, '..', 'timetable_slm-main', 'timetable_data.json')
        
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error loading JSON file: {e}"))
            return

        # 1. Delete existing teachers
        Teacher.objects.all().delete()
        # Delete only users who are TEACHER or SUPER_TEACHER
        CustomUser.objects.filter(role__in=['TEACHER', 'SUPER_TEACHER']).delete()
        self.stdout.write(self.style.SUCCESS("Deleted all existing teacher accounts."))

        # 2. Ensure a default Department exists
        dept, created = Department.objects.get_or_create(dept_name="Computer Science")
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created default department: {dept.dept_name}"))

        # 3. Create teachers from JSON
        created_count = 0
        for index, fac in enumerate(data.get('faculties', [])):
            # Fallback email structure based on ID
            email = f"{fac['id']}@example.com"
            password = "password123" # Shared password as requested
            
            # Split name (e.g., "Prof. Anu" -> First: "Prof.", Last: "Anu")
            name_parts = fac['name'].split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Check if Admin (from prompt: adrash sir as super teacher)
            if fac['id'].lower() == 'adrash':
                role = CustomUser.Role.SUPER_TEACHER
            else:
                role = CustomUser.Role.TEACHER

            # Map designation
            # The JSON uses abbreviated designations ("Assoc. Prof", "Asst. Prof", etc.)
            designation = Teacher.Designation.ASSISTANT_PROFESSOR # Default
            if "Professor" in fac['designation']:
                designation = Teacher.Designation.PROFESSOR
            elif "Assoc" in fac['designation']:
                designation = Teacher.Designation.ASSOCIATE_PROFESSOR

            try:
                # Create User
                user = CustomUser.objects.create_user(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    is_active=True,
                    is_approved=True 
                )

                # Create Teacher Profile
                Teacher.objects.create(
                    user=user,
                    dept=dept,
                    phone=f"9999999{index:03d}",  # Dummy phone number
                    biometric_id=f"BIO{index:03d}",
                    max_load_per_week=fac['max_hours'],
                    designation=designation
                )
                self.stdout.write(f"Created: {fac['name']} ({email}) - {role}")
                created_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error creating user {fac['name']}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Seeding complete! Successfully created {created_count} teachers."))
        self.stdout.write(self.style.SUCCESS("All users have the password: password123"))
