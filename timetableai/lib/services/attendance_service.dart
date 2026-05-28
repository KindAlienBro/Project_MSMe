import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/attendance.dart';

/// Service for attendance endpoints.
class AttendanceService {
  final Dio _dio = ApiClient.instance;

  /// GET /dashboard/attendance/students/?section=...
  Future<List<AttendanceRecord>> getStudentsForClass(String section) async {
    final response = await _dio.get(
      '/dashboard/attendance/students/',
      queryParameters: {'section': section},
    );
    
    final data = response.data;
    List<dynamic> studentsList;
    if (data is Map && data.containsKey('students')) {
      studentsList = data['students'] as List<dynamic>;
    } else if (data is List) {
      studentsList = data;
    } else {
      throw Exception("Unexpected response format: ${data.runtimeType}");
    }
    
    return studentsList
        .map((s) => AttendanceRecord.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// POST /dashboard/attendance/submit/
  Future<void> submitAttendance({
    required String subjectCode,
    required String subjectName,
    required String section,
    required String facultyName,
    required String date,
    required int periodIndex,
    required String timeSlot,
    required List<AttendanceRecord> records,
  }) async {
    await _dio.post('/dashboard/attendance/submit/', data: {
      'subject_code': subjectCode,
      'subject_name': subjectName,
      'section': section,
      'faculty_name': facultyName,
      'date': date,
      'period_index': periodIndex,
      'time_slot': timeSlot,
      'records': records.map((r) => r.toJson()).toList(),
    });
  }

  /// GET /dashboard/attendance/status/?subject_code=...&section=...&date=...&period_index=...
  Future<Map<String, dynamic>> getAttendanceStatus({
    required String subjectCode,
    required String section,
    required String date,
    required int periodIndex,
  }) async {
    final response = await _dio.get(
      '/dashboard/attendance/status/',
      queryParameters: {
        'subject_code': subjectCode,
        'section': section,
        'date': date,
        'period_index': periodIndex,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// GET /dashboard/attendance/my/
  Future<List<SubjectAttendance>> getMyAttendance() async {
    final response = await _dio.get('/dashboard/attendance/my/');
    if (response.data is List) {
      return (response.data as List)
          .map((a) => SubjectAttendance.fromJson(a as Map<String, dynamic>))
          .toList();
    }
    // Handle case where response is a map with subjects key
    final data = response.data as Map<String, dynamic>;
    if (data.containsKey('subjects')) {
      return (data['subjects'] as List)
          .map((a) => SubjectAttendance.fromJson(a as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
