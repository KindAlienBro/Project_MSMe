/// Mirrors the Django `Notification` model.
class AppNotification {
  final int id;
  final String message;
  final bool isRead;
  final String? notificationType;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.message,
    this.isRead = false,
    this.notificationType,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as int,
      message: json['message'] as String,
      isRead: json['is_read'] as bool? ?? false,
      notificationType: json['notification_type'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
