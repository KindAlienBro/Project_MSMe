import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/editor_provider.dart';
import '../../widgets/loading_shimmer.dart';

class DragDropEditorScreen extends StatefulWidget {
  const DragDropEditorScreen({super.key});

  @override
  State<DragDropEditorScreen> createState() => _DragDropEditorScreenState();
}

class _DragDropEditorScreenState extends State<DragDropEditorScreen> {
  final List<String> _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  static const List<String> _headers = [
    "8:45 - 9:40", "9:40 - 10:35", "10:35 - 10:50", "10:50 - 11:45",
    "11:45 - 12:40", "12:40 - 1:40", "1:40 - 2:35", "2:35 - 3:30", "3:30 - 4:25", "4:25 - 5:20"
  ];
  
  String _viewBy = 'Section';
  String? _selectedValue;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EditorProvider>().fetchTimetable();
    });
  }

  void _saveChanges(BuildContext context) async {
    final success = await context.read<EditorProvider>().saveChanges();
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Timetable updated successfully!'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      } else {
        final error = context.read<EditorProvider>().error;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error ?? 'Failed to save changes'), backgroundColor: Colors.red),
        );
      }
    }
  }

  int? _headerIndexToPeriodIndex(int headerIndex) {
    if (headerIndex == 2 || headerIndex == 5) return null; // Break and Lunch
    if (headerIndex < 2) return headerIndex;
    if (headerIndex < 5) return headerIndex - 1;
    return headerIndex - 2;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Drag & Drop Editor'),
        actions: [
          Consumer<EditorProvider>(
            builder: (context, provider, child) {
              return TextButton.icon(
                onPressed: provider.isSaving ? null : () => _saveChanges(context),
                icon: provider.isSaving 
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.save, color: Colors.white),
                label: const Text('Save', style: TextStyle(color: Colors.white)),
              );
            },
          ),
        ],
      ),
      body: Consumer<EditorProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const LoadingShimmer(itemCount: 6, height: 100);
          }
          if (provider.timetable.isEmpty) {
            return const Center(child: Text('No timetable data available to edit.', style: TextStyle(color: Colors.grey)));
          }

          // Extract options for filters
          final Set<String> sections = {};
          final Set<String> teachers = {};
          
          provider.timetable.forEach((taskId, v) {
            if (v is Map) {
              if (v['section_id'] != null) {
                sections.add(v['section_id'].toString().split('-')[0].toUpperCase());
              }
              if (v['faculty_name'] != null) teachers.add(v['faculty_name'].toString());
            }
          });

          final sectionList = sections.toList()..sort();
          final teacherList = teachers.toList()..sort();

          if (_selectedValue == null) {
            if (_viewBy == 'Section' && sectionList.isNotEmpty) _selectedValue = sectionList.first;
            else if (_viewBy == 'Teacher' && teacherList.isNotEmpty) _selectedValue = teacherList.first;
          } else {
            if (_viewBy == 'Section' && !sectionList.contains(_selectedValue)) _selectedValue = sectionList.isNotEmpty ? sectionList.first : null;
            if (_viewBy == 'Teacher' && !teacherList.contains(_selectedValue)) _selectedValue = teacherList.isNotEmpty ? teacherList.first : null;
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Text('Filter Edit By: ', style: TextStyle(fontWeight: FontWeight.bold)),
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
                            _selectedValue = null;
                          });
                        }
                      },
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButton<String>(
                        isExpanded: true,
                        value: _selectedValue,
                        hint: const Text('Select a filter'),
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
                child: SingleChildScrollView(
                  scrollDirection: Axis.vertical,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Container(
                      margin: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildHeaderRow(),
                          ..._days.asMap().entries.map((entry) => _buildDayRow(entry.key, entry.value, provider)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHeaderRow() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          _buildHeaderCell('Day', width: 80),
          ..._headers.map((h) => _buildHeaderCell(h)),
        ],
      ),
    );
  }

  Widget _buildHeaderCell(String text, {double width = 140}) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: const BoxDecoration(border: Border(right: BorderSide(color: Color(0xFFF1F5F9)))),
      alignment: Alignment.center,
      child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
    );
  }

  Widget _buildDayRow(int dayIdx, String dayName, EditorProvider provider) {
    return Container(
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9)))),
      child: Row(
        children: [
          Container(
            width: 80,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            decoration: const BoxDecoration(color: Colors.white, border: Border(right: BorderSide(color: Color(0xFFF1F5F9)))),
            alignment: Alignment.center,
            child: Text(dayName.substring(0, 3), style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF334155))),
          ),
          ..._headers.asMap().entries.map((entry) {
            final headerIdx = entry.key;
            final periodIdx = _headerIndexToPeriodIndex(headerIdx);

            if (headerIdx == 2) {
              return Container(
                width: 140, color: Colors.orange.shade50.withValues(alpha: 0.5), alignment: Alignment.center,
                child: const Text('☕ BREAK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orange)),
              );
            }
            if (headerIdx == 5) {
              return Container(
                width: 140, color: Colors.blue.shade50.withValues(alpha: 0.5), alignment: Alignment.center,
                child: const Text('🍽️ LUNCH', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.blue)),
              );
            }

            // Find classes in this cell that match the filter
            final cellClasses = provider.timetable.entries.where((e) {
              final val = e.value as Map<String, dynamic>;
              if (val['day_index'] != dayIdx || val['period_index'] != periodIdx) return false;
              if (_selectedValue == null) return false;
              if (_viewBy == 'Section' && !(val['section_id']?.toString().toUpperCase().startsWith(_selectedValue!.toUpperCase()) ?? false)) return false;
              if (_viewBy == 'Teacher' && !(val['faculty_name']?.toString().toLowerCase().contains(_selectedValue!.toLowerCase()) ?? false)) return false;
              return true;
            }).toList();

            return DragTarget<String>(
              onAcceptWithDetails: (details) {
                provider.updateClassSlot(details.data, dayName, dayIdx, periodIdx!);
              },
              builder: (context, candidateData, rejectedData) {
                return Container(
                  width: 140,
                  constraints: const BoxConstraints(minHeight: 100),
                  decoration: BoxDecoration(
                    color: candidateData.isNotEmpty ? Colors.green.shade50 : Colors.transparent,
                    border: Border(right: const BorderSide(color: Color(0xFFF1F5F9))),
                  ),
                  padding: const EdgeInsets.all(8),
                  child: cellClasses.isEmpty
                      ? const SizedBox()
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.start,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: cellClasses.map((e) => _buildDraggableClass(e.key, e.value)).toList(),
                        ),
                );
              },
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDraggableClass(String taskId, dynamic item) {
    return LongPressDraggable<String>(
      data: taskId,
      feedback: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 120,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.blue),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(item['subject_name'] ?? item['subject_code'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
              Text(item['faculty_name'] ?? '', style: const TextStyle(fontSize: 9)),
            ],
          ),
        ),
      ),
      childWhenDragging: Opacity(
        opacity: 0.3,
        child: _buildClassCard(item),
      ),
      child: _buildClassCard(item),
    );
  }

  Widget _buildClassCard(dynamic item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF2FF),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item['subject_name'] ?? item['subject_code'] ?? 'Unknown',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF3730A3)),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.person, size: 10, color: Color(0xFF6366F1)),
              const SizedBox(width: 2),
              Expanded(
                child: Text(
                  item['faculty_name'] ?? 'TBA',
                  style: const TextStyle(fontSize: 10, color: Color(0xFF4F46E5)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
