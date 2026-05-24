"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen, BellRing, Clock, AlertTriangle, Users, CalendarDays,
  CheckCircle, Zap, Coffee, Sun, Moon, Sunset, ChevronDown, ChevronUp,
  X, GraduationCap, Calendar, LayoutGrid, MapPin
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { endpoints } from '@/lib/api';
import axios from 'axios';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

const PALETTES = [
  { bg: 'bg-indigo-50/80', border: 'border-indigo-100', textPrimary: 'text-indigo-800', textSecondary: 'text-indigo-600/90', icon: 'text-indigo-500/80', dot: 'bg-indigo-500' },
  { bg: 'bg-emerald-50/80', border: 'border-emerald-100', textPrimary: 'text-emerald-800', textSecondary: 'text-emerald-600/90', icon: 'text-emerald-500/80', dot: 'bg-emerald-500' },
  { bg: 'bg-rose-50/80', border: 'border-rose-100', textPrimary: 'text-rose-800', textSecondary: 'text-rose-600/90', icon: 'text-rose-500/80', dot: 'bg-rose-500' },
  { bg: 'bg-amber-50/80', border: 'border-amber-100', textPrimary: 'text-amber-800', textSecondary: 'text-amber-600/90', icon: 'text-amber-500/80', dot: 'bg-amber-500' },
  { bg: 'bg-cyan-50/80', border: 'border-cyan-100', textPrimary: 'text-cyan-800', textSecondary: 'text-cyan-600/90', icon: 'text-cyan-500/80', dot: 'bg-cyan-500' },
  { bg: 'bg-fuchsia-50/80', border: 'border-fuchsia-100', textPrimary: 'text-fuchsia-800', textSecondary: 'text-fuchsia-600/90', icon: 'text-fuchsia-500/80', dot: 'bg-fuchsia-500' },
];

function getColorForSubject(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
      hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

// ─── Notification Toast Component ───────────────────────────────────
function NotificationToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="animate-slide-in-right fixed top-20 right-6 z-50 max-w-sm w-full">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-4 rounded-xl shadow-2xl flex items-start gap-3 border border-orange-300/30">
        <div className="bg-white/20 p-1.5 rounded-lg shrink-0 mt-0.5">
          <BellRing className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Schedule Update</p>
          <p className="text-xs text-orange-100 mt-0.5 line-clamp-2">{message}</p>
        </div>
        <button onClick={onClose} className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Live Clock Component ───────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const hour = now.getHours();
  const Icon = hour < 6 ? Moon : hour < 12 ? Sun : hour < 17 ? Sun : hour < 20 ? Sunset : Moon;
  const bgGradient = hour < 6 ? 'from-indigo-900 to-slate-900'
    : hour < 12 ? 'from-sky-400 to-blue-500'
      : hour < 17 ? 'from-blue-500 to-indigo-500'
        : hour < 20 ? 'from-orange-400 to-rose-500'
          : 'from-indigo-800 to-slate-900';

  return (
    <div className={`bg-gradient-to-br ${bgGradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
      <div className="absolute -top-6 -right-6 opacity-10">
        <Icon className="w-32 h-32" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1 opacity-80">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Current Time (IST)</span>
        </div>
        <div className="text-3xl font-bold tracking-tight font-mono">{timeStr}</div>
        <div className="text-sm opacity-80 mt-1">{dateStr}</div>
      </div>
    </div>
  );
}

// ─── Class Status Helper ────────────────────────────────────────────
function getClassStatus(timeStr: string) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const istNow = new Date(utcNow + istOffset);
  const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();

  const parts = timeStr.split('-');
  if (parts.length !== 2) return 'upcoming';

  const parseTime = (t: string) => {
    const cleaned = t.trim();
    const match = cleaned.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    if (hours < 8) hours += 12;
    return hours * 60 + minutes;
  };

  const startMin = parseTime(parts[0]);
  const endMin = parseTime(parts[1]);

  if (currentMinutes < startMin) return 'upcoming';
  if (currentMinutes >= startMin && currentMinutes < endMin) return 'ongoing';
  return 'completed';
}

const statusConfig = {
  upcoming: { label: 'Upcoming', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', ring: '' },
  ongoing: { label: 'Ongoing', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-2 ring-emerald-400/50 ring-offset-2' },
  completed: { label: 'Done', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', ring: '' },
};

// ─── Main Component ─────────────────────────────────────────────────
export function StudentDashboardView() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [studentNotifications, setStudentNotifications] = useState<any[]>([]);
  const prevHashRef = useRef<string>('');
  const pollCountRef = useRef(0);
  const seenNotifIdsRef = useRef<Set<number>>(new Set());

  // Filter sections to only those matching the student's semester/department
  const filteredSections = useMemo(() => {
    if (!timetable?.grid) return [];
    const allSections = Object.keys(timetable.grid).sort();

    const studentDept = user?.student_profile?.dept_name?.toLowerCase();
    const studentSem = user?.student_profile?.semester;

    if (!studentDept && !studentSem) return allSections;

    // Filter sections that match student's dept or semester
    // Section names are typically like "CSE-3A", "AIML-1A", "ISE-5B", etc.
    const matched = allSections.filter(sec => {
      const secLower = sec.toLowerCase();
      const deptMatch = studentDept ? secLower.includes(studentDept) : true;
      const semMatch = studentSem ? secLower.includes(`${studentSem}`) || secLower.includes(`-${studentSem}`) : true;
      return deptMatch || semMatch;
    });

    // If we found matches, use them. Otherwise fall back to all (in case naming convention is different)
    return matched.length > 0 ? matched : allSections;
  }, [timetable, user]);

  // Fetch timetable
  const fetchTimetable = useCallback(async () => {
    try {
      const scheduleRes = await axios.get(`${HF_API}/schedule`).catch(() => ({ data: {} }));
      if (scheduleRes.data.exists) {
        // Merge sticky UI flags (is_substituted) from local storage to preserve NLP diff highlights
        const cached = localStorage.getItem('timetable_v2');
        if (cached && scheduleRes.data.grid) {
          try {
            const cachedData = JSON.parse(cached);
            if (cachedData?.grid) {
              Object.keys(scheduleRes.data.grid).forEach(secId => {
                if (!cachedData.grid[secId]) return;
                Object.keys(scheduleRes.data.grid[secId].slots || {}).forEach(dayIdx => {
                  Object.keys(scheduleRes.data.grid[secId].slots[dayIdx] || {}).forEach(pIdx => {
                    const apiClasses = scheduleRes.data.grid[secId].slots[dayIdx][pIdx] || [];
                    const cachedClasses = cachedData.grid[secId].slots[dayIdx][pIdx] || [];
                    apiClasses.forEach((apiCls: any) => {
                      const match = cachedClasses.find((cCls: any) => cCls.subject === apiCls.subject && cCls.faculty === apiCls.faculty);
                      if (match && match.is_substituted) {
                        apiCls.is_substituted = true;
                        if (match.original_faculty) apiCls.original_faculty = match.original_faculty;
                      }
                    });
                  });
                });
              });
            }
          } catch (e) { console.error("Failed to merge cache flags", e); }
        }

        const newHash = JSON.stringify(scheduleRes.data.grid || {});
        if (prevHashRef.current && prevHashRef.current !== newHash && pollCountRef.current > 0) {
          setToasts(prev => [...prev, {
            id: `change-${Date.now()}`,
            message: 'Your timetable has been updated. Please review the changes below.',
          }]);
        }
        prevHashRef.current = newHash;
        pollCountRef.current++;
        setTimetable(scheduleRes.data);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-select section when filteredSections change
  useEffect(() => {
    if (filteredSections.length > 0 && (!selectedSection || !filteredSections.includes(selectedSection))) {
      setSelectedSection(filteredSections[0]);
    }
  }, [filteredSections, selectedSection]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await endpoints.student.notifications();
      const notifs = res.data.notifications || [];

      // Find truly new notifications we haven't seen in this session
      const newlyUnread = notifs.filter((n: any) =>
        !n.is_read && n.notification_type === 'TIMETABLE_CHANGE' && !seenNotifIdsRef.current.has(n.id)
      );

      // Add all fetched notifs to the seen set
      notifs.forEach((n: any) => seenNotifIdsRef.current.add(n.id));

      if (newlyUnread.length > 0 && pollCountRef.current > 1) {
        newlyUnread.forEach((n: any) => {
          setToasts(prev => {
            if (prev.find(t => t.id === `notif-${n.id}`)) return prev;
            return [...prev, { id: `notif-${n.id}`, message: n.message }];
          });
        });
      }
      setStudentNotifications(notifs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchTimetable();
      await fetchNotifications();
      setLoading(false);
    };
    init();
    const interval = setInterval(() => {
      fetchTimetable();
      fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchTimetable, fetchNotifications]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Process timetable data
  const { todayClasses, alerts, weekClasses } = useMemo(() => {
    if (!timetable?.grid || !selectedSection) return { todayClasses: [], alerts: [], weekClasses: {} };

    const days = timetable.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const todayNum = new Date().getDay();
    const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayNum];

    const headers = timetable.headers || [];
    const breakIdx = (timetable.break_after_index ?? 1) + 1;
    const lunchIdx = (timetable.lunch_after_index ?? 3) + 2;

    const tClasses: any[] = [];
    const tAlerts: any[] = [];
    const wClasses: Record<string, any[]> = {};

    const sectionData = timetable.grid[selectedSection] || { slots: {} };

    // Build room lookup from schedule data
    const roomLookup: Record<string, string> = {};
    if (timetable.schedule) {
      Object.values(timetable.schedule).forEach((entry: any) => {
        if (entry.room_name) {
          const rawSec = (entry.section_id || '').toUpperCase();
          const parentSec = rawSec.split('-')[0];
          const subjectUp = (entry.subject_code || '').toUpperCase();
          const dur = entry.duration || 1;
          for (let i = 0; i < dur; i++) {
            roomLookup[`${parentSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`] = entry.room_name;
            roomLookup[`${rawSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`] = entry.room_name;
          }
        }
      });
    }
    // Process week classes
    days.forEach((dayName: string, dayIdx: number) => {
      wClasses[dayName] = [];
      const daySlots = sectionData.slots[String(dayIdx)] || {};
      let periodIdx = 0;

      headers.forEach((h: string, hi: number) => {
        if (hi === breakIdx || hi === lunchIdx) return;
        const cells = daySlots[String(periodIdx)] || [];

        if (cells.length > 0) {
          cells.forEach((cell: any) => {
            const roomKey = `${selectedSection.toUpperCase()}_${dayIdx}_${periodIdx}_${(cell.subject || '').toUpperCase()}`;
            wClasses[dayName].push({ ...cell, time: h, periodIndex: hi, room: roomLookup[roomKey] || '' });
          });
        } else {
          wClasses[dayName].push({ isFree: true, time: h, periodIndex: hi });
        }
        periodIdx++;
      });
    });

    // Process today's classes
    const todayIndex = days.indexOf(todayName);
    if (todayIndex >= 0) {
      const todaySlots = sectionData.slots[String(todayIndex)] || {};
      let periodIdx = 0;

      headers.forEach((h: string, hi: number) => {
        if (hi === breakIdx || hi === lunchIdx) return;
        const cells = todaySlots[String(periodIdx)] || [];

        if (cells.length > 0) {
          cells.forEach((cell: any) => {
            const roomKey = `${selectedSection.toUpperCase()}_${todayIndex}_${periodIdx}_${(cell.subject || '').toUpperCase()}`;
            tClasses.push({
              subject: cell.subject, faculty: cell.faculty, time: h,
              is_substituted: cell.is_substituted || false,
              original_faculty: cell.original_faculty || '', periodIndex: hi,
              room: roomLookup[roomKey] || '',
            });
            if (cell.is_substituted) {
              tAlerts.push({
                id: `sub_${hi}_${cell.subject}`, type: 'substitution',
                message: `${cell.original_faculty} is absent. ${cell.faculty} will take ${cell.subject} at ${h}.`,
                time: h,
              });
            }
          });
        } else {
          tAlerts.push({
            id: `free_${hi}`, type: 'free',
            message: `Free period at ${h}.`, time: h,
          });
        }
        periodIdx++;
      });
    }

    tClasses.sort((a, b) => a.periodIndex - b.periodIndex);
    return { todayClasses: tClasses, alerts: tAlerts, weekClasses: wClasses };
  }, [timetable, selectedSection]);

  // Get unique time slots for the week grid header
  const timeSlots = useMemo(() => {
    if (!timetable?.headers) return [];
    const breakIdx = (timetable.break_after_index ?? 1) + 1;
    const lunchIdx = (timetable.lunch_after_index ?? 3) + 2;
    return (timetable.headers as string[]).filter((_: string, hi: number) => hi !== breakIdx && hi !== lunchIdx);
  }, [timetable]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const days = timetable?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  // Stats
  const totalClassesToday = todayClasses.length;
  const substitutedCount = todayClasses.filter(c => c.is_substituted).length;
  const freePeriodsCount = alerts.filter(a => a.type === 'free').length;
  const completedCount = todayClasses.filter(c => getClassStatus(c.time) === 'completed').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
          <GraduationCap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  if (!timetable?.grid) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl shadow-sm border mt-6">
        <div className="bg-blue-50 p-4 rounded-full mb-4">
          <BookOpen className="w-12 h-12 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">No Timetable Available</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm text-center">
          The admin hasn&apos;t generated the schedule yet. You&apos;ll see your classes here once it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Notification Toasts */}
      {toasts.map(toast => (
        <NotificationToast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} />
      ))}

      {/* ─── Header Row ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.first_name || 'Student'} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.student_profile?.dept_name && (
              <span className="inline-flex items-center gap-1.5 mr-3">
                <GraduationCap className="w-3.5 h-3.5" />
                {user.student_profile.dept_name} &middot; Sem {user.student_profile.semester} &middot; Year {user.student_profile.year}
              </span>
            )}
            Here&apos;s your schedule for today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Section Selector (only shows sections matching student's semester) */}
          {filteredSections.length > 1 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <Users className="w-5 h-5 text-blue-500 shrink-0" />
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="text-sm bg-transparent border-none outline-none font-semibold text-gray-700 cursor-pointer w-full"
              >
                {filteredSections.map((sec: string) => <option key={sec} value={sec}>Section {sec}</option>)}
              </select>
            </div>
          )}
          {filteredSections.length === 1 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
              <Users className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold text-gray-700">Section {filteredSections[0]}</span>
            </div>
          )}

          {/* Today / Full Week Toggle */}
          <div className="flex bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setViewMode('today')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all ${viewMode === 'today'
                  ? 'bg-blue-600 text-white shadow-inner'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Calendar className="w-4 h-4" />
              Today
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-all ${viewMode === 'week'
                  ? 'bg-blue-600 text-white shadow-inner'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Full Week
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stats + Clock Row ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveClock />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-blue-50 p-3 rounded-xl"><BookOpen className="w-6 h-6 text-blue-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalClassesToday}</p>
            <p className="text-xs text-gray-500">Classes Today</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-emerald-50 p-3 rounded-xl"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{completedCount}<span className="text-sm font-normal text-gray-400">/{totalClassesToday}</span></p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className={`${substitutedCount > 0 ? 'bg-orange-50' : 'bg-green-50'} p-3 rounded-xl`}>
            {substitutedCount > 0
              ? <AlertTriangle className="w-6 h-6 text-orange-600" />
              : <Zap className="w-6 h-6 text-green-600" />
            }
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{substitutedCount > 0 ? substitutedCount : freePeriodsCount}</p>
            <p className="text-xs text-gray-500">{substitutedCount > 0 ? 'Substitutions' : 'Free Periods'}</p>
          </div>
        </div>
      </div>

      {/* ═══════════════ TODAY VIEW ═══════════════ */}
      {viewMode === 'today' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Today */}
          <div className="lg:col-span-2 space-y-6">
            {/* Realtime Alerts */}
            {alerts.filter(a => a.type === 'substitution').length > 0 ? (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-orange-100 p-1.5 rounded-lg">
                    <BellRing className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-orange-900">Schedule Changes</h3>
                  <span className="ml-auto text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-semibold">
                    {alerts.filter(a => a.type === 'substitution').length} alert{alerts.filter(a => a.type === 'substitution').length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {alerts.filter(a => a.type === 'substitution').map(alert => (
                    <div key={alert.id} className="flex items-start gap-3 bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-orange-100 shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-orange-900">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">All Clear!</h3>
                  <p className="text-sm text-emerald-700">No substitutions or changes to your schedule today.</p>
                </div>
              </div>
            )}

            {/* Today's Classes */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
              <div className="p-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <div className="bg-blue-50 p-1.5 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  Today&apos;s Schedule
                </h3>
                <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                  {todayClasses.length} session{todayClasses.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                {todayClasses.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Coffee className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No classes scheduled for today</p>
                    <p className="text-sm text-gray-400 mt-1">Enjoy your day off!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {todayClasses.map((cls, idx) => {
                      const classStatus = getClassStatus(cls.time);
                      const config = statusConfig[classStatus];
                      return (
                        <div
                          key={idx}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${config.ring} ${cls.is_substituted ? 'bg-orange-50/40' : classStatus === 'completed' ? 'bg-gray-50/40' : classStatus === 'ongoing' ? 'bg-emerald-50/30' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${config.dot} ${classStatus === 'ongoing' ? 'animate-pulse' : ''}`} />
                              {idx < todayClasses.length - 1 && <div className="w-px h-8 bg-gray-200" />}
                            </div>
                            <div className={`px-3 py-2 rounded-xl text-xs font-bold border shrink-0 min-w-[100px] text-center ${cls.is_substituted ? 'bg-orange-100 text-orange-700 border-orange-200' : config.color}`}>
                              {cls.time}
                            </div>
                            <div>
                              <h4 className={`font-bold flex items-center gap-2 ${classStatus === 'completed' ? 'text-gray-400' : 'text-gray-900'}`}>
                                {cls.subject}
                                {cls.is_substituted && (
                                  <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-orange-300 font-bold">
                                    Substituted
                                  </span>
                                )}
                                {classStatus === 'ongoing' && (
                                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider border border-emerald-300 font-bold animate-pulse">
                                    Live
                                  </span>
                                )}
                              </h4>
                              <div className={`flex items-center gap-3 mt-1 text-sm ${classStatus === 'completed' ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" />
                                  {cls.faculty}
                                </span>
                                {cls.room && (
                                  <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {cls.room}
                                  </span>
                                )}
                                {cls.is_substituted && cls.original_faculty && (
                                  <span className="text-xs text-orange-600">(was: {cls.original_faculty})</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${config.color}`}>
                            {config.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Notifications */}
          <div className="lg:col-span-1 space-y-4">
            {/* Mini Weekly Preview */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-600" />
                  This Week
                </h3>
                <button
                  onClick={() => setViewMode('week')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                >
                  View Full Week →
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {days.map((dayName: string) => {
                  const isToday = dayName === todayName;
                  const dayClasses = (weekClasses[dayName] || []).filter((c: any) => !c.isFree);
                  return (
                    <div key={dayName} className={`px-4 py-3 flex items-center justify-between ${isToday ? 'bg-blue-50/50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                          {dayName.slice(0, 3)}
                        </span>
                        {isToday && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Today</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{dayClasses.length} classes</span>
                        {dayClasses.some((c: any) => c.is_substituted) && (
                          <span className="w-2 h-2 rounded-full bg-orange-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Notifications */}
            {studentNotifications.length > 0 && (
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-amber-600" />
                    Recent Notifications
                  </h3>
                </div>
                <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-50">
                  {studentNotifications.slice(0, 5).map((notif: any) => (
                    <div key={notif.id} className={`px-4 py-3 text-xs ${notif.is_read ? 'text-gray-400' : 'text-gray-700 bg-blue-50/30'}`}>
                      <p className="font-medium line-clamp-2">{notif.message}</p>
                      <p className="text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ FULL WEEK VIEW ═══════════════ */}
      {viewMode === 'week' && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <div className="bg-purple-50 p-1.5 rounded-lg">
                <LayoutGrid className="w-5 h-5 text-purple-600" />
              </div>
              Full Week Timetable
              <span className="text-sm font-normal text-gray-500 ml-2">— Section {selectedSection}</span>
            </h3>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-16 sticky left-0 bg-white z-20 border-r border-gray-100 shadow-[1px_0_0_0_rgb(243_244_246)]">
                    Day
                  </th>
                  {timetable?.headers?.map((slot: string, hi: number) => {
                    const breakIdx = (timetable.break_after_index ?? 1) + 1;
                    const lunchIdx = (timetable.lunch_after_index ?? 3) + 2;
                    let colorClass = "text-gray-600";
                    if (hi === breakIdx) colorClass = "text-amber-700 italic";
                    if (hi === lunchIdx) colorClass = "text-blue-700 italic";
                    return (
                      <th key={hi} className={`px-2 py-4 text-center text-[11px] font-bold uppercase tracking-wider border-r border-gray-100 last:border-r-0 ${colorClass} ${hi === breakIdx || hi === lunchIdx ? 'w-12 bg-amber-50/20' : 'min-w-[110px]'}`}>
                        {slot}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map((dayName: string, dayIdx: number) => {
                  const isToday = dayName === todayName;
                  const daySlots = timetable?.grid?.[selectedSection]?.slots?.[String(dayIdx)] || {};

                  return (
                    <tr key={dayName} className={`${isToday ? 'bg-blue-50/10' : 'bg-white hover:bg-gray-50/50'} transition-colors border-b border-gray-100 last:border-b-0`}>
                      <td className={`px-4 py-3 sticky left-0 z-10 border-r border-gray-100 font-medium text-sm text-gray-700 shadow-[1px_0_0_0_rgb(243_244_246)] ${isToday ? 'bg-blue-50/90' : 'bg-white'}`}>
                        <div className="flex flex-col gap-1 items-start">
                          <span>{dayName.slice(0, 3)}</span>
                          {isToday && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-bold uppercase tracking-wide">Today</span>
                          )}
                        </div>
                      </td>
                      {timetable?.headers?.map((slot: string, hi: number) => {
                        const breakIdx = (timetable.break_after_index ?? 1) + 1;
                        const lunchIdx = (timetable.lunch_after_index ?? 3) + 2;

                        if (hi === breakIdx) {
                          if (dayIdx === 0) {
                            return (
                              <td rowSpan={days.length} key={`break-${hi}`} className="bg-[#fffdf2] border border-[#fef3c7] w-12 align-middle text-center p-0">
                                <span className="rotate-180 inline-block text-amber-600 font-bold text-xs whitespace-nowrap tracking-widest" style={{ writingMode: 'vertical-rl' }}>
                                  Tea Break
                                </span>
                              </td>
                            );
                          }
                          return null;
                        }

                        if (hi === lunchIdx) {
                          if (dayIdx === 0) {
                            return (
                              <td rowSpan={days.length} key={`lunch-${hi}`} className="bg-[#f0f9ff]/50 border border-[#e0f2fe] w-12 align-middle text-center p-0">
                                <span className="rotate-180 inline-block text-blue-600 font-bold text-xs whitespace-nowrap tracking-widest" style={{ writingMode: 'vertical-rl' }}>
                                  Lunch
                                </span>
                              </td>
                            );
                          }
                          return null;
                        }

                        const pIdx = hi - (hi > breakIdx ? 1 : 0) - (hi > lunchIdx ? 1 : 0);
                        const cells = daySlots[String(pIdx)] || [];

                        return (
                          <td key={hi} className="p-2 border border-gray-100/50 align-top">
                            {cells.length === 0 ? (
                              <div className="flex items-center justify-center h-full min-h-[50px]">
                                <span className="text-gray-300">-</span>
                              </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                  {cells.map((cls: any, ci: number) => {
                                    const colors = cls.is_substituted 
                                      ? { bg: 'bg-orange-50/90', border: 'border-orange-200', textPrimary: 'text-orange-800', textSecondary: 'text-orange-600/90', icon: 'text-orange-500/80', dot: 'bg-orange-500' }
                                      : getColorForSubject(cls.subject);

                                    return (
                                      <div key={ci} className={`relative p-3 rounded-xl border ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-all duration-300 min-w-[130px]`}>
                                          <div className={`font-bold text-sm mb-2 ${colors.textPrimary} flex justify-between items-start`}>
                                              <span className="line-clamp-2">{cls.subject}</span>
                                              {cls.is_substituted && <span className="ml-1 text-[9px] bg-orange-100 border border-orange-200 text-orange-700 px-1 py-0.5 rounded-md uppercase tracking-wider shrink-0">Sub</span>}
                                          </div>
                                          <div className="space-y-1.5">
                                              <div className={`flex items-center gap-2 text-[11px] font-semibold ${colors.textSecondary}`}>
                                                  <Users className={`w-3.5 h-3.5 flex-shrink-0 ${colors.icon}`} />
                                                  <span className="truncate">{cls.faculty}</span>
                                              </div>
                                              {cls.is_substituted && cls.original_faculty && (
                                                <div className="flex items-center gap-2 text-[10px] text-orange-500 font-medium">
                                                  <Users className="w-3 h-3 opacity-70" />
                                                  <span className="truncate italic">Original: {cls.original_faculty}</span>
                                                </div>
                                              )}
                                              {cls.room && (
                                                  <div className={`flex items-center gap-2 text-[11px] font-semibold ${colors.textSecondary}`}>
                                                      <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${colors.icon}`} />
                                                      <span className="truncate">{cls.room}</span>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                    );
                                  })}
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-5 text-xs font-medium text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-[#f0fdf4] border border-[#bbf7d0]" />
              <span>Regular Class</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-[#fff7ed] border border-orange-200" />
              <span>Substituted / Changed Class</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-bold">-</span>
              <span>Free period</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-[#fffdf2] border border-[#fef3c7]" />
              <span>Break / Lunch</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Custom Animation Styles ─── */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
