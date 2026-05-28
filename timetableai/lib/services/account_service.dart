import 'package:dio/dio.dart';
import '../core/api_client.dart';

/// Service for account management (admin endpoints).
class AccountService {
  final Dio _dio = ApiClient.instance;

  /// GET /auth/approvals/ — pending account approvals.
  Future<List<Map<String, dynamic>>> getApprovals() async {
    final response = await _dio.get('/auth/approvals/');
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  /// POST /auth/approvals/{id}/approve/
  Future<void> approveAccount(int id) async {
    await _dio.post('/auth/approvals/$id/approve/');
  }

  /// POST /auth/approvals/{id}/reject/
  Future<void> rejectAccount(int id) async {
    await _dio.post('/auth/approvals/$id/reject/');
  }

  /// GET /auth/active/ — all active accounts.
  Future<List<Map<String, dynamic>>> getActiveAccounts() async {
    final response = await _dio.get('/auth/active/');
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  /// GET /auth/deactivated/ — deactivated accounts.
  Future<List<Map<String, dynamic>>> getDeactivatedAccounts() async {
    final response = await _dio.get('/auth/deactivated/');
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  /// DELETE /auth/{id}/delete/
  Future<void> deleteAccount(int id) async {
    await _dio.delete('/auth/$id/delete/');
  }

  /// POST /auth/{id}/reactivate/
  Future<void> reactivateAccount(int id) async {
    await _dio.post('/auth/$id/reactivate/');
  }

  /// POST /auth/{id}/toggle-super-teacher/
  Future<void> toggleSuperTeacher(int id) async {
    await _dio.post('/auth/$id/toggle-super-teacher/');
  }
}
