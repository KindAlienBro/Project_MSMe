import 'package:flutter/material.dart';
import '../../services/leave_service.dart';
import '../../models/leave_request.dart';
import '../../widgets/loading_shimmer.dart';
import 'package:intl/intl.dart';

class LeaveRequestScreen extends StatefulWidget {
  const LeaveRequestScreen({super.key});

  @override
  State<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

class _LeaveRequestScreenState extends State<LeaveRequestScreen> {
  final _service = LeaveService();
  bool _loading = true;
  List<LeaveRequest> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    try {
      final reqs = await _service.getLeaveRequests();
      setState(() {
        _requests = reqs;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _showNewRequestDialog() {
    final formKey = GlobalKey<FormState>();
    String reason = '';
    DateTime startDate = DateTime.now();
    DateTime endDate = DateTime.now();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('New Leave Request'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ListTile(
                      title: const Text('Start Date'),
                      subtitle: Text(DateFormat('yyyy-MM-dd').format(startDate)),
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: startDate,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null) setDialogState(() => startDate = d);
                      },
                    ),
                    ListTile(
                      title: const Text('End Date'),
                      subtitle: Text(DateFormat('yyyy-MM-dd').format(endDate)),
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: endDate,
                          firstDate: startDate,
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null) setDialogState(() => endDate = d);
                      },
                    ),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Reason'),
                      validator: (v) => v!.isEmpty ? 'Required' : null,
                      onSaved: (v) => reason = v!,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (formKey.currentState!.validate()) {
                      formKey.currentState!.save();
                      Navigator.pop(context);
                      setState(() => _loading = true);
                      await _service.createLeaveRequest(
                        startDate: DateFormat('yyyy-MM-dd').format(startDate),
                        endDate: DateFormat('yyyy-MM-dd').format(endDate),
                        reason: reason,
                      );
                      _fetchRequests();
                    }
                  },
                  child: const Text('Submit'),
                ),
              ],
            );
          }
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Requests')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showNewRequestDialog,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const LoadingShimmer()
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _requests.length,
              itemBuilder: (context, index) {
                final req = _requests[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text('${DateFormat('MMM d').format(req.startDate)} - ${DateFormat('MMM d').format(req.endDate)}'),
                    subtitle: Text(req.reason),
                    trailing: Chip(
                      label: Text(req.status, style: const TextStyle(fontSize: 12)),
                      backgroundColor: req.isApproved ? Colors.green.withValues(alpha: 0.1) : (req.isPending ? Colors.orange.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1)),
                      labelStyle: TextStyle(color: req.isApproved ? Colors.green : (req.isPending ? Colors.orange : Colors.red)),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
