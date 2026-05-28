// App-wide constants for the TimetableAI mobile app.

class AppConstants {
  AppConstants._();

  /// Base URL for the Django REST API hosted on VPS.
  static const String apiBaseUrl = 'https://timetableai.tech/api';

  /// Secure-storage keys.
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
}
