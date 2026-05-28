/// Mirrors Django `AttendanceSession` and `AttendanceRecord` models.
class AttendanceSession {
  final int id;
  final String subjectCode;
  final String subjectName;
  final String section;
  final String facultyName;
  final DateTime date;
  final int periodIndex;
  final String timeSlot;

  AttendanceSession({
    required this.id,
    required this.subjectCode,
    required this.subjectName,
    required this.section,
    required this.facultyName,
    required this.date,
    required this.periodIndex,
    required this.timeSlot,
  });

  factory AttendanceSession.fromJson(Map<String, dynamic> json) {
    return AttendanceSession(
      id: json['id'] as int,
      subjectCode: json['subject_code'] as String,
      subjectName: json['subject_name'] as String? ?? '',
      section: json['section'] as String,
      facultyName: json['faculty_name'] as String? ?? '',
      date: DateTime.parse(json['date'] as String),
      periodIndex: json['period_index'] as int,
      timeSlot: json['time_slot'] as String? ?? '',
    );
  }
}

class AttendanceRecord {
  final int studentId;
  final String studentName;
  String status; // 'P' or 'A'

  AttendanceRecord({
    required this.studentId,
    required this.studentName,
    this.status = 'P',
  });

  bool get isPresent => status == 'P';

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      studentId: json['student_id'] as int? ?? json['id'] as int,
      studentName: json['student_name'] as String? ?? json['name'] as String? ??
          '${json['first_name'] ?? ''} ${json['last_name'] ?? ''}'.trim(),
      status: json['status'] as String? ?? 'P',
    );
  }

  Map<String, dynamic> toJson() => {
        'student_id': studentId,
        'status': status,
      };
}

/// Aggregated per-subject attendance for a student.
class SubjectAttendance {
  final String subjectCode;
  final String subjectName;
  final int totalClasses;
  final int attendedClasses;

  SubjectAttendance({
    required this.subjectCode,
    required this.subjectName,
    required this.totalClasses,
    required this.attendedClasses,
  });

  double get percentage =>
      totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

  factory SubjectAttendance.fromJson(Map<String, dynamic> json) {
    return SubjectAttendance(
      subjectCode: json['subject_code'] as String,
      subjectName: json['subject_name'] as String? ?? '',
      totalClasses: json['total_classes'] as int? ?? 0,
      attendedClasses: json['attended_classes'] as int? ?? 0,
    );
  }
}
