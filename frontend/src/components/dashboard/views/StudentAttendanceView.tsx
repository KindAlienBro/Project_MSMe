"use client";
import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, BookOpen, Calendar, CheckCircle2,
  XCircle, BarChart3, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { endpoints } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface SubjectAttendance {
  subject_code: string;
  subject_name: string;
  total: number;
  present: number;
  absent?: number;
  percentage: number;
}

interface OverallAttendance {
  total_classes: number;
  present: number;
  absent: number;
  percentage: number;
}

interface RecentRecord {
  date: string;
  subject_code: string;
  subject_name: string;
  section: string;
  time_slot: string;
  period_index: number;
  status: 'P' | 'A';
}

type Tab = 'overview' | 'history';

function CircleProgress({ percentage, size = 140 }: { percentage: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 85 ? '#22c55e' : percentage >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={14} />
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
  if (pct >= 75) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Warning</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Low</span>;
}

export function StudentAttendanceView() {
  const { user } = useAuth();
  const [overall, setOverall] = useState<OverallAttendance | null>(null);
  const [subjectWise, setSubjectWise] = useState<SubjectAttendance[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await endpoints.attendance.getMyAttendance();
      setOverall(res.data.overall);
      setSubjectWise(res.data.subject_wise || []);
      setRecentRecords(res.data.recent_records || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
        <p className="text-sm">Loading your attendance data...</p>
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
  const pctColor = percentage >= 85 ? 'text-green-600' : percentage >= 75 ? 'text-amber-500' : 'text-red-500';
  const statusMessage = percentage >= 85
    ? 'Great attendance! Keep it up.'
    : percentage >= 75
      ? 'Attendance is borderline. Try not to miss more classes.'
      : 'Attendance is below 75%. Immediate improvement needed.';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            {(user?.student_profile as any)?.section
              ? `Section ${(user?.student_profile as any)?.section}`
              : 'Track your attendance across all subjects'}
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
      {overall?.total_classes === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No attendance records yet</h3>
          <p className="text-sm text-gray-500 mt-2">Your attendance will appear here once your teachers start marking classes.</p>
        </div>
      )}

      {overall && overall.total_classes > 0 && (
        <>
          {/* Overall Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Circle */}
              <div className="relative flex-shrink-0">
                <CircleProgress percentage={percentage} size={150} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{percentage}%</span>
                  <span className="text-xs opacity-70">Overall</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-1">Overall Attendance</h2>
                <p className="text-blue-200 text-sm mb-4">{statusMessage}</p>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{overall.total_classes}</p>
                    <p className="text-xs opacity-70 mt-0.5">Total Classes</p>
                  </div>
                  <div className="bg-green-500/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-300">{overall.present}</p>
                    <p className="text-xs opacity-70 mt-0.5">Present</p>
                  </div>
                  <div className="bg-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-300">{overall.absent}</p>
                    <p className="text-xs opacity-70 mt-0.5">Absent</p>
                  </div>
                </div>

                {/* Warning if low */}
                {percentage < 75 && (
                  <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0" />
                    <p className="text-xs text-red-200">
                      You need to attend at least{' '}
                      <strong>{Math.ceil((0.75 * overall.total_classes - overall.present) / 0.25)}</strong> more classes to reach 75%.
                    </p>
                  </div>
                )}
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
                {t === 'overview' ? 'Subject-wise' : 'Recent History'}
              </button>
            ))}
          </div>

          {/* Subject-wise Tab */}
          {tab === 'overview' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" /> Subject-wise Breakdown
                </h3>
              </div>

              {subjectWise.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <p className="text-sm">No subject data available.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {subjectWise.map(sub => {
                    const pct = sub.percentage;
                    const barColor = pct >= 85 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
                    const textColor = pct >= 85 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';
                    return (
                      <div key={sub.subject_code} className="p-4 hover:bg-gray-50/60 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900">{sub.subject_name}</span>
                              <AttendanceBadge pct={pct} />
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{sub.subject_code}</span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <span className={`text-lg font-black ${textColor}`}>{pct}%</span>
                            <p className="text-xs text-gray-400">{sub.present}/{sub.total} classes</p>
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

          {/* Recent History Tab */}
          {tab === 'history' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" /> Recent Attendance (Last 30 records)
                </h3>
              </div>

              {recentRecords.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <p className="text-sm">No recent records found.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentRecords.map((rec, idx) => (
                    <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          rec.status === 'P' ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          {rec.status === 'P'
                            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                            : <XCircle className="w-5 h-5 text-red-400" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{rec.subject_name || rec.subject_code}</p>
                          <p className="text-xs text-gray-400">{rec.time_slot} · Period {rec.period_index + 1}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-gray-600">
                          {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rec.status === 'P' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {rec.status === 'P' ? 'Present' : 'Absent'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
