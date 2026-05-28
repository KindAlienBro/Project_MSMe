import 'package:flutter/material.dart';
import '../../services/dashboard_service.dart';
import '../../widgets/loading_shimmer.dart';

class CompareTimetableScreen extends StatefulWidget {
  const CompareTimetableScreen({super.key});

  @override
  State<CompareTimetableScreen> createState() => _CompareTimetableScreenState();
}

class _CompareTimetableScreenState extends State<CompareTimetableScreen> {
  final DashboardService _service = DashboardService();
  bool _loading = true;
  Map<String, dynamic>? _currentSchedule;
  Map<String, dynamic>? _draftSchedule;

  @override
  void initState() {
    super.initState();
    _fetchSchedules();
  }

  Future<void> _fetchSchedules() async {
    try {
      final current = await _service.getOriginalSchedule();
      final draft = await _service.getSchedule();
      
      if (mounted) {
        setState(() {
          _currentSchedule = current['schedule'] as Map<String, dynamic>?;
          _draftSchedule = draft['schedule'] as Map<String, dynamic>?;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load schedules: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compare Timetables')),
      body: _loading
          ? const LoadingShimmer(itemCount: 4)
          : _currentSchedule == null || _draftSchedule == null
              ? const Center(child: Text('Both schedules not available for comparison.'))
              : DefaultTabController(
                  length: 2,
                  child: Column(
                    children: [
                      const TabBar(
                        tabs: [
                          Tab(text: 'Current Timetable'),
                          Tab(text: 'Draft Timetable'),
                        ],
                        labelColor: Color(0xFF4F46E5),
                        indicatorColor: Color(0xFF4F46E5),
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _buildScheduleList(_currentSchedule!),
                            _buildScheduleList(_draftSchedule!),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildScheduleList(Map<String, dynamic> schedule) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: days.length,
      itemBuilder: (context, index) {
        final day = days[index];
        final entries = schedule[day] as List<dynamic>? ?? [];

        if (entries.isEmpty) return const SizedBox();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(day, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            ...entries.map((e) {
              final Map<String, dynamic> entry = e as Map<String, dynamic>;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(entry['subject_name'] ?? entry['subject_code'] ?? 'Unknown'),
                  subtitle: Text('${entry['start_time']} - ${entry['end_time']} | ${entry['teacher_name'] ?? 'TBA'}'),
                  trailing: Text(entry['room_number'] ?? ''),
                ),
              );
            }),
            const SizedBox(height: 16),
          ],
        );
      },
    );
  }
}
