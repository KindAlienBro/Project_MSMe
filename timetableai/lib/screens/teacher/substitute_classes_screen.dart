import 'package:flutter/material.dart';
import '../../services/leave_service.dart';
import '../../models/leave_request.dart';
import '../../widgets/loading_shimmer.dart';
import 'package:intl/intl.dart';

class SubstituteClassesScreen extends StatefulWidget {
  const SubstituteClassesScreen({super.key});

  @override
  State<SubstituteClassesScreen> createState() => _SubstituteClassesScreenState();
}

class _SubstituteClassesScreenState extends State<SubstituteClassesScreen> {
  final LeaveService _service = LeaveService();
  bool _loading = true;
  List<SubstituteRequest> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    try {
      final requests = await _service.getSubstituteRequests();
      if (mounted) {
        setState(() {
          _requests = requests;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load substitute requests: $e')),
        );
      }
    }
  }

  Future<void> _respond(int id, String action) async {
    setState(() => _loading = true);
    try {
      await _service.respondToSubstitute(id, action);
      _fetchRequests();
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to respond: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Substitute Classes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showRequestDialog(context),
          ),
        ],
      ),
      body: _loading
          ? const LoadingShimmer(itemCount: 5)
          : _requests.isEmpty
              ? const Center(child: Text('No substitute requests.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _requests.length,
                  itemBuilder: (context, index) {
                    final req = _requests[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Request #${req.id}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                _buildStatusBadge(req.status),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('Original Teacher: ${req.originalTeacherName}'),
                            Text('Substitute: ${req.substituteTeacherName ?? 'Unassigned'}'),
                            Text('Date: ${DateFormat('MMM dd, yyyy').format(req.date)}'),
                            const SizedBox(height: 12),
                            if (req.status == 'PENDING')
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => _respond(req.id, 'REJECT'),
                                    child: const Text('Reject', style: TextStyle(color: Colors.red)),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => _respond(req.id, 'APPROVE'),
                                    child: const Text('Approve'),
                                  ),
                                ],
                              )
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    switch (status.toUpperCase()) {
      case 'APPROVED':
        color = Colors.green;
        break;
      case 'REJECTED':
        color = Colors.red;
        break;
      default:
        color = Colors.orange;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }

  Future<void> _showRequestDialog(BuildContext context) async {
    // simplified modal for Phase 1
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Request Substitute'),
        content: const Text('Please use the Web Dashboard to request new substitutes for now.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))
        ],
      ),
    );
  }
}
