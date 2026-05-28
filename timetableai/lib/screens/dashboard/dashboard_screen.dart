import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/notification_provider.dart';
import 'home_tab.dart';
import 'timetable_tab.dart';
import 'notifications_tab.dart';
import 'profile_tab.dart';
import 'menu_tab.dart';
import '../student/attendance_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    // Initial fetch for notifications to populate the badge.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().user;
      if (user != null) {
        context
            .read<NotificationProvider>()
            .fetchNotifications(isStudent: user.isStudent);
      }
    });
  }

  List<Widget> _buildScreens(bool isStudent, bool isTeacher, bool isAdmin) {
    if (isAdmin || isTeacher) {
      // Simplified bottom nav for Admin/Teacher: Home, Timetable, Menu
      return [
        const HomeTab(),
        const TimetableTab(),
        const NotificationsTab(),
        const MenuTab(),
      ];
    } else {
      // Student
      return [
        const HomeTab(),
        const TimetableTab(),
        const StudentAttendanceScreen(),
        const NotificationsTab(),
        const ProfileTab(),
      ];
    }
  }

  List<BottomNavigationBarItem> _buildNavItems(
      bool isStudent, bool isTeacher, bool isAdmin) {
    if (isAdmin || isTeacher) {
      return [
        const BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Home'),
        const BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), activeIcon: Icon(Icons.calendar_month), label: 'Schedule'),
        _buildNotificationNavItem(),
        const BottomNavigationBarItem(icon: Icon(Icons.menu_outlined), activeIcon: Icon(Icons.menu), label: 'Menu'),
      ];
    } else {
      // Student
      return [
        const BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Home'),
        const BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), activeIcon: Icon(Icons.calendar_month), label: 'Timetable'),
        const BottomNavigationBarItem(icon: Icon(Icons.checklist_rtl_outlined), activeIcon: Icon(Icons.checklist_rtl), label: 'Attendance'),
        _buildNotificationNavItem(),
        const BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
      ];
    }
  }

  BottomNavigationBarItem _buildNotificationNavItem() {
    return BottomNavigationBarItem(
      icon: Consumer<NotificationProvider>(
        builder: (context, notifProvider, child) {
          return Badge(
            isLabelVisible: notifProvider.unreadCount > 0,
            label: Text(notifProvider.unreadCount.toString()),
            child: const Icon(Icons.notifications_outlined),
          );
        },
      ),
      activeIcon: const Icon(Icons.notifications),
      label: 'Alerts',
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final screens = _buildScreens(user.isStudent, user.isTeacher, user.isAdmin);
    final navItems = _buildNavItems(user.isStudent, user.isTeacher, user.isAdmin);

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) {
          setState(() {
            _currentIndex = idx;
          });
        },
        type: BottomNavigationBarType.fixed,
        items: navItems,
      ),
    );
  }
}
