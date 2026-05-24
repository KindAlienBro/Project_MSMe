from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from accounts.models import CustomUser, Teacher, Department, Subject
from dashboard.models import Timetable, LeaveRequest, SubstituteRequest, Notification, Student, Attendance
import datetime

class DashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Dept & Subject
        self.dept = Department.objects.create(dept_name="CSE")
        self.subject = Subject.objects.create(
            dept=self.dept, 
            subject_name="Algorithms", 
            subject_code="CS101", 
            credit_hours=3, 
            type="THEORY"
        )

        # Create Teacher User
        self.user = CustomUser.objects.create_user(
            email="teacher@test.com", 
            password="password123", 
            role="TEACHER",
            first_name="John",
            last_name="Doe",
            is_approved=True
        )
        self.teacher = Teacher.objects.create(
            user=self.user, 
            dept=self.dept, 
            designation="ASSISTANT_PROFESSOR"
        )
        self.client.force_authenticate(user=self.user)

        # Create another teacher for substitute tests
        self.user2 = CustomUser.objects.create_user(
            email="sub@test.com", 
            password="password123", 
            role="TEACHER",
            first_name="Jane", 
            last_name="Doe",
            is_approved=True
        )
        self.teacher2 = Teacher.objects.create(
            user=self.user2, 
            dept=self.dept, 
            designation="PROFESSOR"
        )

        # Create Student
        self.student = Student.objects.create(
            name="Alice", 
            roll_number="123", 
            section="A", 
            dept=self.dept
        )

    def test_get_timetable(self):
        # Create a timetable entry
        Timetable.objects.create(
            teacher=self.teacher,
            day=timezone.now().strftime("%A"),
            start_time="10:00:00",
            end_time="11:00:00",
            subject=self.subject,
            room_number="101",
            section="A"
        )
        response = self.client.get(reverse('timetable'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['subject_code'], "CS101")

    def test_leave_request_flow(self):
        # Apply for leave
        data = {
            "start_date": "2024-01-01",
            "end_date": "2024-01-02",
            "reason": "Sick"
        }
        response = self.client.post(reverse('leave-requests'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LeaveRequest.objects.count(), 1)
        leave_id = response.data['id']

        # List leaves
        response = self.client.get(reverse('leave-requests'))
        self.assertEqual(len(response.data), 1)

        # Delete (Cancel) leave
        response = self.client.delete(reverse('leave-request-detail', args=[leave_id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(LeaveRequest.objects.count(), 0)

    def test_substitute_request_flow(self):
        # Create request
        data = {
            "date": "2024-01-05",
            # Simple request without specifying slot for now
        }
        response = self.client.post(reverse('substitute-requests'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sub_id = response.data['id']
        
        # Helper to assign self as substitute (simulation)
        sub_req = SubstituteRequest.objects.get(id=sub_id)
        sub_req.substitute_teacher = self.teacher2
        sub_req.save()

        # Login as teacher2 to accept
        self.client.force_authenticate(user=self.user2)
        response = self.client.post(reverse('substitute-request-respond', args=[sub_id]), {'action': 'ACCEPT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub_req.refresh_from_db()
        self.assertEqual(sub_req.status, 'ACCEPTED')

        # Check notification for original teacher
        notif = Notification.objects.filter(user=self.user).first()
        self.assertIsNotNone(notif)
        self.assertIn("accepted", notif.message)

    def test_claim_open_request_flow(self):
        # Teacher 1 creates an open request
        req = SubstituteRequest.objects.create(
            original_teacher=self.teacher,
            date="2024-01-10",
            status='PENDING'
        )
        
        # Teacher 1 tries to claim it (should fail)
        response = self.client.post(reverse('substitute-request-respond', args=[req.id]), {'action': 'ACCEPT'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Teacher 2 claims it
        self.client.force_authenticate(user=self.user2)
        response = self.client.post(reverse('substitute-request-respond', args=[req.id]), {'action': 'ACCEPT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        req.refresh_from_db()
        self.assertEqual(req.substitute_teacher, self.teacher2)
        self.assertEqual(req.status, 'ACCEPTED')

    def test_notifications_flow(self):
        # Create notification
        Notification.objects.create(user=self.user, message="Test Notif")
        
        # List
        response = self.client.get(reverse('notifications'))
        self.assertEqual(len(response.data), 1)
        notif_id = response.data[0]['id']

        # Mark read
        response = self.client.post(reverse('mark-notification-read', args=[notif_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Notification.objects.get(id=notif_id).is_read)

        # Delete
        response = self.client.delete(reverse('notification-detail', args=[notif_id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Notification.objects.count(), 0)

    def test_mark_attendance(self):
        data = {
            "attendance": [
                {
                    "student_id": self.student.id,
                    "subject_id": self.subject.id,
                    "date": "2024-01-01",
                    "status": "PRESENT"
                }
            ]
        }
        response = self.client.post(reverse('mark-attendance'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Attendance.objects.count(), 1)
