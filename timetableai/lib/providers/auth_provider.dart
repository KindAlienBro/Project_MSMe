import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../core/secure_storage.dart';

/// Manages authentication state across the app.
class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  User? _user;
  bool _loading = true;
  String? _error;

  User? get user => _user;
  bool get loading => _loading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;

  /// Called once at app start to check for existing tokens.
  Future<void> checkAuth() async {
    _loading = true;

    try {
      final token = await SecureStorage.getAccessToken();
      if (token != null) {
        _user = await _authService.getMe();
      }
    } catch (e) {
      // Token expired or invalid — clear it.
      await SecureStorage.clearAll();
      _user = null;
    }

    _loading = false;
    notifyListeners();
  }

  /// Login with email and password.
  Future<bool> login(String email, String password) async {
    _error = null;
    _loading = true;
    notifyListeners();

    try {
      final data = await _authService.login(email, password);
      await SecureStorage.saveTokens(
        access: data['access'] as String,
        refresh: data['refresh'] as String,
      );
      _user = await _authService.getMe();
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _extractError(e);
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  /// Logout — clear tokens and user state.
  Future<void> logout() async {
    await SecureStorage.clearAll();
    _user = null;
    _error = null;
    notifyListeners();
  }

  /// Register a new user.
  Future<bool> register(Map<String, dynamic> data) async {
    _error = null;
    _loading = true;
    notifyListeners();

    try {
      await _authService.register(data);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _extractError(e);
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  String _extractError(dynamic e) {
    if (e is Exception) {
      final str = e.toString();
      // Try to extract DioException response message.
      if (str.contains('DioException')) {
        if (str.contains('401') || str.contains('403')) {
          return 'Invalid credentials. Please try again.';
        } else if (str.contains('connectionError') || str.contains('SocketException') || str.contains('timed out')) {
          return 'Network error. Please check your internet connection.';
        }
        return 'Network request failed. Please try again.';
      }
      return str.replaceAll('Exception: ', '');
    }
    return 'An unexpected error occurred.';
  }
}
