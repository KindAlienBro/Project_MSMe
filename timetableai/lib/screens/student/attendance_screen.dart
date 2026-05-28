import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/attendance_service.dart';
import '../../models/attendance.dart';
import '../../widgets/loading_shimmer.dart';

class StudentAttendanceScreen extends StatefulWidget {
  const StudentAttendanceScreen({super.key});

  @override
  State<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends State<StudentAttendanceScreen> {
  final _service = AttendanceService();
  bool _loading = true;
  List<SubjectAttendance> _attendance = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchAttendance();
  }

  Future<void> _fetchAttendance() async {
    try {
      final data = await _service.getMyAttendance();
      setState(() {
        _attendance = data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load attendance.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Attendance')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingShimmer();
    if (_error != null) return Center(child: Text(_error!));
    if (_attendance.isEmpty) {
      return const Center(child: Text('No attendance records found.'));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildOverallChart(),
        const SizedBox(height: 24),
        Text(
          'Subject-wise Details',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        ..._attendance.map((a) => _buildSubjectCard(a)),
      ],
    );
  }

  Widget _buildOverallChart() {
    int totalClasses = 0;
    int attendedClasses = 0;
    for (var a in _attendance) {
      totalClasses += a.totalClasses;
      attendedClasses += a.attendedClasses;
    }
    
    double overallPercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
        ],
      ),
      child: Column(
        children: [
          const Text('Overall Attendance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 24),
          SizedBox(
            height: 150,
            child: Stack(
              alignment: Alignment.center,
              children: [
                PieChart(
                  PieChartData(
                    sectionsSpace: 0,
                    centerSpaceRadius: 50,
                    sections: [
                      PieChartSectionData(
                        value: attendedClasses.toDouble(),
                        color: Colors.green,
                        radius: 15,
                        showTitle: false,
                      ),
                      PieChartSectionData(
                        value: (totalClasses - attendedClasses).toDouble(),
                        color: Colors.red.shade400,
                        radius: 15,
                        showTitle: false,
                      ),
                    ],
                  ),
                ),
                Text(
                  '${overallPercentage.toStringAsFixed(1)}%',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubjectCard(SubjectAttendance att) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? const Color(0xFF334155) : Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  att.subjectName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 4),
                Text(
                  '${att.attendedClasses} / ${att.totalClasses} classes attended',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: att.percentage >= 75 ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${att.percentage.toStringAsFixed(1)}%',
              style: TextStyle(
                color: att.percentage >= 75 ? Colors.green : Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
