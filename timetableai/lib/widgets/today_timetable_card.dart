import 'package:flutter/material.dart';
import '../models/timetable.dart';
import 'package:intl/intl.dart';

enum ClassStatus { completed, current, upcoming }

class TodayTimetableCard extends StatelessWidget {
  final TimetableEntry entry;
  final bool isSubstituted; // Can add this later to model if needed
  final String? originalFaculty;

  const TodayTimetableCard({
    super.key,
    required this.entry,
    this.isSubstituted = false,
    this.originalFaculty,
  });

  ClassStatus _getStatus() {
    final now = DateTime.now();
    final currentMinutes = now.hour * 60 + now.minute;

    int parseTime(String timeStr) {
      if (timeStr.isEmpty) return 0;
      final parts = timeStr.trim().split(':');
      if (parts.length < 2) return 0;
      int h = int.tryParse(parts[0]) ?? 0;
      final m = int.tryParse(parts[1]) ?? 0;
      // Handle naive PM format if applicable (e.g. 1:40 is 13:40)
      if (h < 8 && h > 0) {
        h += 12;
      }
      return h * 60 + m;
    }

    final startMin = parseTime(entry.startTime);
    final endMin = parseTime(entry.endTime);

    if (currentMinutes >= endMin) return ClassStatus.completed;
    if (currentMinutes >= startMin && currentMinutes < endMin) {
      return ClassStatus.current;
    }
    return ClassStatus.upcoming;
  }

  @override
  Widget build(BuildContext context) {
    final status = _getStatus();

    Color borderColor;
    Color bgColor;
    if (isSubstituted) {
      borderColor = Colors.orange.shade300;
      bgColor = Colors.orange.shade50.withValues(alpha: 0.5);
    } else if (status == ClassStatus.current) {
      borderColor = Colors.blue.shade300;
      bgColor = Colors.blue.shade50.withValues(alpha: 0.4);
    } else {
      borderColor = Colors.grey.shade200;
      bgColor = Colors.white;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20), // matching p-5
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12), // matching rounded-xl
        border: Border.all(color: borderColor, width: status == ClassStatus.current ? 2 : 1),
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
          // Header Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.subjectName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827), // gray-900
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    if (entry.section.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Sec ${entry.section}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _buildStatusBadge(status),
            ],
          ),
          const SizedBox(height: 16),
          // Details Column
          Column(
            children: [
              _buildDetailRow(Icons.access_time, entry.timeSlot),
              const SizedBox(height: 8),
              _buildDetailRow(Icons.person_outline, entry.teacherName ?? 'Unknown Faculty'),
              if (isSubstituted && originalFaculty != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.person_outline, size: 14, color: Colors.orange.shade600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Original: $originalFaculty',
                        style: TextStyle(
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                          color: Colors.orange.shade600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              if (entry.roomNumber.isNotEmpty) ...[
                const SizedBox(height: 8),
                _buildDetailRow(Icons.location_on_outlined, entry.roomNumber),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(ClassStatus status) {
    if (isSubstituted) {
      return _Badge(
        label: 'Substitute',
        textColor: Colors.orange.shade700,
        bgColor: Colors.orange.shade100,
      );
    }
    switch (status) {
      case ClassStatus.current:
        return _Badge(
          label: 'Live',
          icon: Icons.flash_on,
          textColor: Colors.blue.shade700,
          bgColor: Colors.blue.shade100,
        );
      case ClassStatus.completed:
        return _Badge(
          label: 'Done',
          icon: Icons.check_circle_outline,
          textColor: Colors.green.shade700,
          bgColor: Colors.green.shade50,
        );
      case ClassStatus.upcoming:
        return _Badge(
          label: 'Upcoming',
          textColor: Colors.grey.shade600,
          bgColor: Colors.grey.shade100,
        );
    }
  }

  Widget _buildDetailRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey.shade600),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade700,
            ),
          ),
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color textColor;
  final Color bgColor;

  const _Badge({
    required this.label,
    this.icon,
    required this.textColor,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
