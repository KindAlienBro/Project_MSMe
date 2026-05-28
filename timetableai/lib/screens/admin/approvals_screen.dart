import 'package:flutter/material.dart';
import '../../services/account_service.dart';
import '../../widgets/loading_shimmer.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  final _service = AccountService();
  bool _loading = true;
  List<Map<String, dynamic>> _approvals = [];

  @override
  void initState() {
    super.initState();
    _fetchApprovals();
  }

  Future<void> _fetchApprovals() async {
    try {
      final apps = await _service.getApprovals();
      setState(() {
        _approvals = apps;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleAction(int id, bool approve) async {
    setState(() => _loading = true);
    try {
      if (approve) {
        await _service.approveAccount(id);
      } else {
        await _service.rejectAccount(id);
      }
      _fetchApprovals();
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to process approval.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Account Approvals')),
      body: _loading && _approvals.isEmpty
          ? const LoadingShimmer()
          : _approvals.isEmpty
              ? const Center(child: Text('No pending approvals.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _approvals.length,
                  itemBuilder: (context, index) {
                    final user = _approvals[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: CircleAvatar(
                          child: Text(user['first_name']?[0] ?? 'U'),
                        ),
                        title: Text('${user['first_name']} ${user['last_name']}'),
                        subtitle: Text('${user['email']}\nRole: ${user['role']}'),
                        isThreeLine: true,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.red),
                              onPressed: () => _handleAction(user['id'], false),
                            ),
                            IconButton(
                              icon: const Icon(Icons.check, color: Colors.green),
                              onPressed: () => _handleAction(user['id'], true),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
