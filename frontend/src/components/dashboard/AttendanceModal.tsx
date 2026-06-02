"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, XCircle, Users, Clock, BookOpen, CalendarCheck, Loader2, AlertTriangle, CheckCheck } from 'lucide-react';
import { endpoints } from '@/lib/api';

interface Student {
  id: number;
  name: string;
  email: string;
  register_number: string;
  section: string;
}

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: {
    subject: string;         // subject name / code
    section: string;         // e.g. "CSE-3A"
    faculty: string;
    time_slot: string;
    period_index: number;
    day: string;
  };
  /** ISO date string for the class (YYYY-MM-DD). Only today's date is actionable. */
  classDate: string;
  teacherName: string;
}

type AttendanceMap = Record<number, 'P' | 'A'>; // studentId -> status

export function AttendanceModal({ isOpen, onClose, classInfo, classDate, teacherName }: AttendanceModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  /* ── Date helpers ── */
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const isToday = classDate === today;

  const dateLabel = new Date(classDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const loadData = useCallback(async () => {
    if (!isOpen || !classInfo.section) return;
    setLoading(true);
    setError('');
    setSuccess(false);
    setAlreadySubmitted(false);

    try {
      const [studentsRes, statusRes] = await Promise.all([
        endpoints.attendance.getStudentsForClass(classInfo.section),
        endpoints.attendance.getStatus({
          subject_code: classInfo.subject,
          section: classInfo.section,
          date: classDate,
          period_index: classInfo.period_index,
        }),
      ]);

      const studentList: Student[] = studentsRes.data.students || [];
      setStudents(studentList);

      if (statusRes.data.submitted) {
        setAlreadySubmitted(true);
        setSubmittedSession(statusRes.data.session);
        // Pre-fill from existing records
        const map: AttendanceMap = {};
        studentList.forEach(s => { map[s.id] = 'A'; });
        (statusRes.data.session?.records || []).forEach((r: any) => {
          map[r.student_id] = r.status;
        });
        setAttendance(map);
      } else {
        // Default all present
        const map: AttendanceMap = {};
        studentList.forEach(s => { map[s.id] = 'P'; });
        setAttendance(map);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load student list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, classInfo, classDate]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const toggle = (studentId: number) => {
    if (alreadySubmitted) return;
    setAttendance(prev => ({ ...prev, [studentId]: prev[studentId] === 'P' ? 'A' : 'P' }));
  };

  const markAll = (status: 'P' | 'A') => {
    if (alreadySubmitted) return;
    const map: AttendanceMap = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendance(map);
  };

  const presentCount = Object.values(attendance).filter(v => v === 'P').length;
  const absentCount  = Object.values(attendance).filter(v => v === 'A').length;

  const handleSubmit = async () => {
    if (!isToday || alreadySubmitted || students.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const records = students.map(s => ({ student_id: s.id, status: attendance[s.id] || 'A' }));
      await endpoints.attendance.submit({
        subject_code: classInfo.subject,
        subject_name: classInfo.subject,
        section: classInfo.section,
        faculty_name: teacherName,
        date: classDate,
        period_index: classInfo.period_index,
        time_slot: classInfo.time_slot,
        records,
      });
      setSuccess(true);
      setAlreadySubmitted(true);
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.error || 'Submission failed. Please try again.';

      if (status === 409 || code === 'DUPLICATE_SUBMISSION') {
        // Already submitted — treat as success, not error
        setAlreadySubmitted(true);
        setSuccess(false); // Show "already recorded" banner instead of "submitted successfully"
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="w-5 h-5 opacity-80" />
                <span className="text-sm font-medium opacity-80">Mark Attendance</span>
              </div>
              <h2 className="text-xl font-bold">{classInfo.subject}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm opacity-90">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Section {classInfo.section}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {classInfo.time_slot}</span>
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {classInfo.day}</span>
              </div>
              <p className="text-xs mt-1.5 opacity-70">{dateLabel}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats bar */}
          {students.length > 0 && !loading && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-white/20">
              <div className="text-center">
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs opacity-70">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-300">{presentCount}</p>
                <p className="text-xs opacity-70">Present</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-300">{absentCount}</p>
                <p className="text-xs opacity-70">Absent</p>
              </div>
              {students.length > 0 && (
                <div className="ml-auto text-center">
                  <p className="text-2xl font-bold">{Math.round(presentCount / students.length * 100)}%</p>
                  <p className="text-xs opacity-70">Today's %</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Not-today banner */}
          {!isToday && (
            <div className="m-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Cannot mark attendance</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Attendance can only be marked on the day of the class.
                  This class is scheduled for <strong>{dateLabel}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Already submitted banner */}
          {alreadySubmitted && (
            <div className="m-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {success ? 'Attendance submitted successfully!' : 'Attendance already recorded'}
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  {success
                    ? `Marked ${presentCount}P / ${absentCount}A for ${students.length} students.`
                    : `This session was already submitted. Showing read-only view.`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading student roster...</p>
            </div>
          )}

          {/* No students */}
          {!loading && students.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No students found for section <strong>{classInfo.section}</strong></p>
              <p className="text-xs mt-1 opacity-70">Ensure students have been assigned to this section.</p>
            </div>
          )}

          {/* Student list */}
          {!loading && students.length > 0 && (
            <div className="p-4">
              {/* Mark all buttons */}
              {!alreadySubmitted && isToday && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => markAll('P')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark All Present
                  </button>
                  <button
                    onClick={() => markAll('A')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Mark All Absent
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {students.map((student, idx) => {
                  const status = attendance[student.id] || 'A';
                  const isPresent = status === 'P';

                  return (
                    <div
                      key={student.id}
                      onClick={() => toggle(student.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                        alreadySubmitted
                          ? isPresent
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                          : isPresent
                            ? 'bg-green-50 border-green-200 cursor-pointer hover:bg-green-100'
                            : 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isPresent ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                        }`}>
                          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.register_number || student.email}</p>
                        </div>
                      </div>

                      {/* Toggle button */}
                      <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isPresent
                            ? 'bg-green-500 text-white border-green-500 shadow-sm'
                            : 'bg-red-500 text-white border-red-500 shadow-sm'
                        } ${alreadySubmitted ? 'opacity-80 cursor-default' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggle(student.id); }}
                        disabled={alreadySubmitted}
                      >
                        {isPresent ? <><CheckCircle2 className="w-3 h-3" /> P</> : <><XCircle className="w-3 h-3" /> A</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isToday && !alreadySubmitted && students.length > 0 && !loading && (
          <div className="border-t border-gray-100 p-4 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Submitting for <strong>{students.length}</strong> students · {presentCount}P / {absentCount}A
              </p>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CalendarCheck className="w-4 h-4" /> Submit Attendance</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
