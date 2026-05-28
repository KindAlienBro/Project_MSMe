"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  UserCog,
  Bell,
  Settings,
  LogOut,
  GitCompare,
  History,
  Database,
  GripVertical,
  ClipboardList,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER', 'STUDENT'] },
  { name: 'Timetable', icon: Calendar, href: '/dashboard/timetable', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER', 'STUDENT'] },
  { name: 'Attendance', icon: ClipboardList, href: '/dashboard/attendance', roles: ['STUDENT'] },
  { name: 'Timetable Generator', icon: Calendar, href: '/dashboard/generate-timetable', roles: ['ADMIN', 'SUPER_TEACHER'] },
  { name: 'Drag & Drop Editor', icon: GripVertical, href: '/dashboard/drag-drop-editor', roles: ['ADMIN', 'SUPER_TEACHER'] },
  { name: 'Compare Timetables', icon: GitCompare, href: '/dashboard/compare-timetable', roles: ['ADMIN', 'SUPER_TEACHER'] },
  { name: 'Change History', icon: History, href: '/dashboard/change-history', roles: ['ADMIN', 'SUPER_TEACHER'] },
  { name: 'Manage Data', icon: Database, href: '/dashboard/manage-data', roles: ['ADMIN', 'SUPER_TEACHER'] },
  { name: 'Manage Accounts', icon: ShieldCheck, href: '/dashboard/account-approvals', roles: ['ADMIN'] },
  { name: 'Timetable Approvals', icon: CheckCircle, href: '/dashboard/timetable-approvals', roles: ['ADMIN'] },
  { name: 'Leave Requests', icon: FileText, href: '/dashboard/leave-requests', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER'] },
  { name: 'Substitute Classes', icon: UserCog, href: '/dashboard/substitute-classes', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER'] },
  { name: 'Notifications', icon: Bell, href: '/dashboard/notifications', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER', 'STUDENT'] },
  { name: 'Settings', icon: Settings, href: '/dashboard/settings', roles: ['ADMIN', 'SUPER_TEACHER', 'TEACHER', 'STUDENT'] },
];

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200 flex flex-col items-center">
          <Image 
            src="/logo.jpeg" 
            alt="MSMe Logo" 
            width={80} 
            height={80} 
            className="rounded-xl shadow-sm mb-4 object-cover"
            priority
          />
          <h1 className="text-lg font-semibold text-blue-600 text-center leading-tight">Automatic Timetable Generator</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {user?.role === 'ADMIN' ? 'Admin Dashboard' : user?.role === 'STUDENT' ? 'Student Dashboard' : 'Faculty Dashboard'}
          </p>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.filter(item => !item.roles || (user && item.roles.includes(user.role))).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${isActive
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}