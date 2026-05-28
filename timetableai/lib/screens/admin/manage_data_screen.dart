import 'package:flutter/material.dart';
import 'data_list_screen.dart';

class ManageDataScreen extends StatelessWidget {
  const ManageDataScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Data')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCard(context, 'Subjects', 'subjects', Icons.class_),
          _buildCard(context, 'Teachers', 'faculties', Icons.people),
          _buildCard(context, 'Rooms', 'rooms', Icons.room),
          _buildCard(context, 'Sections', 'sections', Icons.group),
          _buildCard(context, 'Allocations', 'allocations', Icons.assignment),
        ],
      ),
    );
  }

  Widget _buildCard(BuildContext context, String title, String endpoint, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DataListScreen(
                title: title,
                entityEndpoint: endpoint,
              ),
            ),
          );
        },
      ),
    );
  }
}
