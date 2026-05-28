import 'package:flutter/material.dart';
import '../../services/dashboard_service.dart';
import '../../widgets/loading_shimmer.dart';

class DataListScreen extends StatefulWidget {
  final String title;
  final String entityEndpoint;

  const DataListScreen({
    super.key,
    required this.title,
    required this.entityEndpoint,
  });

  @override
  State<DataListScreen> createState() => _DataListScreenState();
}

class _DataListScreenState extends State<DataListScreen> {
  final DashboardService _service = DashboardService();
  bool _loading = true;
  List<dynamic> _items = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final items = await _service.getDataList(widget.entityEndpoint);
      if (mounted) {
        setState(() {
          _items = items;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load ${widget.title}: $e')),
        );
      }
    }
  }

  Future<void> _deleteItem(Map<String, dynamic> item) async {
    setState(() => _loading = true);
    try {
      await _service.deleteDataItem(widget.entityEndpoint, {'id': item['id']});
      _fetchData();
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete item: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please use the Web Dashboard for creating complex data records.')),
              );
            },
          )
        ],
      ),
      body: _loading
          ? const LoadingShimmer(itemCount: 8)
          : _items.isEmpty
              ? const Center(child: Text('No records found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length,
                  itemBuilder: (context, index) {
                    final item = _items[index] as Map<String, dynamic>;
                    // Extract a generic title from whatever fields the backend returns
                    final isAllocation = item.containsKey('faculty_id') && item.containsKey('subject_code');
                    final name = isAllocation 
                        ? '${item['subject_code']} (${item['section_id']})'
                        : (item['name'] ?? item['full_name'] ?? item['subject_name'] ?? item['room_number'] ?? item['id'] ?? 'Unknown');
                    final sub = isAllocation
                        ? 'Faculty: ${item['faculty_id']}'
                        : (item['code'] ?? item['email'] ?? item['department'] ?? item['building'] ?? '');

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text(name),
                        subtitle: sub.isNotEmpty ? Text(sub.toString()) : null,
                        trailing: IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _deleteItem(item),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
