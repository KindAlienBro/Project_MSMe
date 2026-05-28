import 'package:flutter/material.dart';
import '../services/dashboard_service.dart';

/// Manages dashboard stats and schedule data.
class DashboardProvider extends ChangeNotifier {
  final DashboardService _service = DashboardService();

  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _schedule;
  Map<String, dynamic>? _studentTimetable;
  bool _loading = false;
  String? _error;

  Map<String, dynamic>? get stats => _stats;
  Map<String, dynamic>? get schedule => _schedule;
  Map<String, dynamic>? get studentTimetable => _studentTimetable;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> fetchStats() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _stats = await _service.getStats();
    } catch (e) {
      _error = 'Failed to load stats.';
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> fetchSchedule() async {
    _loading = true;
    notifyListeners();

    try {
      _schedule = await _service.getSchedule();
    } catch (e) {
      _error = 'Failed to load schedule.';
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> fetchStudentTimetable() async {
    _loading = true;
    notifyListeners();

    try {
      _studentTimetable = await _service.getStudentTimetable();
    } catch (e) {
      _error = 'Failed to load timetable.';
    }

    _loading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
