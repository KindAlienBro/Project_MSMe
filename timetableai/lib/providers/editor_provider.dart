import 'package:flutter/material.dart';
import '../services/dashboard_service.dart';

class EditorProvider extends ChangeNotifier {
  final DashboardService _service = DashboardService();
  
  Map<String, dynamic> _timetable = {};
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;

  Map<String, dynamic> get timetable => _timetable;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get error => _error;

  Future<void> fetchTimetable() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _service.getSchedule();
      if (response['schedule'] != null) {
        // Deep copy the schedule to allow mutations
        _timetable = Map<String, dynamic>.from(response['schedule'] as Map);
      }
    } catch (e) {
      _error = 'Failed to load timetable for editing: $e';
    }

    _isLoading = false;
    notifyListeners();
  }

  void updateClassSlot(String taskId, String newDayName, int newDayIndex, int newPeriodIndex) {
    if (!_timetable.containsKey(taskId)) return;

    final Map<String, dynamic> classData = Map<String, dynamic>.from(_timetable[taskId] as Map);
    
    // Check if there is already a class at this day and period for the same section
    // If so, swap them
    final targetSection = classData['section_id'];
    String? existingTaskIdToSwap;
    
    _timetable.forEach((k, v) {
      if (k != taskId && v is Map && v['section_id'] == targetSection) {
        if (v['day_index'] == newDayIndex && v['period_index'] == newPeriodIndex) {
          existingTaskIdToSwap = k;
        }
      }
    });

    if (existingTaskIdToSwap != null) {
      final existingData = Map<String, dynamic>.from(_timetable[existingTaskIdToSwap] as Map);
      existingData['day_name'] = classData['day_name'];
      existingData['day_index'] = classData['day_index'];
      existingData['period_index'] = classData['period_index'];
      existingData['start_time'] = classData['start_time'];
      existingData['end_time'] = classData['end_time'];
      _timetable[existingTaskIdToSwap!] = existingData;
    }

    classData['day_name'] = newDayName;
    classData['day_index'] = newDayIndex;
    classData['period_index'] = newPeriodIndex;
    
    // Update start_time and end_time based on new period index
    const startTimes = {0: "8:45", 1: "9:40", 2: "10:50", 3: "11:45", 4: "1:40", 5: "2:35", 6: "3:30", 7: "4:25"};
    const endTimes = {0: "9:40", 1: "10:35", 2: "11:45", 3: "12:40", 4: "2:35", 5: "3:30", 6: "4:25", 7: "5:20"};
    
    classData['start_time'] = startTimes[newPeriodIndex] ?? '';
    classData['end_time'] = endTimes[newPeriodIndex] ?? '';

    _timetable[taskId] = classData;
    notifyListeners();
  }

  Future<bool> saveChanges() async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      await _service.updateTimetable({'schedule': _timetable});
      _isSaving = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to save changes: $e';
      _isSaving = false;
      notifyListeners();
      return false;
    }
  }
}
