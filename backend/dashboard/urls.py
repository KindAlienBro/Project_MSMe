from django.urls import path
from .views import (
    TimetableView,
    LeaveRequestListCreateView,
    SubstituteRequestListCreateView,
    NotificationListView,
    MarkNotificationReadView,
    DashboardStatsView,

    LeaveRequestDetailView,
    SubstituteRequestRespondView,
    NotificationDetailView,
    MarkAllNotificationsReadView,
    GenerateTimetableView,

    ScheduleView,
    UpdateTimetableView,
    OriginalScheduleView,
    ChangeHistoryView,
    TimetableDataCRUDView,

    StudentScheduleView,
    StudentNotificationsView,
    TimetableChangeNotifyView,

    # Attendance
    AttendanceStudentListView,
    AttendanceSubmitView,
    AttendanceStatusView,
    StudentMyAttendanceView,
    TimetableSyncView,
)

urlpatterns = [
    path('timetable/', TimetableView.as_view(), name='timetable'),
    path('leave-requests/', LeaveRequestListCreateView.as_view(), name='leave-requests'),
    path('substitute-requests/', SubstituteRequestListCreateView.as_view(), name='substitute-requests'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', MarkNotificationReadView.as_view(), name='mark-notification-read'),
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),

    path('generate-timetable/', GenerateTimetableView.as_view(), name='generate-timetable'),
    path('timetable/sync/', TimetableSyncView.as_view(), name='timetable-sync'),
    path('leave-requests/<int:pk>/', LeaveRequestDetailView.as_view(), name='leave-request-detail'),
    path('substitute-requests/<int:pk>/respond/', SubstituteRequestRespondView.as_view(), name='substitute-request-respond'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/mark-all-read/', MarkAllNotificationsReadView.as_view(), name='mark-all-notifications-read'),

    # Super Teacher / Admin endpoints
    path('schedule/', ScheduleView.as_view(), name='schedule'),
    path('update-timetable/', UpdateTimetableView.as_view(), name='update-timetable'),
    path('original-schedule/', OriginalScheduleView.as_view(), name='original-schedule'),
    path('change-history/', ChangeHistoryView.as_view(), name='change-history'),
    path('timetable-data/<str:entity>/', TimetableDataCRUDView.as_view(), name='timetable-data-crud'),

    # Student-specific endpoints
    path('student/timetable/', StudentScheduleView.as_view(), name='student-timetable'),
    path('student/notifications/', StudentNotificationsView.as_view(), name='student-notifications'),
    path('notify-timetable-change/', TimetableChangeNotifyView.as_view(), name='notify-timetable-change'),

    # Attendance endpoints
    path('attendance/students/', AttendanceStudentListView.as_view(), name='attendance-student-list'),
    path('attendance/submit/', AttendanceSubmitView.as_view(), name='attendance-submit'),
    path('attendance/status/', AttendanceStatusView.as_view(), name='attendance-status'),
    path('attendance/my/', StudentMyAttendanceView.as_view(), name='student-my-attendance'),
]
