from rest_framework import serializers
from .models import Timetable, LeaveRequest, SubstituteRequest, Notification, AttendanceSession, AttendanceRecord
from accounts.serializers import UserRegistrationSerializer # Or a simple UserSerializer
from accounts.models import CustomUser, Teacher, Subject

class TimetableSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.subject_name', read_only=True)
    subject_code = serializers.CharField(source='subject.subject_code', read_only=True)

    class Meta:
        model = Timetable
        fields = ['id', 'day', 'start_time', 'end_time', 'subject', 'subject_name', 'subject_code', 'room_number', 'section']

class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = ['id', 'start_date', 'end_date', 'reason', 'status', 'created_at']
        read_only_fields = ['status', 'created_at']

class SubstituteRequestSerializer(serializers.ModelSerializer):
    original_teacher_name = serializers.SerializerMethodField()
    substitute_teacher_name = serializers.SerializerMethodField()

    def get_original_teacher_name(self, obj):
        return obj.original_teacher.user.get_full_name() if obj.original_teacher else "Unknown"

    def get_substitute_teacher_name(self, obj):
        return obj.substitute_teacher.user.get_full_name() if obj.substitute_teacher else None
    
    class Meta:
        model = SubstituteRequest
        fields = ['id', 'original_teacher', 'original_teacher_name', 'substitute_teacher', 'substitute_teacher_name', 'timetable_slot', 'date', 'status', 'created_at']
        read_only_fields = ['original_teacher', 'status', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'user', 'message', 'is_read', 'created_at', 'notification_type']
        read_only_fields = ['created_at']


# ─── Attendance Serializers ──────────────────────────────────────────────────

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_id   = serializers.IntegerField(source='student.id', read_only=True)
    student_name = serializers.SerializerMethodField()
    register_number = serializers.SerializerMethodField()

    def get_student_name(self, obj):
        return obj.student.get_full_name()

    def get_register_number(self, obj):
        try:
            return obj.student.student.register_number or ''
        except Exception:
            return ''

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'student_id', 'student_name', 'register_number', 'status']


class AttendanceSessionSerializer(serializers.ModelSerializer):
    records = AttendanceRecordSerializer(many=True, read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'subject_code', 'subject_name', 'section', 'faculty_name',
            'date', 'period_index', 'time_slot', 'created_at', 'records'
        ]
