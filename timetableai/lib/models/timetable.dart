/// Mirrors the Django `Timetable` model.
class TimetableEntry {
  final int? id;
  final String day;
  final String startTime;
  final String endTime;
  final String subjectName;
  final String subjectCode;
  final String roomNumber;
  final String section;
  final String? teacherName;
  final String? subjectType; // THEORY or LAB

  TimetableEntry({
    this.id,
    required this.day,
    required this.startTime,
    required this.endTime,
    required this.subjectName,
    required this.subjectCode,
    required this.roomNumber,
    required this.section,
    this.teacherName,
    this.subjectType,
  });

  /// Time slot label e.g. "9:30 - 10:25"
  String get timeSlot => '$startTime - $endTime';

  factory TimetableEntry.fromJson(Map<String, dynamic> json) {
    // The API may send data in different formats depending on the endpoint.
    return TimetableEntry(
      id: json['id'] as int?,
      day: json['day'] as String? ?? '',
      startTime: json['start_time'] as String? ?? json['startTime'] as String? ?? '',
      endTime: json['end_time'] as String? ?? json['endTime'] as String? ?? '',
      subjectName: json['subject_name'] as String? ?? json['subject']?['subject_name'] as String? ?? '',
      subjectCode: json['subject_code'] as String? ?? json['subject']?['subject_code'] as String? ?? '',
      roomNumber: json['room_number'] as String? ?? json['room'] as String? ?? '',
      section: json['section'] as String? ?? '',
      teacherName: json['teacher_name'] as String? ?? json['teacher'] as String?,
      subjectType: json['subject_type'] as String? ?? json['type'] as String?,
    );
  }
}
