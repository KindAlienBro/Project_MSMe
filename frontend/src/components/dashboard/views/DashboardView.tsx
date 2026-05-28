"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { BookOpen, FileText, UserCog, Users, GraduationCap, Layers, UserCheck } from 'lucide-react';
import { DashboardCards } from '../DashboardCards';
import { RecentNotifications } from '../RecentNotifications';
import { SubstituteRequests } from '../SubstituteRequests';
import { TodaysTimetable } from '../TodaysTimetable';
import { ResourceVisualization } from '../ResourceVisualization';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { StudentDashboardView } from './StudentDashboardView';
import { endpoints } from '@/lib/api';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

export function DashboardView() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [subRequests, setSubRequests] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [scheduleRes, leaveRes, subRes, statsRes] = await Promise.all([
          axios.get(`${HF_API}/schedule`).catch(() => ({ data: {} })),
          axios.get(`${HF_API}/leave`).catch(() => ({ data: { leaves: [] } })),
          axios.get(`${HF_API}/substitution/pending`).catch(() => ({ data: { substitutions: [] } })),
          endpoints.stats().catch(() => ({ data: {} })),
        ]);
        if (scheduleRes.data.exists) setTimetable(scheduleRes.data);
        setLeaves(leaveRes.data.leaves || []);
        setSubRequests(subRes.data.substitutions || []);
        setAdminStats(statsRes.data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Compute today's classes for the user
  const todayClasses = useMemo(() => {
    if (!timetable?.grid) return [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = days[new Date().getDay()];
    const headers = timetable.headers || [];
    const breakIdx = (timetable.break_after_index ?? 1) + 1;
    const lunchIdx = (timetable.lunch_after_index ?? 3) + 2;

    const classes: any[] = [];
    const grid = timetable.grid;

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

    // If faculty, filter for their classes; if admin, show all
    const userFaculty = user?.first_name || '';

    for (const [section, sectionData] of Object.entries(grid as Record<string, any>)) {
      const dayIndex = timetable.days?.indexOf(todayName);
      if (dayIndex === undefined || dayIndex < 0) continue;
      const daySlots = sectionData.slots?.[String(dayIndex)] || {};

      let periodIdx = 0;
      headers.forEach((h: string, hi: number) => {
        if (hi === breakIdx || hi === lunchIdx) return;

        const cells = daySlots[String(periodIdx)] || [];
        periodIdx++;

        cells.forEach((cell: any) => {
          const isUserClass = user?.role === 'ADMIN' || user?.role === 'SUPER_TEACHER' ||
            cell.faculty?.toLowerCase().includes(userFaculty.toLowerCase());

          if (isUserClass) {
            const dayIndex2 = timetable.days?.indexOf(todayName);
            const roomKey = `${section.toUpperCase()}_${dayIndex2}_${periodIdx - 1}_${(cell.subject || '').toUpperCase()}`;
            classes.push({
              subject: cell.subject,
              faculty: cell.faculty,
              section,
              time: h,
              is_substituted: cell.is_substituted || false,
              original_faculty: cell.original_faculty || '',
              periodIndex: hi,
              room: roomLookup[roomKey] || '',
              batch: cell.batch || ((cell.subject || '').toUpperCase().includes('LAB') ? (cell.subject.includes('MLLAB') ? 'B1' : cell.subject.includes('NLPLAB') ? 'B2' : (section.match(/-(E|B)(\d+)$/i) ? 'B' + section.match(/-(E|B)(\d+)$/i)![2] : '')) : ''),
            });
          }
        });
      });
    }

    // Deduplicate by subject+faculty+time
    const seen = new Set<string>();
    const unique = classes.filter(c => {
      const key = `${c.subject}_${c.faculty}_${c.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => a.periodIndex - b.periodIndex);
  }, [timetable, user]);

  // Count unique faculty from the schedule
  const totalFaculty = useMemo(() => {
    if (!timetable?.schedule) return 0;
    const facultySet = new Set<string>();
    for (const info of Object.values(timetable.schedule as Record<string, any>)) {
      const name = info.faculty_name;
      if (name) facultySet.add(name);
    }
    return facultySet.size;
  }, [timetable]);

  const pendingLeaves = leaves.filter(l => l.status === 'PENDING').length;
  const approvedLeaves = leaves.filter(l => l.status === 'APPROVED').length;
  const pendingSubRequests = subRequests.filter(s => s.status === 'PENDING').length;
  const totalSubRequests = subRequests.length;
  const isAdminOrSuper = user?.role === 'ADMIN' || user?.role === 'SUPER_TEACHER';

  const cardData = user?.role === 'ADMIN' ? [
    {
      title: 'Total Faculty',
      value: (adminStats?.total_teachers || 0).toString(),
      subtitle: `${adminStats?.teachers_present || 0} present • ${adminStats?.teachers_on_leave || 0} absent`,
      icon: UserCog,
      color: 'blue' as const,
    },
    {
      title: 'Total Students',
      value: (adminStats?.total_students || 0).toString(),
      subtitle: 'Enrolled in department',
      icon: GraduationCap,
      color: 'green' as const,
    },
    {
      title: 'Total Classes',
      value: (adminStats?.total_classes || 0).toString(),
      subtitle: 'Active sections',
      icon: Layers,
      color: 'pink' as const,
    },
    {
      title: 'Pending Leave Requests',
      value: pendingLeaves.toString(),
      subtitle: pendingLeaves > 0 ? 'Awaiting approval' : 'All clear',
      icon: FileText,
      color: 'orange' as const,
    },
  ] : [
    {
      title: "Today's Classes",
      value: todayClasses.length.toString(),
      subtitle: todayClasses.length > 0
        ? `${todayClasses.filter(c => c.is_substituted).length} substitute`
        : 'No classes today',
      icon: BookOpen,
      color: 'blue' as const,
    },
    {
      title: 'Pending Leave Requests',
      value: pendingLeaves.toString(),
      subtitle: pendingLeaves > 0 ? 'Awaiting approval' : 'All clear',
      icon: FileText,
      color: 'orange' as const,
    },
    {
      title: 'Substitute Requests',
      value: totalSubRequests.toString(),
      subtitle: pendingSubRequests > 0 ? `${pendingSubRequests} pending action` : totalSubRequests > 0 ? 'All resolved' : 'None active',
      icon: UserCog,
      color: 'pink' as const,
    },
    {
      title: 'Class Attendance',
      value: `${adminStats?.attendance_percentage ?? 0}%`,
      subtitle: `Average from ${adminStats?.total_attendance_sessions ?? 0} sessions`,
      icon: UserCheck,
      color: 'green' as const,
    },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (user?.role === 'STUDENT') {
    return <StudentDashboardView />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {greeting()}, {user?.first_name || 'User'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening today.</p>
      </div>

      <DashboardCards cards={cardData} loading={loading} />

      {isAdminOrSuper && (
        <ResourceVisualization timetable={timetable} />
      )}

      {user?.role !== 'ADMIN' && adminStats?.subject_attendance && adminStats.subject_attendance.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-fade-in">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            My Subject Attendance Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminStats.subject_attendance.map((sub: any, idx: number) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-900 truncate pr-2" title={sub.subject_name.toUpperCase()}>{sub.subject_name.toUpperCase()}</h3>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{sub.section}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{sub.total_sessions} sessions tracked</p>
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-medium text-gray-500">Average Attendance</span>
                    <span className={`text-lg font-bold ${sub.percentage >= 75 ? 'text-emerald-600' : sub.percentage >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                      {sub.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${sub.percentage >= 75 ? 'bg-emerald-500' : sub.percentage >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} 
                      style={{ width: `${Math.min(100, Math.max(0, sub.percentage))}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TodaysTimetable classes={todayClasses} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentNotifications leaves={leaves} subRequests={subRequests} />
        <SubstituteRequests requests={subRequests} isAdmin={isAdminOrSuper} />
      </div>
    </div>
  );
}