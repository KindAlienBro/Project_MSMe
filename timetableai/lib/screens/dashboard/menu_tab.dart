import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../admin/approvals_screen.dart';
import '../admin/manage_data_screen.dart';
import '../admin/generate_timetable_screen.dart';
import '../admin/compare_timetable_screen.dart';
import '../admin/change_history_screen.dart';
import '../teacher/substitute_classes_screen.dart';
import '../teacher/take_attendance_screen.dart';
import '../auth/login_screen.dart';

class MenuTab extends StatelessWidget {
  const MenuTab({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox();

    return Scaffold(
      appBar: AppBar(title: const Text('Menu')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user.isAdmin || user.isTeacher) ...[
            const _MenuSectionHeader(title: 'Timetable Operations'),
            if (user.isAdmin || user.isSuperTeacher) ...[
              _MenuTile(
                title: 'Generate Timetable',
                icon: Icons.auto_awesome,
                onTap: () => _navigate(context, const GenerateTimetableScreen()),
              ),
              _MenuTile(
                title: 'Compare Timetables',
                icon: Icons.compare_arrows,
                onTap: () => _navigate(context, const CompareTimetableScreen()),
              ),
              _MenuTile(
                title: 'Change History',
                icon: Icons.history,
                onTap: () => _navigate(context, const ChangeHistoryScreen()),
              ),
            ],
            _MenuTile(
              title: 'Take Attendance',
              icon: Icons.checklist_rtl,
              onTap: () => _navigate(context, const TakeAttendanceScreen()),
            ),
            _MenuTile(
              title: 'Substitute Classes',
              icon: Icons.swap_horiz,
              onTap: () => _navigate(context, const SubstituteClassesScreen()),
            ),
            const SizedBox(height: 16),
          ],
          
          if (user.isAdmin || user.isSuperTeacher) ...[
            const _MenuSectionHeader(title: 'Administration'),
            _MenuTile(
              title: 'Manage Data',
              icon: Icons.dataset,
              onTap: () => _navigate(context, const ManageDataScreen()),
            ),
            _MenuTile(
              title: 'Account Approvals',
              icon: Icons.how_to_reg,
              onTap: () => _navigate(context, const ApprovalsScreen()),
            ),
            const SizedBox(height: 16),
          ],
          
          const _MenuSectionHeader(title: 'Account'),
          _MenuTile(
            title: 'Logout',
            icon: Icons.logout,
            color: Colors.red,
            onTap: () async {
              final nav = Navigator.of(context, rootNavigator: true);
              await context.read<AuthProvider>().logout();
              nav.pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
    );
  }

  void _navigate(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => screen));
  }
}

class _MenuSectionHeader extends StatelessWidget {
  final String title;
  const _MenuSectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 8, top: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: Colors.grey,
          fontWeight: FontWeight.bold,
          fontSize: 12,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final String title;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  const _MenuTile({
    required this.title,
    required this.icon,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: color ?? Theme.of(context).colorScheme.primary),
        title: Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w500)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
