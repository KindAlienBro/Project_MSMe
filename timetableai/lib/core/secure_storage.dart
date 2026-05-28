import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

/// Thin wrapper around [FlutterSecureStorage] for JWT token management.
class SecureStorage {
  static const _storage = FlutterSecureStorage();

  // ── Access Token ───────────────────────────────────────────────────
  static Future<void> saveAccessToken(String token) =>
      _storage.write(key: AppConstants.accessTokenKey, value: token);

  static Future<String?> getAccessToken() =>
      _storage.read(key: AppConstants.accessTokenKey);

  static Future<void> deleteAccessToken() =>
      _storage.delete(key: AppConstants.accessTokenKey);

  // ── Refresh Token ──────────────────────────────────────────────────
  static Future<void> saveRefreshToken(String token) =>
      _storage.write(key: AppConstants.refreshTokenKey, value: token);

  static Future<String?> getRefreshToken() =>
      _storage.read(key: AppConstants.refreshTokenKey);

  static Future<void> deleteRefreshToken() =>
      _storage.delete(key: AppConstants.refreshTokenKey);

  // ── Convenience ────────────────────────────────────────────────────
  static Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await saveAccessToken(access);
    await saveRefreshToken(refresh);
  }

  static Future<void> clearAll() async {
    await deleteAccessToken();
    await deleteRefreshToken();
  }
}
