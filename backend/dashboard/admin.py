from django.contrib import admin
from .models import Timetable, LeaveRequest, SubstituteRequest, Notification

@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ('day', 'start_time', 'end_time', 'subject', 'teacher', 'section', 'room_number')
    list_filter = ('day', 'subject', 'teacher', 'section')
    search_fields = ('subject__subject_name', 'teacher__user__first_name', 'section')

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'start_date', 'end_date', 'reason', 'status', 'created_at')
    list_filter = ('status', 'start_date', 'teacher')
    search_fields = ('teacher__user__first_name', 'reason')
    list_editable = ('status',)

@admin.register(SubstituteRequest)
class SubstituteRequestAdmin(admin.ModelAdmin):
    list_display = ('original_teacher', 'substitute_teacher', 'date', 'status', 'created_at')
    list_filter = ('status', 'date')
    search_fields = ('original_teacher__user__first_name', 'substitute_teacher__user__first_name')
    list_editable = ('status',)

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at')
    search_fields = ('user__email', 'message')
