import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import Department, Teacher

def migrate():
    cse_dept = Department.objects.filter(dept_name__icontains='Computer Science').first()
    if not cse_dept:
        cse_dept = Department.objects.filter(dept_name__icontains='CSE').first()
        
    aiml_dept = Department.objects.filter(dept_name__icontains='AIML').first()
    if not aiml_dept:
        aiml_dept = Department.objects.filter(dept_name__icontains='AI & ML').first()
        
    if not aiml_dept:
        print("AIML department not found. Creating 'AIML' department...")
        aiml_dept = Department.objects.create(dept_name='AIML')
        
    if not cse_dept:
        print("Computer Science department not found.")
        return

    print(f"Migrating from '{cse_dept.dept_name}' to '{aiml_dept.dept_name}'...")
    
    teachers = Teacher.objects.filter(dept=cse_dept)
    count = teachers.count()
    
    for t in teachers:
        t.dept = aiml_dept
        t.save()
        
    print(f"Successfully migrated {count} teachers to {aiml_dept.dept_name}.")

if __name__ == '__main__':
    migrate()
