from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from .models import Timetable, LeaveRequest, SubstituteRequest, Notification
from .serializers import (
    TimetableSerializer,
    LeaveRequestSerializer,
    SubstituteRequestSerializer,
    NotificationSerializer
)
from accounts.models import Teacher
from django.utils import timezone
from django.db.models import Q

class TimetableView(generics.ListAPIView):
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'teacher'):
            return Timetable.objects.filter(teacher=user.teacher)
        return Timetable.objects.none()

class LeaveRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'teacher'):
            return LeaveRequest.objects.filter(teacher=user.teacher).order_by('-created_at')
        return LeaveRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'teacher'):
            serializer.save(teacher=user.teacher)

class SubstituteRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = SubstituteRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'teacher'):
            return SubstituteRequest.objects.filter(
                Q(original_teacher=user.teacher) |
                Q(substitute_teacher=user.teacher) |
                Q(substitute_teacher__isnull=True)
            ).order_by('-created_at')
        return SubstituteRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'teacher'):
            serializer.save(original_teacher=user.teacher)

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

class MarkNotificationReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({'status': 'marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

class DashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Calculate Admin stats
        from accounts.models import CustomUser, Student
        total_teachers = CustomUser.objects.filter(role__in=['TEACHER', 'SUPER_TEACHER'], is_approved=True, is_active=True).count()
        total_students = Student.objects.count()
        total_classes = Student.objects.exclude(section__isnull=True).exclude(section='').values('section').distinct().count()
        
        today = timezone.now().date()
        teachers_on_leave = LeaveRequest.objects.filter(status='APPROVED', start_date__lte=today, end_date__gte=today).values('teacher').distinct().count()
        teachers_present = total_teachers - teachers_on_leave

        response_data = {
            'total_teachers': total_teachers,
            'teachers_present': teachers_present,
            'teachers_on_leave': teachers_on_leave,
            'total_students': total_students,
            'total_classes': total_classes,
        }

        if hasattr(user, 'teacher'):
            teacher = user.teacher
            total_classes_today = Timetable.objects.filter(teacher=teacher, day=today.strftime("%A")).count()
            pending_leaves = LeaveRequest.objects.filter(teacher=teacher, status='PENDING').count()
            substitute_requests = SubstituteRequest.objects.filter(substitute_teacher=teacher, status='PENDING').count()
            
            from dashboard.models import AttendanceSession, AttendanceRecord
            sessions = AttendanceSession.objects.filter(created_by=user)
            total_attendance_records = AttendanceRecord.objects.filter(session__in=sessions).count()
            present_records = AttendanceRecord.objects.filter(session__in=sessions, status='P').count()
            
            attendance_percentage = 0
            if total_attendance_records > 0:
                attendance_percentage = round((present_records / total_attendance_records) * 100)
            
            # Subject-wise attendance breakdown
            subject_attendance = []
            subjects = sessions.values('subject_code', 'subject_name', 'section').distinct()
            
            for sub in subjects:
                sub_sessions = sessions.filter(subject_code=sub['subject_code'], section=sub['section'])
                t_records = AttendanceRecord.objects.filter(session__in=sub_sessions).count()
                p_records = AttendanceRecord.objects.filter(session__in=sub_sessions, status='P').count()
                
                pct = 0
                if t_records > 0:
                    pct = round((p_records / t_records) * 100)
                
                subject_attendance.append({
                    'subject_code': sub['subject_code'],
                    'subject_name': sub['subject_name'] or sub['subject_code'],
                    'section': sub['section'],
                    'percentage': pct,
                    'total_sessions': sub_sessions.count()
                })
            
            response_data.update({
                'total_classes_today': total_classes_today > 0 and total_classes_today or 0,
                'pending_leaves': pending_leaves,
                'substitute_requests': substitute_requests,
                'attendance_percentage': attendance_percentage,
                'total_attendance_sessions': sessions.count(),
                'subject_attendance': subject_attendance
            })

        return Response(response_data)


class LeaveRequestDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = LeaveRequest.objects.all()

    def get_queryset(self):
        return LeaveRequest.objects.filter(teacher=self.request.user.teacher)

class SubstituteRequestRespondView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            sub_req = SubstituteRequest.objects.get(pk=pk)

            if sub_req.substitute_teacher and sub_req.substitute_teacher != request.user.teacher:
                return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

            if sub_req.original_teacher == request.user.teacher:
                return Response({'error': 'Cannot accept your own request'}, status=status.HTTP_400_BAD_REQUEST)

            action = request.data.get('action')  # ACCEPT or DECLINE

            if action == 'ACCEPT':
                if not sub_req.substitute_teacher:
                    sub_req.substitute_teacher = request.user.teacher
                sub_req.status = 'ACCEPTED'
                Notification.objects.create(
                    user=sub_req.original_teacher.user,
                    message=f"{request.user.get_full_name()} accepted your substitute request for {sub_req.date}",
                    notification_type="success"
                )
            elif action == 'DECLINE':
                sub_req.status = 'DECLINED'
                Notification.objects.create(
                    user=sub_req.original_teacher.user,
                    message=f"{request.user.get_full_name()} declined your substitute request for {sub_req.date}",
                    notification_type="warning"
                )
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

            sub_req.save()
            return Response({'status': 'success'})

        except SubstituteRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

class NotificationDetailView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Notification.objects.all()

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

class TimetableSyncView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        data = request.data
        schedule = data.get('schedule', {})
        headers = data.get('headers', [])
        break_after_index = data.get('break_after_index', 1)
        lunch_after_index = data.get('lunch_after_index', 3)
        
        # We will delete all existing Timetable rows and insert the new ones
        Timetable.objects.all().delete()
        
        # For converting '8:45-9:40' string to time objects
        from datetime import datetime
        def parse_time(time_str):
            try:
                parts = time_str.split(':')
                h = int(parts[0])
                m = int(parts[1])
                # Convert to 24h if it's afternoon
                if h < 8:  # 1:40, 2:35, etc. are PM
                    h += 12
                return datetime.strptime(f"{h}:{m}", "%H:%M").time()
            except Exception:
                return datetime.now().time()
        
        new_entries = []
        from accounts.models import CustomUser, Subject
        
        for key, item in schedule.items():
            faculty_name = item.get('faculty_name', '')
            clean_name = faculty_name.replace('Prof. ', '').replace('Ms. ', '').replace('Dr. ', '').strip()
            
            # Find the teacher user. Use first_name match since the SLM uses first_name
            teacher_user = CustomUser.objects.filter(first_name__icontains=clean_name, role__in=['TEACHER', 'SUPER_TEACHER']).first()
            if not teacher_user or not hasattr(teacher_user, 'teacher'):
                continue
                
            teacher_obj = teacher_user.teacher
            
            subject_code = item.get('subject_code', '')
            subject_obj = Subject.objects.filter(subject_code__iexact=subject_code).first()
            if not subject_obj:
                continue
                
            day_name = item.get('day_name')
            room_number = item.get('room_name', '').split(' ')[0] # "r1 (Main)" -> "r1"
            section = item.get('section_id', '')
            period_index = item.get('period_index', 0)
            duration = item.get('duration', 1)
            
            # Map period_index to header index
            header_idx = period_index
            if header_idx > break_after_index:
                header_idx += 1
            if header_idx > lunch_after_index + 1:
                header_idx += 1
                
            if header_idx >= len(headers):
                continue
                
            start_time_str = headers[header_idx].split('-')[0]
            start_time = parse_time(start_time_str)
            
            end_header_idx = header_idx + (duration - 1)
            if end_header_idx >= len(headers):
                end_header_idx = len(headers) - 1
            end_time_str = headers[end_header_idx].split('-')[1]
            end_time = parse_time(end_time_str)
            
            new_entries.append(Timetable(
                teacher=teacher_obj,
                day=day_name,
                start_time=start_time,
                end_time=end_time,
                subject=subject_obj,
                room_number=room_number,
                section=section
            ))
            
        Timetable.objects.bulk_create(new_entries)
        return Response({'status': 'success', 'synced': len(new_entries)})

class MarkAllNotificationsReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'marked all as read'})


import sys
import os
from django.conf import settings as django_settings

# Add timetable generator to path
TIMETABLE_DIR = os.path.join(django_settings.BASE_DIR, '..', 'timetable_slm-main')
if TIMETABLE_DIR not in sys.path:
    sys.path.append(TIMETABLE_DIR)

def _convert_json_to_objects(data):
    """
    Converts raw JSON dict into domain model objects.
    This is an inline copy of app.py's convert_json_to_objects()
    so we never import app.py (which depends on streamlit).
    """
    from models import Faculty, Subject, Section, Room, SubjectType
    from data_loader import Allocation

    def _get_subject_type_enum(type_str):
        return {
            "THEORY": SubjectType.THEORY, "LAB": SubjectType.LAB,
            "SOFTSKILL": SubjectType.SOFTSKILL, "FORUM": SubjectType.FORUM
        }.get(type_str.upper(), SubjectType.THEORY)

    fac_objs  = [Faculty(f['id'], f['name'], f['designation'], f['max_hours'])
                 for f in data['faculties']]
    sub_objs  = [Subject(s['code'], s['name'], s['credits'],
                         _get_subject_type_enum(s['type']),
                         s.get('is_core', True), s.get('is_heavy', False))
                 for s in data['subjects']]
    sec_objs  = [Section(s['id'], s['semester'], s['strength'])
                 for s in data['sections']]
    room_objs = [Room(r['id'], r['capacity'], r['is_lab'], r['building'])
                 for r in data['rooms']]
    alloc_objs = [Allocation(a['faculty_id'], a['subject_code'],
                             a['section_id'], a.get('elective_group'))
                  for a in data['allocations']]
    return fac_objs, sub_objs, sec_objs, room_objs, alloc_objs


class GenerateTimetableView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized. Only Admin or Super Teacher can generate the timetable.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            from storage import load_data, save_schedule, save_original_schedule
            from data_loader import prepare_scheduling_tasks
            from solver import TimetableSolver
            from slm_inference import get_constraints_batch

            data = load_data()
            facs, subs, secs, rooms, allocs = _convert_json_to_objects(data)
            tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)

            constraints_text = request.data.get('constraints', [])
            pre_slm_constraints = []
            if constraints_text:
                pre_slm_constraints = get_constraints_batch(constraints_text)

            solver = TimetableSolver(tasks, facs, secs, rooms)
            time_limit = request.data.get('time_limit_seconds', 30)
            solve_status, solution = solver.solve(
                time_limit_seconds=int(time_limit),
                enable_soft_constraints=True,
                slm_constraints=pre_slm_constraints
            )

            if solve_status in ["OPTIMAL", "FEASIBLE"]:
                save_schedule(solution)
                save_original_schedule(solution)
                return Response({
                    'status': solve_status,
                    'message': 'Timetable generated successfully.',
                    'schedule': solution
                })
            else:
                return Response({'error': f'Solver failed with status: {solve_status}'}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ScheduleView(views.APIView):
    """GET the current generated schedule from saved_schedule.json."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER', 'TEACHER', 'STUDENT']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            from storage import load_schedule, schedule_exists
            if not schedule_exists():
                return Response({'exists': False, 'schedule': None})
            sched = load_schedule()
            return Response({'exists': True, **sched})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateTimetableView(views.APIView):
    """POST a natural-language prompt to partially re-optimize the timetable."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        prompt = request.data.get('prompt', '').strip()
        preview_only = request.data.get('preview_only', False)
        if not prompt:
            return Response({'error': 'Prompt is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from storage import load_data, load_schedule, save_schedule, schedule_exists, add_history_entry
            from data_loader import prepare_scheduling_tasks
            from slm_inference import smart_parse, get_constraint
            from partial_optimizer import PartialOptimizer

            if not schedule_exists():
                return Response({'error': 'No timetable generated yet.'}, status=status.HTTP_400_BAD_REQUEST)

            data = load_data()

            if preview_only:
                local = smart_parse(prompt, data['faculties'],
                                    data.get('subjects', []), data.get('sections', []))
                if local:
                    return Response({'source': 'local', 'constraints': [local]})
                result = get_constraint(prompt)
                if result.get('success'):
                    return Response({'source': 'slm', 'constraints': result['constraints']})
                return Response({'error': result.get('error', 'Failed to parse'), 'raw': result.get('raw', '')},
                                status=status.HTTP_400_BAD_REQUEST)

            priority_keywords = [
                'replace','substitute','take over','will take','on leave','cover',
                'permanently','change faculty','hand over','assign all',
                'cancel','no class','holiday','off day',
                'move','shift','reschedule','transfer','relocate',
                'change room','to lab','to room','assign room',
                'extra class','makeup','compensatory','schedule extra',
                'add extra','add makeup','additional session','extra session',
                'swap','exchange','freeze','lock slot',
                'should not be free','must not be free','cannot be free',
                'must have a class','should have a class','always occupied',
                'no free period','no free slot','must be filled',
                'first hour','first period','last period','last hour',
            ]
            use_smart_parse_first = any(kw in prompt.lower() for kw in priority_keywords)
            constraints = []

            if use_smart_parse_first:
                local = smart_parse(prompt, data['faculties'],
                                    data.get('subjects', []), data.get('sections', []))
                if local:
                    constraints = [local]

            if not constraints:
                result = get_constraint(prompt)
                if not result.get('success'):
                    return Response({'error': f"Could not parse: {result.get('error')}",
                                     'raw': result.get('raw', '')},
                                    status=status.HTTP_400_BAD_REQUEST)
                constraints = result.get('constraints', [])

            if not constraints:
                return Response({'error': 'No constraints parsed.'}, status=status.HTTP_400_BAD_REQUEST)

            sched = load_schedule()
            current_solution = sched['schedule']
            facs, subs, secs, rooms, allocs = _convert_json_to_objects(data)
            tasks = prepare_scheduling_tasks(allocs, facs, subs, secs)

            tasks_by_id = {t.task_id: t for t in tasks}
            for tid, info in current_solution.items():
                if tid in tasks_by_id:
                    info['task_obj'] = tasks_by_id[tid]

            all_changes = []
            final_solution = current_solution
            for constraint in constraints:
                optimizer = PartialOptimizer(tasks, facs, secs, rooms, final_solution)
                op_status, new_solution, affected, summary = \
                    optimizer.apply_constraint_and_reoptimize(constraint)
                if op_status in ('OPTIMAL', 'FEASIBLE', 'NO_CHANGE'):
                    final_solution = new_solution
                    all_changes.append(summary)
                else:
                    all_changes.append(f"Warning: {summary}")

            save_schedule(final_solution)
            add_history_entry(
                prompt=prompt,
                constraints=constraints,
                affected_tasks=[],
                status='SUCCESS',
                changes_summary='\n'.join(all_changes)
            )

            clean_prev = {k: {kk: vv for kk, vv in v.items() if kk != 'task_obj'} for k, v in current_solution.items()}
            clean_new = {k: {kk: vv for kk, vv in v.items() if kk != 'task_obj'} for k, v in final_solution.items()}

            return Response({
                'status': 'SUCCESS',
                'constraints': constraints,
                'changes': all_changes,
                'previous_schedule': clean_prev,
                'updated_schedule': clean_new,
            })

        except Exception as e:
            import traceback
            return Response({'error': str(e), 'traceback': traceback.format_exc()},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OriginalScheduleView(views.APIView):
    """GET both original and current schedules for comparison."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            from storage import (load_schedule, schedule_exists,
                                 load_original_schedule, original_schedule_exists,
                                 load_history)
            if not schedule_exists():
                return Response({'error': 'No timetable generated yet.'}, status=status.HTTP_400_BAD_REQUEST)

            current = load_schedule()
            has_orig = original_schedule_exists()
            original = load_original_schedule() if has_orig else None
            history = load_history()

            return Response({
                'has_original': has_orig,
                'original': original,
                'current': current,
                'total_changes': len(history),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangeHistoryView(views.APIView):
    """GET the change history log."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            from storage import load_history
            history = load_history()
            return Response({'history': list(reversed(history))})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TimetableDataCRUDView(views.APIView):
    """CRUD for faculties, subjects, sections, rooms, allocations in timetable_data.json."""
    permission_classes = [permissions.IsAuthenticated]

    VALID_ENTITIES = ['faculties', 'subjects', 'sections', 'rooms', 'allocations']

    def get(self, request, entity):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        if entity not in self.VALID_ENTITIES:
            return Response({'error': f'Invalid entity: {entity}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from storage import load_data
            data = load_data()
            return Response({entity: data.get(entity, [])})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, entity):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        if entity not in self.VALID_ENTITIES:
            return Response({'error': f'Invalid entity: {entity}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from storage import load_data, save_data
            data = load_data()
            item = request.data.get('item')
            if not item:
                return Response({'error': 'Item data required.'}, status=status.HTTP_400_BAD_REQUEST)
            data[entity].append(item)
            save_data(data)
            return Response({'status': 'added', entity: data[entity]})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, entity):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        if entity not in self.VALID_ENTITIES:
            return Response({'error': f'Invalid entity: {entity}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from storage import load_data, save_data
            data = load_data()
            index = request.data.get('index')
            clear_all = request.data.get('clear_all', False)
            if clear_all:
                data[entity] = []
            elif index is not None:
                idx = int(index)
                if 0 <= idx < len(data[entity]):
                    data[entity].pop(idx)
                else:
                    return Response({'error': 'Index out of range.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({'error': 'Provide index or clear_all.'}, status=status.HTTP_400_BAD_REQUEST)
            save_data(data)
            return Response({'status': 'deleted', entity: data[entity]})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentScheduleView(views.APIView):
    """GET the schedule for a student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'STUDENT':
            return Response({'error': 'This endpoint is for students only.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            from storage import load_schedule, schedule_exists
            if not schedule_exists():
                return Response({'exists': False, 'schedule': None})
            sched = load_schedule()
            return Response({'exists': True, **sched})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentNotificationsView(views.APIView):
    """GET notifications for a student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'STUDENT':
            return Response({'error': 'This endpoint is for students only.'}, status=status.HTTP_403_FORBIDDEN)
        notifications = Notification.objects.filter(user=user).order_by('-created_at')[:50]
        serializer = NotificationSerializer(notifications, many=True)
        return Response({'notifications': serializer.data})


class TimetableChangeNotifyView(views.APIView):
    """POST — Admin/Super Teacher can broadcast a timetable change notification to all students."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        message = request.data.get('message', 'The timetable has been updated. Please check for changes.')
        notification_type = request.data.get('notification_type', 'TIMETABLE_CHANGE')

        from accounts.models import CustomUser
        students = CustomUser.objects.filter(role='STUDENT', is_approved=True)
        notifications = []
        for student in students:
            notifications.append(Notification(
                user=student,
                message=message,
                notification_type=notification_type,
                is_read=False,
            ))
        Notification.objects.bulk_create(notifications)
        return Response({'status': 'success', 'notified_count': len(notifications)})


# =============================================================================
# ATTENDANCE VIEWS
# =============================================================================

class AttendanceStudentListView(views.APIView):
    """
    GET /dashboard/attendance/students/?section=CSE-3A
    Returns the list of approved students enrolled in the given section.
    Accessible by TEACHER, SUPER_TEACHER, ADMIN.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER', 'TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        section = request.query_params.get('section', '').strip()
        if not section:
            return Response({'error': 'section query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.models import CustomUser
        from django.db.models import Q
        
        student_users = CustomUser.objects.filter(
            role='STUDENT',
            is_approved=True
        ).filter(
            Q(student__section__iexact=section) |
            Q(student__section__iendswith=f"-{section}") |
            Q(student__section__iendswith=f" {section}")
        ).select_related('student').order_by('first_name', 'last_name')

        data = []
        for u in student_users:
            profile = getattr(u, 'student', None)
            data.append({
                'id': u.id,
                'name': u.get_full_name(),
                'email': u.email,
                'register_number': profile.register_number if profile else '',
                'section': profile.section if profile else '',
            })

        return Response({'students': data, 'count': len(data)})


class AttendanceSubmitView(views.APIView):
    """
    POST /dashboard/attendance/submit/
    Enforces: date must equal today (IST). Prevents duplicate submissions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ['ADMIN', 'SUPER_TEACHER', 'TEACHER']:
            return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        subject_code = data.get('subject_code', '').strip()
        section      = data.get('section', '').strip()
        date_str     = data.get('date', '').strip()
        period_index = data.get('period_index')
        records      = data.get('records', [])

        if not all([subject_code, section, date_str, period_index is not None]):
            return Response(
                {'error': 'subject_code, section, date, period_index are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Same-day enforcement (IST)
        from datetime import date as date_cls, datetime
        try:
            import pytz
            ist = pytz.timezone('Asia/Kolkata')
            today_ist = datetime.now(ist).date()
        except ImportError:
            # fallback if pytz not available
            from datetime import timezone as tz_mod, timedelta
            today_ist = datetime.now(tz_mod.utc).date()

        try:
            submitted_date = date_cls.fromisoformat(date_str)
        except Exception:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if submitted_date != today_ist:
            return Response({
                'error': f'Attendance can only be marked for today ({today_ist.isoformat()}). '
                         f'The class date was {date_str}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Ensure teachers and super teachers can only mark their own classes
        if user.role in ['TEACHER', 'SUPER_TEACHER']:
            faculty_name = data.get('faculty_name', '').lower()
            if faculty_name and user.first_name.lower() not in faculty_name:
                return Response(
                    {'error': 'You can only mark attendance for your allocated subjects.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        from .models import AttendanceSession, AttendanceRecord
        from accounts.models import CustomUser

        # Prevent duplicate submission
        if AttendanceSession.objects.filter(
            subject_code=subject_code, section=section,
            date=submitted_date, period_index=int(period_index)
        ).exists():
            return Response(
                {'error': 'Attendance already submitted for this session.'},
                status=status.HTTP_409_CONFLICT
            )

        # Create session
        session = AttendanceSession.objects.create(
            subject_code=subject_code,
            subject_name=data.get('subject_name', ''),
            section=section,
            faculty_name=data.get('faculty_name', user.get_full_name()),
            date=submitted_date,
            period_index=int(period_index),
            time_slot=data.get('time_slot', ''),
            created_by=user,
        )

        # Bulk-create records
        record_objs = []
        errors = []
        for rec in records:
            try:
                student_user = CustomUser.objects.get(pk=rec['student_id'], role='STUDENT')
                record_objs.append(AttendanceRecord(
                    session=session,
                    student=student_user,
                    status=rec.get('status', 'A'),
                ))
            except CustomUser.DoesNotExist:
                errors.append(f"Student id={rec.get('student_id')} not found.")

        AttendanceRecord.objects.bulk_create(record_objs)

        return Response({
            'status': 'success',
            'session_id': session.id,
            'records_created': len(record_objs),
            'errors': errors,
        }, status=status.HTTP_201_CREATED)


class AttendanceStatusView(views.APIView):
    """
    GET /dashboard/attendance/status/?subject_code=ML&section=CSE-3A&date=2024-04-23&period_index=2
    Returns whether attendance has already been submitted for this session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subject_code = request.query_params.get('subject_code', '')
        section      = request.query_params.get('section', '')
        date_str     = request.query_params.get('date', '')
        period_index = request.query_params.get('period_index')

        if not all([subject_code, section, date_str, period_index is not None]):
            return Response({'error': 'All query params required.'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import AttendanceSession
        session_obj = AttendanceSession.objects.filter(
            subject_code=subject_code,
            section=section,
            date=date_str,
            period_index=int(period_index),
        ).first()

        if session_obj:
            from .serializers import AttendanceSessionSerializer
            return Response({'submitted': True, 'session': AttendanceSessionSerializer(session_obj).data})
        return Response({'submitted': False})


class StudentMyAttendanceView(views.APIView):
    """
    GET /dashboard/attendance/my/
    Returns attendance stats for the logged-in student.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'STUDENT':
            return Response({'error': 'Only students can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        from .models import AttendanceRecord

        records = AttendanceRecord.objects.filter(student=user).select_related('session')

        total_classes = records.count()
        present_count = records.filter(status='P').count()
        overall_pct   = round((present_count / total_classes * 100), 1) if total_classes > 0 else 0.0

        # Subject-wise aggregation
        subject_map: dict = {}
        for rec in records:
            code = rec.session.subject_code
            name = rec.session.subject_name or code
            if code not in subject_map:
                subject_map[code] = {'subject_code': code, 'subject_name': name, 'total': 0, 'present': 0}
            subject_map[code]['total'] += 1
            if rec.status == 'P':
                subject_map[code]['present'] += 1

        subject_wise = []
        for sub in subject_map.values():
            sub['percentage'] = round((sub['present'] / sub['total'] * 100), 1) if sub['total'] > 0 else 0.0
            subject_wise.append(sub)

        subject_wise.sort(key=lambda x: x['subject_code'])

        # Recent 30 records
        recent_records = []
        for rec in records.order_by('-session__date', '-session__period_index')[:30]:
            recent_records.append({
                'date': rec.session.date.isoformat(),
                'subject_code': rec.session.subject_code,
                'subject_name': rec.session.subject_name,
                'section': rec.session.section,
                'time_slot': rec.session.time_slot,
                'period_index': rec.session.period_index,
                'status': rec.status,
            })

        return Response({
            'overall': {
                'total_classes': total_classes,
                'present': present_count,
                'absent': total_classes - present_count,
                'percentage': overall_pct,
            },
            'subject_wise': subject_wise,
            'recent_records': recent_records,
        })
