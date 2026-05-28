import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/user.dart';
import '../models/department.dart';

/// Service for authentication and user account endpoints.
class AuthService {
  final Dio _dio = ApiClient.instance;

  /// POST /token/ — obtain JWT pair.
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post('/token/', data: {
      'email': email,
      'password': password,
    });
    return response.data as Map<String, dynamic>;
  }

  /// POST /auth/register/ — register a new user.
  Future<void> register(Map<String, dynamic> data) async {
    await _dio.post('/auth/register/', data: data);
  }

  /// GET /auth/me/ — fetch current user profile.
  Future<User> getMe() async {
    final response = await _dio.get('/auth/me/');
    return User.fromJson(response.data as Map<String, dynamic>);
  }

  /// POST /token/refresh/ — refresh access token.
  Future<String> refreshToken(String refresh) async {
    final response = await _dio.post('/token/refresh/', data: {
      'refresh': refresh,
    });
    return response.data['access'] as String;
  }

  /// GET /auth/departments/ — list all departments with subjects.
  Future<List<Department>> getDepartments() async {
    final response = await _dio.get('/auth/departments/');
    return (response.data as List)
        .map((d) => Department.fromJson(d as Map<String, dynamic>))
        .toList();
  }
}
