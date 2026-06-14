"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, BookOpen, Calendar, CheckCircle2, Clock,
  Loader2, RefreshCw, AlertTriangle, Users, UserCheck,
  XCircle, ChevronDown, Search, Filter
} from 'lucide-react';
import { endpoints } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface SessionData {
  id: number;
  subject_code: string;
  subject_name: string;
  section: string;
  faculty_name: string;
  date: string;
  period_index: number;
  time_slot: string;
  total_students: number;
  present: number;
  absent: number;
  percentage: number;
  created_at: string;
}

interface SubjectSummary {
  subject_code: string;
  subject_name: string;
  section: string;
  total_sessions: number;
  total_students: number;
  present: number;
  percentage: number;
}

interface OverallStats {
  total_sessions: number;
  total_records: number;
  total_present: number;
  percentage: number;
}

type Tab = 'overview' | 'history';

function CircleProgress({ percentage, size = 140 }: { percentage: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 85 ? '#22c55e' : percentage >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={14} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={14}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
      />
    </svg>
  );
}

function AttendanceBadge({ pct }: { pct: number }) {
  if (pct >= 85) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Good</span>;
  if (pct >= 75) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Average</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Low</span>;
}

export function FacultyAttendanceHistoryView() {
  const { user } = useAuth();
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await endpoints.attendance.getHistory();
      setOverall(res.data.overall);
      setSubjects(res.data.subject_summary || []);
      setSessions(res.data.sessions || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Get unique subject codes for filter
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => {
      if (!map.has(s.subject_code)) {
        map.set(s.subject_code, s.subject_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesSearch = searchQuery === '' ||
        s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.subject_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.faculty_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.date.includes(searchQuery);
      const matchesFilter = filterSubject === 'all' || s.subject_code === filterSubject;
      return matchesSearch && matchesFilter;
    });
  }, [sessions, searchQuery, filterSubject]);

  // Group sessions by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, SessionData[]> = {};
    filteredSessions.forEach(s => {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSessions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
        <p className="text-sm">Loading attendance history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <AlertTriangle className="w-10 h-10 mb-4 text-amber-400" />
        <p className="text-sm font-semibold text-gray-700">{error}</p>
        <button onClick={fetchData} className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const percentage = overall?.percentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.role === 'ADMIN'
              ? 'Overview of all attendance sessions across faculty'
              : 'Track attendance records for your classes'}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Empty state */}
      {overall?.total_sessions === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No attendance sessions recorded</h3>
          <p className="text-sm text-gray-500 mt-2">
            Attendance history will appear here once you start marking attendance for your classes.
          </p>
        </div>
      )}

      {overall && overall.total_sessions > 0 && (
        <>
          {/* Overall Stats Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Circle */}
              <div className="relative flex-shrink-0">
                <CircleProgress percentage={percentage} size={150} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{percentage}%</span>
                  <span className="text-xs opacity-70">Average</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-1">Overall Class Attendance</h2>
                <p className="text-indigo-200 text-sm mb-4">
                  {percentage >= 85
                    ? 'Excellent attendance across your classes!'
                    : percentage >= 75
                      ? 'Good attendance. Some classes may need attention.'
                      : 'Below average. Multiple classes need improvement.'}
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{overall.total_sessions}</p>
                    <p className="text-xs opacity-70 mt-0.5">Sessions</p>
                  </div>
                  <div className="bg-green-500/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-300">{overall.total_present}</p>
                    <p className="text-xs opacity-70 mt-0.5">Total Present</p>
                  </div>
                  <div className="bg-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-300">{overall.total_records - overall.total_present}</p>
                    <p className="text-xs opacity-70 mt-0.5">Total Absent</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
            {(['overview', 'history'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'overview' ? 'Subject Summary' : 'Session History'}
              </button>
            ))}
          </div>

          {/* Subject Summary Tab */}
          {tab === 'overview' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" /> Subject-wise Attendance Summary
                </h3>
              </div>

              {subjects.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <p className="text-sm">No subject data available.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {subjects.map((sub, idx) => {
                    const pct = sub.percentage;
                    const barColor = pct >= 85 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
                    const textColor = pct >= 85 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div key={idx} className="p-4 hover:bg-gray-50/60 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900">{sub.subject_name}</span>
                              <AttendanceBadge pct={pct} />
                              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{sub.section}</span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{sub.subject_code}</span>
                            <span className="text-xs text-gray-400 ml-2">· {sub.total_sessions} sessions</span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <span className={`text-lg font-black ${textColor}`}>{pct}%</span>
                            <p className="text-xs text-gray-400">{sub.present}/{sub.total_students} records</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-700 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {/* 75% line marker */}
                        <div className="relative h-0">
                          <div
                            className="absolute bottom-2 w-0.5 h-3 bg-gray-400/60"
                            style={{ left: '75%' }}
                            title="75% threshold"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Session History Tab */}
          {tab === 'history' && (
            <div className="space-y-4">
              {/* Search and filter bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by subject, section, faculty, or date..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={filterSubject}
                    onChange={e => setFilterSubject(e.target.value)}
                    className="pl-10 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all appearance-none cursor-pointer"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <p className="text-xs text-gray-400">{filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found</p>

              {filteredSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
                  <p className="text-sm">No sessions match your filter.</p>
                </div>
              ) : (
                groupedByDate.map(([date, dateSessions]) => (
                  <div key={date} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Date header */}
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-semibold text-gray-800">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{dateSessions.length} session{dateSessions.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Sessions for this date */}
                    <div className="divide-y divide-gray-50">
                      {dateSessions.map(session => {
                        const pct = session.percentage;
                        const barColor = pct >= 85 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
                        const bgAccent = pct >= 85 ? 'bg-green-50' : pct >= 75 ? 'bg-amber-50' : 'bg-red-50';
                        const textColor = pct >= 85 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';

                        return (
                          <div key={session.id} className="p-4 hover:bg-gray-50/60 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Left: session info */}
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgAccent}`}>
                                  <BookOpen className={`w-5 h-5 ${textColor}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-gray-900">{session.subject_name}</span>
                                    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{session.section}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {session.time_slot || `Period ${session.period_index + 1}`}
                                    </span>
                                    {user?.role === 'ADMIN' && (
                                      <span className="text-xs text-gray-400">
                                        · by {session.faculty_name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: attendance stats */}
                              <div className="flex items-center gap-4 sm:gap-6">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    </div>
                                    <span className="text-sm font-semibold text-green-600">{session.present}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    </div>
                                    <span className="text-sm font-semibold text-red-500">{session.absent}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                                      <Users className="w-3.5 h-3.5 text-gray-500" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-600">{session.total_students}</span>
                                  </div>
                                </div>

                                {/* Percentage badge */}
                                <div className={`px-3 py-1.5 rounded-lg ${bgAccent} min-w-[60px] text-center`}>
                                  <span className={`text-base font-black ${textColor}`}>{pct}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Mini progress bar */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
