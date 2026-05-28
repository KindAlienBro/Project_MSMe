import 'package:flutter/material.dart';
import '../models/timetable.dart';

class WeeklyTimetableGrid extends StatelessWidget {
  final Map<String, dynamic> timetableData;
  final String? title;

  const WeeklyTimetableGrid({
    super.key,
    required this.timetableData,
    this.title,
  });

  static const List<String> _days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  static const List<String> _headers = [
    "8:45 - 9:40",
    "9:40 - 10:35",
    "10:35 - 10:50",
    "10:50 - 11:45",
    "11:45 - 12:40",
    "12:40 - 1:40",
    "1:40 - 2:35",
    "2:35 - 3:30",
    "3:30 - 4:25",
    "4:25 - 5:20"
  ];

  Map<String, Color> _getPaletteForSubject(String subject) {
    int hash = 0;
    for (var i = 0; i < subject.length; i++) {
      hash = subject.codeUnitAt(i) + ((hash << 5) - hash);
    }
    hash = hash.abs();
    
    // Palettes matching web Tailwind colors roughly
    final palettes = [
      {'bg': const Color(0xFFEEF2FF), 'border': const Color(0xFFE0E7FF), 'textPrimary': const Color(0xFF3730A3), 'textSecondary': const Color(0xFF4F46E5), 'icon': const Color(0xFF6366F1)}, // Indigo
      {'bg': const Color(0xFFECFDF5), 'border': const Color(0xFFD1FAE5), 'textPrimary': const Color(0xFF065F46), 'textSecondary': const Color(0xFF059669), 'icon': const Color(0xFF10B981)}, // Emerald
      {'bg': const Color(0xFFFFF1F2), 'border': const Color(0xFFFFE4E6), 'textPrimary': const Color(0xFF9F1239), 'textSecondary': const Color(0xFFE11D48), 'icon': const Color(0xFFF43F5E)}, // Rose
      {'bg': const Color(0xFFFFFBEB), 'border': const Color(0xFFFEF3C7), 'textPrimary': const Color(0xFF92400E), 'textSecondary': const Color(0xFFD97706), 'icon': const Color(0xFFF59E0B)}, // Amber
      {'bg': const Color(0xFFECFEFF), 'border': const Color(0xFFCFFAFE), 'textPrimary': const Color(0xFF164E63), 'textSecondary': const Color(0xFF0891B2), 'icon': const Color(0xFF06B6D4)}, // Cyan
      {'bg': const Color(0xFFFDF4FF), 'border': const Color(0xFFFAE8FF), 'textPrimary': const Color(0xFF86198F), 'textSecondary': const Color(0xFFC026D3), 'icon': const Color(0xFFD946EF)}, // Fuchsia
    ];
    
    return palettes[hash % palettes.length];
  }

  @override
  Widget build(BuildContext context) {
    if (timetableData.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(40.0),
        child: Center(
          child: Text(
            'No schedule data available.',
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Text(
              title!,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
          const Divider(color: Color(0xFFF1F5F9)),
        ],
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeaderRow(),
                ..._days.asMap().entries.map((entry) {
                  return _buildDayRow(entry.key, entry.value);
                }),
              ],
            ),
          ),
        ),
      ],
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
      decoration: const BoxDecoration(
        border: Border(right: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      alignment: Alignment.center,
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Color(0xFF475569),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildDayRow(int dayIdx, String dayName) {
    final rawEntries = timetableData[dayName] as List<dynamic>? ?? [];
    final entries = rawEntries.map((e) => TimetableEntry.fromJson(e as Map<String, dynamic>)).toList();
    
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Row(
        children: [
          // Day Column
          Container(
            width: 80,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(right: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            alignment: Alignment.center,
            child: Text(
              dayName.substring(0, 3),
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF334155),
              ),
            ),
          ),
          // Periods
          ..._headers.map((header) {
            final isBreak = header == "10:35 - 10:50";
            final isLunch = header == "12:40 - 1:40";

            if (isBreak) {
              return Container(
                width: 140,
                color: Colors.orange.shade50.withValues(alpha: 0.5),
                padding: const EdgeInsets.all(8),
                alignment: Alignment.center,
                child: const Text(
                  '☕ BREAK',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange,
                    letterSpacing: 1.5,
                  ),
                ),
              );
            }

            if (isLunch) {
              return Container(
                width: 140,
                color: Colors.blue.shade50.withValues(alpha: 0.5),
                padding: const EdgeInsets.all(8),
                alignment: Alignment.center,
                child: const Text(
                  '🍽️ LUNCH',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
                    letterSpacing: 1.5,
                  ),
                ),
              );
            }

            // Find classes that fall in this header's time
            // Very naive matching for now as we just display the entries
            // The API doesn't guarantee period matching to exactly these headers, 
            // but we will do our best matching by startTime
            final headerStart = header.split('-')[0].trim();
            final matchingEntries = entries.where((e) {
              final eStart = e.startTime.trim();
              return eStart.startsWith(headerStart) || _normalizeTime(eStart) == _normalizeTime(headerStart);
            }).toList();

            return Container(
              width: 140,
              constraints: const BoxConstraints(minHeight: 100),
              decoration: const BoxDecoration(
                border: Border(
                  right: BorderSide(color: Color(0xFFF1F5F9), style: BorderStyle.solid),
                ),
              ),
              padding: const EdgeInsets.all(8),
              child: matchingEntries.isEmpty
                  ? const SizedBox()
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: matchingEntries.map((entry) => _buildClassCard(entry)).toList(),
                    ),
            );
          }),
        ],
      ),
    );
  }

  String _normalizeTime(String t) {
    // 9:40:00 -> 09:40
    final parts = t.split(':');
    if (parts.length >= 2) {
      return '${parts[0].padLeft(2, '0')}:${parts[1]}';
    }
    return t;
  }

  Widget _buildClassCard(TimetableEntry entry) {
    final palette = _getPaletteForSubject(entry.subjectName);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: palette['bg'],
        border: Border.all(color: palette['border']!),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            entry.subjectName,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: palette['textPrimary'],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.people, size: 12, color: palette['icon']),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  entry.teacherName ?? 'TBA',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: palette['textSecondary'],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (entry.roomNumber.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.location_on, size: 12, color: palette['icon']),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    entry.roomNumber,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: palette['textSecondary'],
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
