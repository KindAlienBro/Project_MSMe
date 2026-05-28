/// Mirrors the Django `LeaveRequest` and `SubstituteRequest` models.
class LeaveRequest {
  final int id;
  final String teacherName;
  final DateTime startDate;
  final DateTime endDate;
  final String reason;
  final String status; // PENDING, APPROVED, REJECTED
  final DateTime createdAt;

  LeaveRequest({
    required this.id,
    required this.teacherName,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  bool get isPending => status == 'PENDING';
  bool get isApproved => status == 'APPROVED';

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as int,
      teacherName: json['teacher_name'] as String? ?? '',
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      reason: json['reason'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class SubstituteRequest {
  final int id;
  final String originalTeacherName;
  final String? substituteTeacherName;
  final DateTime date;
  final String status; // PENDING, ACCEPTED, REJECTED
  final DateTime createdAt;

  SubstituteRequest({
    required this.id,
    required this.originalTeacherName,
    this.substituteTeacherName,
    required this.date,
    required this.status,
    required this.createdAt,
  });

  factory SubstituteRequest.fromJson(Map<String, dynamic> json) {
    return SubstituteRequest(
      id: json['id'] as int,
      originalTeacherName: json['original_teacher_name'] as String? ?? '',
      substituteTeacherName: json['substitute_teacher_name'] as String?,
      date: DateTime.parse(json['date'] as String),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
