import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/today_timetable_card.dart';
import '../../models/timetable.dart';
import '../../models/user.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().user;
      final provider = context.read<DashboardProvider>();
      
      if (user != null) {
        if (user.isAdmin || user.isTeacher) {
          provider.fetchStats();
          provider.fetchSchedule();
        } else if (user.isStudent) {
          provider.fetchStudentTimetable();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox();

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${user.firstName} 👋'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              final provider = context.read<DashboardProvider>();
              if (user.isAdmin || user.isTeacher) {
                provider.fetchStats();
                provider.fetchSchedule();
              } else if (user.isStudent) {
                provider.fetchStudentTimetable();
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          final provider = context.read<DashboardProvider>();
          if (user.isAdmin || user.isTeacher) {
            await Future.wait([provider.fetchStats(), provider.fetchSchedule()]);
          } else if (user.isStudent) {
            await provider.fetchStudentTimetable();
          }
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (user.isAdmin || user.isTeacher) 
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: _buildAdminTeacherStats(),
                ),
              const SizedBox(height: 32),
              _buildTodaysClasses(user),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAdminTeacherStats() {
    return Consumer<DashboardProvider>(
      builder: (context, provider, child) {
        if (provider.loading && provider.stats == null) {
          return const Row(
            children: [
              Expanded(child: StatCardShimmer()),
              SizedBox(width: 16),
              Expanded(child: StatCardShimmer()),
            ],
          );
        }
        final stats = provider.stats;
        if (stats == null) return const SizedBox();

        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.2,
          children: [
            StatCard(
              icon: Icons.people,
              value: '${stats['total_teachers'] ?? 0}',
              label: 'Total Teachers',
              color: Colors.blue,
            ),
            StatCard(
              icon: Icons.school,
              value: '${stats['total_students'] ?? 0}',
              label: 'Total Students',
              color: Colors.teal,
            ),
            StatCard(
              icon: Icons.domain,
              value: '${stats['total_departments'] ?? 0}',
              label: 'Departments',
              color: Colors.purple,
            ),
            StatCard(
              icon: Icons.class_,
              value: '${stats['total_subjects'] ?? 0}',
              label: 'Subjects',
              color: Colors.orange,
            ),
          ],
        );
      },
    );
  }

  Widget _buildTodaysClasses(User user) {
    final isStudent = user.isStudent;
    return Consumer<DashboardProvider>(
      builder: (context, provider, child) {
        if (provider.loading && provider.schedule == null && provider.studentTimetable == null) {
          return const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: LoadingShimmer(itemCount: 3),
          );
        }

        final todayStr = _getTodayString();
        List<TimetableEntry> todaysClasses = [];

        if (isStudent && provider.studentTimetable != null) {
          final raw = provider.studentTimetable!['schedule'] as Map<String, dynamic>?;
          if (raw != null) {
             final grouped = _groupSchedule(raw, filterSection: user.studentProfile?.section);
             if (grouped[todayStr] != null) {
                 todaysClasses = (grouped[todayStr] as List).map((e) => TimetableEntry.fromJson(e as Map<String, dynamic>)).toList();
             }
          }
        } else if (!isStudent && provider.schedule != null) {
           final raw = provider.schedule!['schedule'] as Map<String, dynamic>?;
           if (raw != null) {
             final grouped = _groupSchedule(raw, filterTeacher: (!user.isAdmin && !user.isSuperTeacher) ? user.firstName : null);
             if (grouped[todayStr] != null) {
                 todaysClasses = (grouped[todayStr] as List).map((e) => TimetableEntry.fromJson(e as Map<String, dynamic>)).toList();
             }
           }
        }

        // Sort classes by start time
        todaysClasses.sort((a, b) => a.startTime.compareTo(b.startTime));

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: [
                  Text(
                    'Today\'s Schedule',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827), // gray-900
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (todaysClasses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF3F4F6)), // gray-100
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'No classes scheduled for today.',
                        style: TextStyle(color: Color(0xFF6B7280), fontSize: 14), // gray-500
                      ),
                    ],
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Column(
                  children: todaysClasses.map((entry) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: TodayTimetableCard(entry: entry),
                    );
                  }).toList(),
                ),
              ),
          ],
        );
      },
    );
  }

  String _getTodayString() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[DateTime.now().weekday - 1];
  }

  String _getStartTimeForPeriod(int? periodIndex) {
    if (periodIndex == null) return '';
    const times = {0: "8:45", 1: "9:40", 2: "10:50", 3: "11:45", 4: "1:40", 5: "2:35", 6: "3:30", 7: "4:25"};
    return times[periodIndex] ?? '';
  }

  String _getEndTimeForPeriod(int? periodIndex) {
    if (periodIndex == null) return '';
    const times = {0: "9:40", 1: "10:35", 2: "11:45", 3: "12:40", 4: "2:35", 5: "3:30", 6: "4:25", 7: "5:20"};
    return times[periodIndex] ?? '';
  }

  Map<String, dynamic> _groupSchedule(Map<String, dynamic> rawSchedule, {String? filterTeacher, String? filterSection}) {
    final Map<String, List<dynamic>> grouped = {};
    rawSchedule.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        if (filterTeacher != null && !(value['faculty_name']?.toString().toLowerCase().contains(filterTeacher.toLowerCase()) ?? false)) return;
        if (filterSection != null) {
          String fs = filterSection.toUpperCase();
          if (fs.contains('-')) fs = fs.split('-').last; // Extract '6A' from 'AIML-6A'
          if (!(value['section_id']?.toString().toUpperCase().startsWith(fs) ?? false)) return;
        }
        
        final day = value['day_name'] as String?;
        if (day != null) {
          final entry = {
            'subject_name': value['subject_name'] ?? value['subject_code'] ?? 'Unknown',
            'start_time': value['start_time'] ?? _getStartTimeForPeriod(value['period_index'] as int?),
            'end_time': value['end_time'] ?? _getEndTimeForPeriod(value['period_index'] as int?),
            'room_number': value['room_name'] ?? '',
            'teacher_name': value['faculty_name'] ?? '',
          };
          
          grouped.putIfAbsent(day, () => []);
          grouped[day]!.add(entry);
        }
      }
    });
    return grouped;
  }
}
