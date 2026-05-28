import 'package:dio/dio.dart';
import 'constants.dart';
import 'secure_storage.dart';

/// Configured [Dio] client with JWT auth interceptors.
///
/// Automatically attaches the Bearer token to every request and handles
/// 401 responses by refreshing the token.
class ApiClient {
  ApiClient._();

  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 120),
      receiveTimeout: const Duration(seconds: 120),
      headers: {'Content-Type': 'application/json'},
    ),
  )..interceptors.add(_AuthInterceptor());

  /// Public accessor so services can use the single shared instance.
  static Dio get instance => _dio;
}

// ─── Auth Interceptor ──────────────────────────────────────────────────────

class _AuthInterceptor extends Interceptor {
  bool _isRefreshing = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Only attempt refresh on 401 and when not already refreshing.
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken = await SecureStorage.getRefreshToken();
        if (refreshToken == null) {
          await SecureStorage.clearAll();
          return handler.next(err);
        }

        // Use a fresh Dio instance so we don't trigger this interceptor again.
        final refreshDio = Dio(
          BaseOptions(baseUrl: AppConstants.apiBaseUrl),
        );

        final response = await refreshDio.post(
          '/token/refresh/',
          data: {'refresh': refreshToken},
        );

        final newAccess = response.data['access'] as String;
        await SecureStorage.saveAccessToken(newAccess);

        // Retry the original request with the new token.
        final options = err.requestOptions;
        options.headers['Authorization'] = 'Bearer $newAccess';

        final retryResponse = await ApiClient.instance.fetch(options);
        return handler.resolve(retryResponse);
      } on DioException {
        // Refresh failed — clear tokens (force re-login).
        await SecureStorage.clearAll();
        return handler.next(err);
      } finally {
        _isRefreshing = false;
      }
    }

    handler.next(err);
  }
}
