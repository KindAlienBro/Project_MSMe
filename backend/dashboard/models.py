from django.db import models
from django.conf import settings
from accounts.models import Teacher, Subject, Department

class Timetable(models.Model):
    class DayOfWeek(models.TextChoices):
        MONDAY = "Monday", "Monday"
        TUESDAY = "Tuesday", "Tuesday"
        WEDNESDAY = "Wednesday", "Wednesday"
        THURSDAY = "Thursday", "Thursday"
        FRIDAY = "Friday", "Friday"
        SATURDAY = "Saturday", "Saturday"
        SUNDAY = "Sunday", "Sunday"

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='timetable_entries')
    day = models.CharField(max_length=10, choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    room_number = models.CharField(max_length=20)
    section = models.CharField(max_length=20) # e.g. "CS-3A"

    def __str__(self):
        return f"{self.day} {self.start_time}-{self.end_time}: {self.subject.subject_name}"

class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='leave_requests')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.teacher} - {self.start_date} to {self.end_date} ({self.status})"

class SubstituteRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"

    original_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='subtitelist_requests_sent')
    substitute_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='substitute_requests_received', null=True, blank=True)
    
    # Optional: link to specific timetable slot if needed, or just date/time
    timetable_slot = models.ForeignKey(Timetable, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sub req: {self.original_teacher} -> {self.substitute_teacher} on {self.date}"

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional: Link to related object (GenericForeignKey) or just type
    notification_type = models.CharField(max_length=50, blank=True, null=True) # e.g. "LEAVE_UPDATE", "SUBSTITUTE_REQ"

    def __str__(self):
        return f"Notif for {self.user}: {self.message[:20]}"


class AttendanceSession(models.Model):
    """
    Represents a single class period for which attendance was taken.
    A session is uniquely identified by (subject_code, section, date, period_index).
    """
    subject_code  = models.CharField(max_length=50)
    subject_name  = models.CharField(max_length=100, blank=True)
    section       = models.CharField(max_length=20)          # e.g. "CSE-3A"
    faculty_name  = models.CharField(max_length=100)
    date          = models.DateField()                        # date the class was held
    period_index  = models.IntegerField()                     # 0-based period number
    time_slot     = models.CharField(max_length=50, blank=True)  # e.g. "9:30-10:25"
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='attendance_sessions_created'
    )
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('subject_code', 'section', 'date', 'period_index')

    def __str__(self):
        return f"{self.subject_code} | {self.section} | {self.date} P{self.period_index}"


class AttendanceRecord(models.Model):
    """
    A single student's attendance status for one AttendanceSession.
    """
    class Status(models.TextChoices):
        PRESENT = 'P', 'Present'
        ABSENT  = 'A', 'Absent'

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendance_records'
    )
    status  = models.CharField(max_length=1, choices=Status.choices, default=Status.ABSENT)

    class Meta:
        unique_together = ('session', 'student')

    def __str__(self):
        return f"{self.student.get_full_name()} — {self.session} — {self.status}"
