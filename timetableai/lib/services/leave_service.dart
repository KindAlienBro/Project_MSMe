import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/leave_request.dart';

/// Service for leave request and substitute request endpoints.
class LeaveService {
  final Dio _dio = ApiClient.instance;

  /// GET /dashboard/leave-requests/
  Future<List<LeaveRequest>> getLeaveRequests() async {
    final response = await _dio.get('/dashboard/leave-requests/');
    return (response.data as List)
        .map((l) => LeaveRequest.fromJson(l as Map<String, dynamic>))
        .toList();
  }

  /// POST /dashboard/leave-requests/
  Future<void> createLeaveRequest({
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    await _dio.post('/dashboard/leave-requests/', data: {
      'start_date': startDate,
      'end_date': endDate,
      'reason': reason,
    });
  }

  /// GET /dashboard/leave-requests/{id}/
  Future<LeaveRequest> getLeaveRequestDetail(int id) async {
    final response = await _dio.get('/dashboard/leave-requests/$id/');
    return LeaveRequest.fromJson(response.data as Map<String, dynamic>);
  }

  /// GET /dashboard/substitute-requests/
  Future<List<SubstituteRequest>> getSubstituteRequests() async {
    final response = await _dio.get('/dashboard/substitute-requests/');
    return (response.data as List)
        .map((s) => SubstituteRequest.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// POST /dashboard/substitute-requests/
  Future<void> createSubstituteRequest(Map<String, dynamic> data) async {
    await _dio.post('/dashboard/substitute-requests/', data: data);
  }

  /// POST /dashboard/substitute-requests/{id}/respond/
  Future<void> respondToSubstitute(int id, String action) async {
    await _dio.post('/dashboard/substitute-requests/$id/respond/', data: {
      'action': action,
    });
  }
}
