from django.core.management.base import BaseCommand
from accounts.models import CustomUser, Teacher, Department, Subject
from dashboard.models import Timetable, LeaveRequest, SubstituteRequest, Notification
from datetime import time, date, timedelta
from django.utils import timezone

class Command(BaseCommand):
    help = 'Seeds database with initial dashboard data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding data...')

        # Create Department
        dept, created = Department.objects.get_or_create(dept_name="CSE")
        self.stdout.write(f'Department: {dept.dept_name}')

        # Create Subjects
        subjects_data = [
            {"name": "Data Structures", "code": "CS301", "credits": 4, "type": "THEORY"},
            {"name": "Algorithms", "code": "CS302", "credits": 4, "type": "THEORY"},
            {"name": "Web Lab", "code": "CS303", "credits": 2, "type": "LAB"},
        ]
        
        subjects = []
        for sub in subjects_data:
            s, _ = Subject.objects.get_or_create(
                subject_code=sub["code"],
                defaults={
                    "subject_name": sub["name"],
                    "credit_hours": sub["credits"],
                    "type": sub["type"],
                    "dept": dept
                }
            )
            subjects.append(s)

        # Create Teacher User
        email = "teacher@example.com"
        if not CustomUser.objects.filter(email=email).exists():
            user = CustomUser.objects.create_user(
                email=email,
                password="password123",
                first_name="John",
                last_name="Doe",
                role="TEACHER",
                is_approved=True
            )
            teacher = Teacher.objects.create(
                user=user,
                dept=dept,
                designation="ASSISTANT_PROFESSOR",
                phone="1234567890",
                biometric_id="BIO123"
            )
            teacher.subjects_of_interest.set(subjects)
            self.stdout.write(f'Created teacher: {email}')
        else:
            teacher = Teacher.objects.get(user__email=email)
            self.stdout.write(f'Teacher exists: {email}')

        # Create Timetable (for Monday)
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        for day in days:
            if not Timetable.objects.filter(teacher=teacher, day=day).exists():
                Timetable.objects.create(
                    teacher=teacher,
                    day=day,
                    start_time=time(9, 0),
                    end_time=time(10, 0),
                    subject=subjects[0],
                    room_number="101",
                    section="3A"
                )
                Timetable.objects.create(
                    teacher=teacher,
                    day=day,
                    start_time=time(10, 0),
                    end_time=time(11, 0),
                    subject=subjects[1],
                    room_number="102",
                    section="3B"
                )
        self.stdout.write('Timetable seeded')

        # Create Notifications
        if not Notification.objects.filter(user=teacher.user).exists():
            Notification.objects.create(user=teacher.user, message="Welcome to the dashboard!", notification_type="info")
            Notification.objects.create(user=teacher.user, message="Meeting at 2 PM", notification_type="warning")
        


        self.stdout.write('Seeding complete')
