import json
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import CustomUser, Teacher, Department

def seed_teachers():
    print("Seeding teachers...")
    
    # Load JSON data
    json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'timetable_slm-main', 'timetable_data.json')
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return

    # 1. Delete existing teachers
    Teacher.objects.all().delete()
    CustomUser.objects.filter(role__in=['TEACHER', 'SUPER_TEACHER']).delete()
    print("Deleted all existing teacher accounts.")

    # 2. Ensure a default Department exists
    dept, created = Department.objects.get_or_create(dept_name="Computer Science")
    if created:
        print(f"Created default department: {dept.dept_name}")

    # 3. Create teachers from JSON
    for index, fac in enumerate(data.get('faculties', [])):
        email = f"{fac['id']}@example.com"
        password = "password123" 
        
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
        if fac['designation'].strip() == "Professor":
            designation = Teacher.Designation.PROFESSOR
        elif fac['designation'].strip() == "Assoc. Prof":
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
            teacher_profile = Teacher.objects.create(
                user=user,
                dept=dept,
                phone=f"9999999{index:03d}",  # Dummy phone number
                biometric_id=f"BIO{index:03d}",
                max_load_per_week=fac['max_hours'],
                designation=designation
            )
            print(f"Successfully created: {fac['name']} ({email}) - {role}")
        except Exception as e:
            print(f"Error creating user {fac['name']}: {e}")

    print("Seeding complete!")

if __name__ == "__main__":
    seed_teachers()
