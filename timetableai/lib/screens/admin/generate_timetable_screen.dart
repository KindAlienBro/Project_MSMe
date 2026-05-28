import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/dashboard_service.dart';
import '../../providers/dashboard_provider.dart';

class GenerateTimetableScreen extends StatefulWidget {
  const GenerateTimetableScreen({super.key});

  @override
  State<GenerateTimetableScreen> createState() => _GenerateTimetableScreenState();
}

class _GenerateTimetableScreenState extends State<GenerateTimetableScreen> {
  final DashboardService _service = DashboardService();
  bool _isGenerating = false;

  int _timeLimit = 30;

  Future<void> _generate() async {
    setState(() => _isGenerating = true);
    try {
      final response = await _service.generateTimetable({
        'time_limit_seconds': _timeLimit,
      });

      if (mounted) {
        // Automatically fetch the newly generated schedule
        context.read<DashboardProvider>().fetchSchedule();
        
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Generation Complete'),
            content: Text(
              'Status: ${response['status']}\n'
              '${response['message'] ?? 'Timetable generated successfully.'}',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate timetable: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Generate Timetable')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Configure Generation Time',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildSlider(
            label: 'Time Limit: $_timeLimit seconds',
            value: _timeLimit.toDouble(),
            min: 10,
            max: 300,
            divisions: 29,
            onChanged: (val) => setState(() => _timeLimit = val.toInt()),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _isGenerating ? null : _generate,
              child: _isGenerating
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Run Generator'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSlider({
    required String label,
    required double value,
    required double min,
    required double max,
    required int divisions,
    required ValueChanged<double> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
        Slider(
          value: value,
          min: min,
          max: max,
          divisions: divisions,
          onChanged: onChanged,
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}
