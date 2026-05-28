/// Mirrors the Django `CustomUser` model + nested teacher/student profiles.
class User {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String? profilePhoto;
  final TeacherProfile? teacherProfile;
  final StudentProfile? studentProfile;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.profilePhoto,
    this.teacherProfile,
    this.studentProfile,
  });

  String get fullName => '$firstName $lastName';

  bool get isAdmin => role == 'ADMIN';
  bool get isSuperTeacher => role == 'SUPER_TEACHER';
  bool get isTeacher => role == 'TEACHER' || isSuperTeacher;
  bool get isStudent => role == 'STUDENT';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      role: json['role'] as String,
      profilePhoto: json['profile_photo'] as String?,
      teacherProfile: json['teacher_profile'] != null
          ? TeacherProfile.fromJson(json['teacher_profile'])
          : null,
      studentProfile: json['student_profile'] != null
          ? StudentProfile.fromJson(json['student_profile'])
          : null,
    );
  }
}

class TeacherProfile {
  final String? deptName;
  final String? designation;
  final String? phone;

  TeacherProfile({this.deptName, this.designation, this.phone});

  factory TeacherProfile.fromJson(Map<String, dynamic> json) {
    return TeacherProfile(
      deptName: json['dept_name'] as String?,
      designation: json['designation'] as String?,
      phone: json['phone'] as String?,
    );
  }
}

class StudentProfile {
  final String? deptName;
  final int semester;
  final int year;
  final String? registerNumber;
  final String? section;

  StudentProfile({
    this.deptName,
    this.semester = 1,
    this.year = 1,
    this.registerNumber,
    this.section,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> json) {
    return StudentProfile(
      deptName: json['dept_name'] as String?,
      semester: json['semester'] as int? ?? 1,
      year: json['year'] as int? ?? 1,
      registerNumber: json['register_number'] as String?,
      section: json['section'] as String?,
    );
  }
}
