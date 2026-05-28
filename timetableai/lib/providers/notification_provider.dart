import 'package:flutter/material.dart';
import '../models/notification.dart';
import '../services/notification_service.dart';

/// Manages notifications list and unread badge count.
class NotificationProvider extends ChangeNotifier {
  final NotificationService _service = NotificationService();

  List<AppNotification> _notifications = [];
  bool _loading = false;

  List<AppNotification> get notifications => _notifications;
  bool get loading => _loading;
  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  Future<void> fetchNotifications({bool isStudent = false}) async {
    _loading = true;
    notifyListeners();

    try {
      _notifications = isStudent
          ? await _service.getStudentNotifications()
          : await _service.getNotifications();
    } catch (e) {
      // Silently fail — notifications are non-critical.
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> markRead(int id) async {
    try {
      await _service.markRead(id);
      final idx = _notifications.indexWhere((n) => n.id == id);
      if (idx != -1) {
        _notifications[idx] = AppNotification(
          id: _notifications[idx].id,
          message: _notifications[idx].message,
          isRead: true,
          notificationType: _notifications[idx].notificationType,
          createdAt: _notifications[idx].createdAt,
        );
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      await _service.markAllRead();
      _notifications = _notifications
          .map((n) => AppNotification(
                id: n.id,
                message: n.message,
                isRead: true,
                notificationType: n.notificationType,
                createdAt: n.createdAt,
              ))
          .toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> deleteNotification(int id) async {
    try {
      await _service.deleteNotification(id);
      _notifications.removeWhere((n) => n.id == id);
      notifyListeners();
    } catch (_) {}
  }
}
