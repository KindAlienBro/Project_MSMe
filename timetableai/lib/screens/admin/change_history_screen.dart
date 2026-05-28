import 'package:flutter/material.dart';
import '../../services/dashboard_service.dart';
import '../../widgets/loading_shimmer.dart';
import 'package:intl/intl.dart';

class ChangeHistoryScreen extends StatefulWidget {
  const ChangeHistoryScreen({super.key});

  @override
  State<ChangeHistoryScreen> createState() => _ChangeHistoryScreenState();
}

class _ChangeHistoryScreenState extends State<ChangeHistoryScreen> {
  final DashboardService _service = DashboardService();
  bool _loading = true;
  List<dynamic> _history = [];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final history = await _service.getChangeHistory();
      if (mounted) {
        setState(() {
          _history = history;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load history: $e')),
        );
      }
    }
  }

  String _formatDate(String isoString) {
    try {
      final date = DateTime.parse(isoString);
      return DateFormat('MMM dd, yyyy HH:mm').format(date);
    } catch (e) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change History')),
      body: _loading
          ? const LoadingShimmer(itemCount: 6)
          : _history.isEmpty
              ? const Center(child: Text('No history found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _history.length,
                  itemBuilder: (context, index) {
                    final item = _history[index] as Map<String, dynamic>;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFFF1F5F9),
                          child: Icon(Icons.history, color: Color(0xFF475569)),
                        ),
                        title: Text(item['action'] ?? 'Unknown Action'),
                        subtitle: Text(
                          'By: ${item['user_name'] ?? item['user'] ?? 'System'}\n'
                          '${item['details'] ?? ''}',
                        ),
                        isThreeLine: true,
                        trailing: Text(
                          _formatDate(item['timestamp'] ?? ''),
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
