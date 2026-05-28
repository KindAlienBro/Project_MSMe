import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dashboard_provider.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/weekly_timetable_grid.dart';

class TimetableTab extends StatefulWidget {
  const TimetableTab({super.key});

  @override
  State<TimetableTab> createState() => _TimetableTabState();
}

class _TimetableTabState extends State<TimetableTab> {
  String _viewBy = 'Section'; // 'Section' or 'Teacher'
  String? _selectedValue;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox();

    final isAdminOrSuper = user.isAdmin || user.isSuperTeacher;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Weekly Timetable'),
        elevation: 0,
      ),
      body: Consumer<DashboardProvider>(
        builder: (context, provider, child) {
          if (provider.loading && provider.schedule == null && provider.studentTimetable == null) {
            return const LoadingShimmer(itemCount: 6, height: 100);
          }

          Map<String, dynamic>? raw;
          if (user.isStudent && provider.studentTimetable != null) {
            raw = provider.studentTimetable!['schedule'] as Map<String, dynamic>?;
          } else if (!user.isStudent && provider.schedule != null) {
            raw = provider.schedule!['schedule'] as Map<String, dynamic>?;
          }

          if (raw == null || raw.isEmpty) {
            return const Center(child: Text('No timetable data available.', style: TextStyle(color: Colors.grey)));
          }

          // Extract options for filters
          final Set<String> sections = {};
          final Set<String> teachers = {};
          
          raw.forEach((k, v) {
            if (v is Map) {
              if (v['section_id'] != null) {
                 // Convert '6A-E1' -> '6A'
                 sections.add(v['section_id'].toString().split('-')[0].toUpperCase());
              }
              if (v['faculty_name'] != null) teachers.add(v['faculty_name'].toString());
            }
          });

          final sectionList = sections.toList()..sort();
          final teacherList = teachers.toList()..sort();

          // Set default selected value
          if (isAdminOrSuper) {
            if (_selectedValue == null) {
              if (_viewBy == 'Section' && sectionList.isNotEmpty) {
                _selectedValue = sectionList.first;
              } else if (_viewBy == 'Teacher' && teacherList.isNotEmpty) {
                _selectedValue = teacherList.first;
              }
            } else {
              // Ensure selected value still exists in the list
              if (_viewBy == 'Section' && !sectionList.contains(_selectedValue)) {
                _selectedValue = sectionList.isNotEmpty ? sectionList.first : null;
              }
              if (_viewBy == 'Teacher' && !teacherList.contains(_selectedValue)) {
                _selectedValue = teacherList.isNotEmpty ? teacherList.first : null;
              }
            }
          }

          Map<String, dynamic>? timetableData;
          
          if (user.isStudent) {
            timetableData = _groupSchedule(raw, filterSection: user.studentProfile?.section);
          } else if (!isAdminOrSuper) {
            timetableData = _groupSchedule(raw, filterTeacher: user.firstName);
          } else {
            // Admin or Super Teacher
            if (_viewBy == 'Section') {
              timetableData = _groupSchedule(raw, filterSection: _selectedValue);
            } else {
              timetableData = _groupSchedule(raw, filterTeacher: _selectedValue);
            }
          }

          return Column(
            children: [
              if (isAdminOrSuper)
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      const Text('View By: ', style: TextStyle(fontWeight: FontWeight.bold)),
                      DropdownButton<String>(
                        value: _viewBy,
                        items: const [
                          DropdownMenuItem(value: 'Section', child: Text('Section')),
                          DropdownMenuItem(value: 'Teacher', child: Text('Teacher')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _viewBy = val;
                              _selectedValue = null; // Reset selection on switch
                            });
                          }
                        },
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: _selectedValue,
                          hint: const Text('Select'),
                          items: (_viewBy == 'Section' ? sectionList : teacherList)
                              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _selectedValue = val);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: (timetableData.isEmpty)
                    ? const Center(child: Text('No classes found for this selection.', style: TextStyle(color: Colors.grey)))
                    : SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: WeeklyTimetableGrid(timetableData: timetableData),
                      ),
              ),
            ],
          );
        },
      ),
    );
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
