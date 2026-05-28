import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/notification.dart';

/// Service for notification endpoints.
class NotificationService {
  final Dio _dio = ApiClient.instance;

  /// GET /dashboard/notifications/
  Future<List<AppNotification>> getNotifications() async {
    final response = await _dio.get('/dashboard/notifications/');
    return (response.data as List)
        .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
        .toList();
  }

  /// POST /dashboard/notifications/{id}/read/
  Future<void> markRead(int id) async {
    await _dio.post('/dashboard/notifications/$id/read/');
  }

  /// POST /dashboard/notifications/mark-all-read/
  Future<void> markAllRead() async {
    await _dio.post('/dashboard/notifications/mark-all-read/');
  }

  /// DELETE /dashboard/notifications/{id}/
  Future<void> deleteNotification(int id) async {
    await _dio.delete('/dashboard/notifications/$id/');
  }

  /// GET /dashboard/student/notifications/
  Future<List<AppNotification>> getStudentNotifications() async {
    final response = await _dio.get('/dashboard/student/notifications/');
    return (response.data as List)
        .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
        .toList();
  }
}
