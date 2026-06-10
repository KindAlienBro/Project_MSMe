import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../services/attendance_service.dart';
import '../../models/attendance.dart';
import '../../widgets/gradient_button.dart';

import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';

class TakeAttendanceScreen extends StatefulWidget {
  const TakeAttendanceScreen({super.key});

  @override
  State<TakeAttendanceScreen> createState() => _TakeAttendanceScreenState();
}

class _TakeAttendanceScreenState extends State<TakeAttendanceScreen> {
  final _service = AttendanceService();

  String? _section;
  String? _subjectCode;
  final String _subjectName = '';
  int _periodIndex = 0;

  bool _loadingStudents = false;
  List<AttendanceRecord> _students = [];

  bool _isSubmitting = false;
  List<Map<String, dynamic>> _todaysClasses = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _extractTeacherData();
    });
  }

  void _extractTeacherData() {
    final user = context.read<AuthProvider>().user;
    final provider = context.read<DashboardProvider>();
    if (user == null || provider.schedule == null) return;
    
    final raw = provider.schedule!['schedule'] as Map<String, dynamic>?;
    if (raw == null) return;

    final List<Map<String, dynamic>> classes = [];
    final today = DateFormat('EEEE').format(DateTime.now());

    raw.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        final faculty = value['faculty_name']?.toString().toLowerCase() ?? '';
        final dayName = value['day_name']?.toString() ?? '';
        
        final userFirstName = user.firstName.trim().toLowerCase();
        
        if (userFirstName.isNotEmpty && faculty.contains(userFirstName) && dayName == today) {
          String rawSection = value['section_id']?.toString() ?? '';
          String cleanSection = rawSection.split('-').first.toUpperCase(); // e.g. "6A"
          String displaySection = cleanSection;
          if (cleanSection.length == 2) {
             displaySection = "${cleanSection[0]} ${cleanSection[1]}"; // e.g. "6 A"
          }

          classes.add({
            'section': cleanSection, // Backend needs "6A"
            'display_section': displaySection, // UI shows "6 A"
            'subject_code': value['subject_code']?.toString() ?? '',
            'time': value['time_slot']?.toString() ?? '',
            'period_index': value['period_index'] ?? 0,
          });
        }
      }
    });

    classes.sort((a, b) => (a['period_index'] as int).compareTo(b['period_index'] as int));

    setState(() {
      _todaysClasses = classes;
    });
  }

  void _selectClass(Map<String, dynamic> cls) {
    setState(() {
      _section = cls['section'];
      _subjectCode = cls['subject_code'];
      _periodIndex = cls['period_index'] as int;
      _students = []; // reset students when changing class
    });
    _fetchStudents();
  }

  void _fetchStudents() async {
    if (_section == null || _section!.isEmpty) return;

    setState(() => _loadingStudents = true);
    try {
      final records = await _service.getStudentsForClass(_section!);
      setState(() {
        _students = records;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load students: $e')),
        );
      }
    } finally {
      setState(() => _loadingStudents = false);
    }
  }

  void _submitAttendance() async {
    setState(() => _isSubmitting = true);
    try {
      final user = context.read<AuthProvider>().user;
      await _service.submitAttendance(
        subjectCode: _subjectCode!,
        subjectName: _subjectName,
        section: _section!,
        facultyName: user?.firstName ?? 'Current Teacher', 
        date: DateTime.now().toIso8601String().split('T')[0],
        periodIndex: _periodIndex,
        timeSlot: 'Time',
        records: _students,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance submitted successfully!'), backgroundColor: Colors.green),
        );
        // Return to class list after submit
        setState(() {
          _students = [];
          _section = null;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        final statusCode = e.response?.statusCode;
        final serverError = e.response?.data?['error'] as String?;
        
        if (statusCode == 409) {
          // Already submitted — treat as success
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Attendance already submitted for this session.'),
              backgroundColor: Colors.orange,
            ),
          );
          setState(() {
            _students = [];
            _section = null;
          });
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(serverError ?? 'Failed to submit attendance.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit attendance.')),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Take Attendance'),
        actions: [
          if (_section != null) 
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: () {
                setState(() {
                  _section = null;
                  _students = [];
                });
              },
            )
        ],
      ),
      body: _section == null 
        ? _buildClassList()
        : _buildStudentList(),
    );
  }

  Widget _buildClassList() {
    if (_todaysClasses.isEmpty) {
      return const Center(child: Text("No classes scheduled for today."));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _todaysClasses.length,
      itemBuilder: (context, index) {
        final cls = _todaysClasses[index];
        final subCode = cls['subject_code'].toString().toUpperCase();
        return Card(
          elevation: 2,
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(subCode.isNotEmpty ? subCode.substring(0, 1) : '?'),
            ),
            title: Text('$subCode - Section ${cls['display_section']}', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Time: ${cls['time']} (Period ${cls['period_index']})'),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () => _selectClass(cls),
          ),
        );
      },
    );
  }

  Widget _buildStudentList() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3),
          width: double.infinity,
          child: Text(
            '${_subjectCode?.toUpperCase()} - Section $_section\nPeriod $_periodIndex',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            textAlign: TextAlign.center,
          ),
        ),
        if (_loadingStudents)
          const Expanded(child: Center(child: CircularProgressIndicator()))
        else if (_students.isEmpty)
          const Expanded(child: Center(child: Text('No students found.')))
        else
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: _students.length,
                    itemBuilder: (context, index) {
                      final student = _students[index];
                      return ListTile(
                        title: Text(student.studentName),
                        trailing: SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(value: 'P', label: Text('P', style: TextStyle(color: Colors.green))),
                            ButtonSegment(value: 'A', label: Text('A', style: TextStyle(color: Colors.red))),
                          ],
                          selected: {student.status},
                          onSelectionChanged: (Set<String> newSelection) {
                            setState(() {
                              student.status = newSelection.first;
                            });
                          },
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: GradientButton(
                    text: 'Submit Attendance',
                    isLoading: _isSubmitting,
                    onPressed: _submitAttendance,
                  ),
                )
              ],
            ),
          ),
      ],
    );
  }
}
