"use client";
import React, { useState, useEffect } from 'react';
import { Bell, Info, Trash2, Check } from 'lucide-react';
import api, { endpoints } from '@/lib/api';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

const HF_API = process.env.NEXT_PUBLIC_HF_API_URL || 'https://kindalien-timetable-gen.hf.space';

interface Notification {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type: string;
  title: string;
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const getDisplayName = () => {
    if (!user) return '';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  };

  const fetchNotifications = async () => {
    try {
      const [leaveRes, subRes, djangoRes, cRes] = await Promise.all([
        axios.get(`${HF_API}/leave`).catch((e) => ({ error: e.message, data: { leaves: [] } })),
        axios.get(`${HF_API}/substitution/pending`).catch((e) => ({ error: e.message, data: { substitutions: [] } })),
        endpoints.notifications.list().catch((e: any) => ({ error: e.message, data: [] })),
        axios.get(`${HF_API}/cancellations`).catch((e) => ({ error: e.message, data: { cancellations: [] } }))
      ]);

      const items: Notification[] = [];

      // Django Notifications
      let djangoNotifs = djangoRes.data?.notifications || djangoRes.data || [];
      if (!Array.isArray(djangoNotifs)) djangoNotifs = [];

      djangoNotifs.forEach((notif: any) => {
        const id = `django-${notif.id}`;
        items.push({
          id,
          title: notif.notification_type === 'TIMETABLE_CHANGE' ? 'Timetable Update' : 'Alert',
          message: notif.message,
          created_at: notif.created_at || new Date().toISOString(),
          notification_type: 'System',
          is_read: notif.is_read || readIds.has(id),
        });
      });

      // Leave Notifications
      (leaveRes.data?.leaves || []).forEach((leave: any) => {
        if (user?.role === 'STUDENT') return;
        if (user?.role === 'TEACHER' && leave.faculty_id !== getDisplayName()) return;

        const id = `leave-${leave.leave_id}`;
        items.push({
          id,
          title: leave.status === 'APPROVED' ? 'Leave Approved' : leave.status === 'REJECTED' ? 'Leave Rejected' : 'Leave Request',
          message: `${leave.faculty_id} — ${leave.days?.join(', ')}`,
          created_at: new Date().toISOString(),
          notification_type: 'Leave',
          is_read: readIds.has(id),
        });
      });

      // Substitution Notifications
      (subRes.data?.substitutions || []).forEach((sub: any) => {
        if (user?.role === 'STUDENT') return;
        if (user?.role === 'TEACHER') {
          const isRelated = sub.original_faculty_id === getDisplayName() || sub.candidate_faculty_id === getDisplayName();
          const isOpen = sub.status === 'PENDING' && !sub.candidate_faculty_id;
          if (!isRelated && !isOpen) return;
        }

        const id = `sub-${sub.request_id}`;
        items.push({
          id,
          title: sub.status === 'PENDING' ? 'Substitute Request' : `Substitution ${sub.status}`,
          message: `${sub.affected_slot?.subject_code?.toUpperCase()} (${sub.affected_slot?.section_id?.toUpperCase()}) — ${sub.affected_slot?.day} P${(sub.affected_slot?.period || 0) + 1}`,
          created_at: sub.sent_at || new Date().toISOString(),
          notification_type: 'Substitution',
          is_read: readIds.has(id),
        });
      });

      // Cancellation Notifications
      (cRes.data?.cancellations || []).forEach((c: any) => {
        if (user?.role === 'STUDENT') return;
        if (user?.role === 'TEACHER') {
          if (!c.faculty_id) return;
          const currentTeacherName = getDisplayName().toLowerCase();
          const currentTeacherNameStripped = currentTeacherName.replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();
          const fac = c.faculty_id.toLowerCase().replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();
          if (!fac.includes(currentTeacherNameStripped) && !currentTeacherNameStripped.includes(fac) && c.faculty_id !== 'teacher') return;
        }

        const id = `cancel-${c.id}`;
        items.push({
          id,
          title: c.status === 'APPROVED' ? 'Cancellation Approved' : c.status === 'REJECTED' ? 'Cancellation Rejected' : 'Cancellation Request',
          message: `${c.subject} (${c.section_id}) — ${c.day} P${(c.period || 0) + 1}`,
          created_at: c.created_at || new Date().toISOString(),
          notification_type: 'Cancellation',
          is_read: readIds.has(id),
        });
      });

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(items);
    } catch (error: any) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [user, readIds]);

  const markAsRead = async (id: string) => {
    const newIds = new Set(readIds);
    newIds.add(id);
    setReadIds(newIds);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));

    try {
      if (id.startsWith('django-')) {
        const rawId = parseInt(id.replace('django-', ''), 10);
        await endpoints.notifications.markRead(rawId);
      }
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    try {
      if (id.startsWith('django-')) {
        const rawId = parseInt(id.replace('django-', ''), 10);
        await endpoints.notifications.delete(rawId);
      }
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const newIds = new Set(readIds);
      notifications.forEach(n => newIds.add(n.id));
      setReadIds(newIds);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));

      await endpoints.notifications.markAllRead().catch(() => {});
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => !n.is_read);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Stay updated with important announcements</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md font-medium transition-colors"
          >
            Mark all as read
          </button>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'unread' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Unread
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notifications found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors ${!notification.is_read ? 'bg-blue-50/30' : ''}`}
              >
                <div className="p-2 rounded-full flex-shrink-0 bg-blue-100 text-blue-600">
                  <Info className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {notification.title}: {notification.message}
                    </p>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.notification_type || 'System Notification'}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {notification.id.startsWith('django-') && (
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
