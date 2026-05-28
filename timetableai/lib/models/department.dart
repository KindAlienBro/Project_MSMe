/// Mirrors Django `Department` and `Subject` models.
class Department {
  final int id;
  final String deptName;
  final List<Subject> subjects;

  Department({
    required this.id,
    required this.deptName,
    this.subjects = const [],
  });

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: json['id'] as int,
      deptName: json['dept_name'] as String,
      subjects: (json['subjects'] as List<dynamic>?)
              ?.map((s) => Subject.fromJson(s as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class Subject {
  final int id;
  final String subjectName;
  final String subjectCode;
  final int? creditHours;
  final String? type; // THEORY or LAB

  Subject({
    required this.id,
    required this.subjectName,
    required this.subjectCode,
    this.creditHours,
    this.type,
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: json['id'] as int,
      subjectName: json['subject_name'] as String,
      subjectCode: json['subject_code'] as String,
      creditHours: json['credit_hours'] as int?,
      type: json['type'] as String?,
    );
  }
}
