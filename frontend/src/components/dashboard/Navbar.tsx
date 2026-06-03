"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Menu, ChevronDown, CheckCircle2, UserCog, FileText, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { endpoints } from '@/lib/api';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

interface NavbarProps {
  onMenuClick: () => void;
}

interface NotificationItem {
  id: string;
  type: 'leave' | 'substitution';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('read_notification_ids');
    if (saved) {
      try { setReadIds(new Set(JSON.parse(saved))); } catch { /* ignore */ }
    }
  }, []);

  // Fetch notifications from HF API (leaves + substitutions)
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [leaveRes, subRes, djangoRes] = await Promise.all([
          axios.get(`${HF_API}/leave`).catch(() => ({ data: { leaves: [] } })),
          axios.get(`${HF_API}/substitution/pending`).catch(() => ({ data: { substitutions: [] } })),
          endpoints.notifications.list().catch(() => ({ data: [] })) // Django notifications
        ]);

        const items: NotificationItem[] = [];

        // Django Notifications (Timetable changes, Substitution alerts, etc.)
        const djangoNotifs = djangoRes.data.notifications || djangoRes.data || [];
        djangoNotifs.forEach((notif: any) => {
           items.push({
               id: `django-${notif.id}`,
               type: notif.notification_type === 'TIMETABLE_CHANGE' ? 'leave' : 'substitution', // Re-use icons
               title: notif.notification_type === 'TIMETABLE_CHANGE' ? 'Timetable Update' : 'Alert',
               message: notif.message,
               time: notif.created_at ? new Date(notif.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
               read: notif.is_read || readIds.has(`django-${notif.id}`)
           });
        });

        // Leave notifications (HF API)
        (leaveRes.data.leaves || []).forEach((leave: any) => {
          // Filtering logic:
          // Admins/Super Teachers see all leaves.
          // Teachers see only their own leaves.
          // Students see NO leaves.
          if (user?.role === 'STUDENT') return;
          if (user?.role === 'TEACHER' && leave.faculty_id !== getDisplayName()) return;

          const id = `leave-${leave.leave_id}`;
          items.push({
            id,
            type: 'leave',
            title: leave.status === 'APPROVED' ? 'Leave Approved' : leave.status === 'REJECTED' ? 'Leave Rejected' : 'Leave Request',
            message: `${leave.faculty_id} — ${leave.days?.join(', ')}`,
            time: leave.reason || '',
            read: readIds.has(id),
          });
        });

        // Substitution notifications (HF API)
        (subRes.data.substitutions || []).forEach((sub: any) => {
          // Filtering logic:
          // Admins/Super Teachers see all
          // Teachers see if they are the original, the substitute, or if it's PENDING and unassigned.
          // Students DO NOT see raw substitution requests in the top navbar (student dashboard handles schedule changes).
          if (user?.role === 'STUDENT') return;
          if (user?.role === 'TEACHER') {
            const isRelated = sub.original_faculty_id === getDisplayName() || sub.candidate_faculty_id === getDisplayName();
            const isOpen = sub.status === 'PENDING' && !sub.candidate_faculty_id;
            if (!isRelated && !isOpen) return;
          }

          const id = `sub-${sub.request_id}`;
          items.push({
            id,
            type: 'substitution',
            title: sub.status === 'PENDING' ? 'Substitute Request' : `Substitution ${sub.status}`,
            message: `${sub.affected_slot?.subject_code?.toUpperCase()} (${sub.affected_slot?.section_id?.toUpperCase()}) — ${sub.affected_slot?.day} P${(sub.affected_slot?.period || 0) + 1}`,
            time: sub.sent_at ? new Date(sub.sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
            read: readIds.has(id),
          });
        });

        // Sort by id for consistence, but since time formats differ, sorting by newest first might be tricky.
        // Usually items are pushed in reverse chronological order if from API.

        setNotifications(items);
      } catch { /* ignore */ }
    };

    fetchNotifications();
    // Re-fetch every 2 minutes
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [readIds]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    localStorage.setItem('read_notification_ids', JSON.stringify([...allIds]));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    const newIds = new Set(readIds);
    newIds.add(id);
    setReadIds(newIds);
    localStorage.setItem('read_notification_ids', JSON.stringify([...newIds]));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getInitials = () => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    return `${user.first_name} ${user.last_name}`;
  };

  const getSubtext = () => {
    if (!user) return '';
    return user.teacher_profile?.dept_name || user.role || '';
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-4">
        {/* Left Section */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search classes or subjects..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Install App Button */}
          {deferredPrompt && (
            <button
              onClick={handleInstallApp}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
            >
              Install App
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                    <p className="text-xs text-gray-500">{unreadCount} unread</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No notifications yet.</p>
                    </div>
                  ) : (
                    notifications.map(item => (
                      <div
                        key={item.id}
                        onClick={() => markRead(item.id)}
                        className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors ${!item.read ? 'bg-blue-50/40' : ''
                          }`}
                      >
                        <div className="flex gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'leave' ? 'bg-green-50 text-green-600' : 'bg-pink-50 text-pink-600'
                            }`}>
                            {item.type === 'leave' ? <FileText className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              {!item.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>}
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{item.message}</p>
                            {item.time && <p className="text-[10px] text-gray-400 mt-1">{item.time}</p>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">{getDisplayName()}</p>
              <p className="text-xs text-gray-500">{getSubtext()}</p>
            </div>
            <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm sm:text-base">
                {getInitials()}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
