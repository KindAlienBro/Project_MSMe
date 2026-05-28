import 'package:dio/dio.dart';
import '../core/api_client.dart';

/// Service for dashboard statistics and timetable schedule endpoints.
class DashboardService {
  final Dio _dio = ApiClient.instance;

  /// GET /dashboard/stats/
  Future<Map<String, dynamic>> getStats() async {
    final response = await _dio.get('/dashboard/stats/');
    return response.data as Map<String, dynamic>;
  }

  /// GET /dashboard/timetable/
  Future<List<dynamic>> getTimetable() async {
    final response = await _dio.get('/dashboard/timetable/');
    return response.data as List<dynamic>;
  }

  /// GET /dashboard/schedule/
  Future<Map<String, dynamic>> getSchedule() async {
    final response = await _dio.get('/dashboard/schedule/');
    return response.data as Map<String, dynamic>;
  }

  /// GET /dashboard/original-schedule/
  Future<Map<String, dynamic>> getOriginalSchedule() async {
    final response = await _dio.get('/dashboard/original-schedule/');
    return response.data as Map<String, dynamic>;
  }

  /// GET /dashboard/change-history/
  Future<List<dynamic>> getChangeHistory() async {
    final response = await _dio.get('/dashboard/change-history/');
    if (response.data is Map<String, dynamic> && response.data.containsKey('history')) {
      return response.data['history'] as List<dynamic>;
    }
    return response.data as List<dynamic>;
  }

  /// POST /dashboard/overwrite-timetable/
  Future<void> updateTimetable(Map<String, dynamic> data) async {
    await _dio.post('/dashboard/overwrite-timetable/', data: data);
  }

  /// POST /dashboard/generate-timetable/
  Future<Map<String, dynamic>> generateTimetable(Map<String, dynamic> data) async {
    final response = await _dio.post('/dashboard/generate-timetable/', data: data);
    return response.data as Map<String, dynamic>;
  }

  /// POST /dashboard/timetable/sync/
  Future<void> syncTimetable(Map<String, dynamic> data) async {
    await _dio.post('/dashboard/timetable/sync/', data: data);
  }

  /// GET /dashboard/student/timetable/
  Future<Map<String, dynamic>> getStudentTimetable() async {
    final response = await _dio.get('/dashboard/student/timetable/');
    return response.data as Map<String, dynamic>;
  }

  /// POST /dashboard/notify-timetable-change/
  Future<void> notifyTimetableChange(Map<String, dynamic> data) async {
    await _dio.post('/dashboard/notify-timetable-change/', data: data);
  }

  /// CRUD for timetable data entities (departments, subjects, teachers, rooms, sections).
  Future<List<dynamic>> getDataList(String entity) async {
    final response = await _dio.get('/dashboard/timetable-data/$entity/');
    return response.data[entity] as List<dynamic>;
  }

  Future<void> createDataItem(String entity, Map<String, dynamic> data) async {
    await _dio.post('/dashboard/timetable-data/$entity/', data: data);
  }

  Future<void> updateDataItem(String entity, Map<String, dynamic> data) async {
    await _dio.put('/dashboard/timetable-data/$entity/', data: data);
  }

  Future<void> deleteDataItem(String entity, Map<String, dynamic> data) async {
    await _dio.delete('/dashboard/timetable-data/$entity/', data: data);
  }
}
