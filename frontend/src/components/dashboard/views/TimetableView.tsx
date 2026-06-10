"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Download, ChevronLeft, ChevronRight, Users, User as UserIcon, ClipboardList, Lock, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { AttendanceModal } from '@/components/dashboard/AttendanceModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export function TimetableView() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [viewType, setViewType] = useState<'week' | 'day'>('week');
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');

  // Attendance modal state
  const [attendanceModal, setAttendanceModal] = useState<{
    isOpen: boolean;
    classInfo: { subject: string; section: string; faculty: string; time_slot: string; period_index: number; day: string; };
    classDate: string;
  }>({
    isOpen: false,
    classInfo: { subject: '', section: '', faculty: '', time_slot: '', period_index: 0, day: '' },
    classDate: '',
  });

  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'SUPER_TEACHER' || user?.role === 'ADMIN';

  const openAttendance = (classItem: any, day: string) => {
    if (!isTeacherOrAdmin) return;

    // Enforce that regular teachers and super teachers can only mark their own classes
    if (user?.role === 'TEACHER' || user?.role === 'SUPER_TEACHER') {
      const cleanName = (name: string) =>
        name.toLowerCase().replace(/^(prof\.?\s*|dr\.?\s*|mr\.?\s*|mrs\.?\s*|ms\.?\s*)/gi, '').trim();

      const teacherName = cleanName(`${user?.first_name || ''} ${user?.last_name || ''}`);
      const faculties = (classItem.faculty || '')
        .split(',')
        .map((f: string) => cleanName(f));

      const isAuthorized = faculties.some((f: string) => {
        if (teacherName.includes(f) || f.includes(teacherName)) return true;
        // Relaxed fallback: remove all non-alphabetic chars and check if they share a significant common part
        const tAlpha = teacherName.replace(/[^a-z]/g, '');
        const fAlpha = f.replace(/[^a-z]/g, '');
        if (tAlpha.length >= 5 && fAlpha.length >= 5) {
          if (tAlpha.includes(fAlpha.substring(0, 5)) || fAlpha.includes(tAlpha.substring(0, 5))) return true;
        }
        return false;
      });

      if (!isAuthorized) {
        alert(`You can only mark attendance for your own classes.\nThis class is assigned to ${classItem.faculty}.`);
        return;
      }
    }

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    setAttendanceModal({
      isOpen: true,
      classInfo: {
        subject: classItem.subject || '',
        section: classItem.section?.split(',')[0]?.trim() || '',
        faculty: classItem.faculty || '',
        time_slot: classItem.time_slot || classItem.period_name || '',
        period_index: classItem.period_index ?? 0,
        day,
      },
      classDate: today,
    });
  };

  useEffect(() => {
    const loadSaved = async () => {
      setLoading(true);
      try {
        // Always try API first to get the latest data (including substitutions)
        const res = await axios.get(`${HF_API}/schedule`);
        if (res.data.exists && res.data.grid) {
          const cached = localStorage.getItem('timetable_v2');
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              if (cachedData?.grid) {
                Object.keys(res.data.grid).forEach(secId => {
                  if (!cachedData.grid[secId]) return;
                  Object.keys(res.data.grid[secId].slots || {}).forEach(dayIdx => {
                    Object.keys(res.data.grid[secId].slots[dayIdx] || {}).forEach(pIdx => {
                      const apiClasses = res.data.grid[secId].slots[dayIdx][pIdx] || [];
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
          setTimetable(res.data);
          localStorage.setItem('timetable_v2', JSON.stringify(res.data));
          setLoading(false);
          return;
        }
      } catch {
        // API unreachable — fall back to cache
        const cached = localStorage.getItem('timetable_v2');
        if (cached) {
          try {
            setTimetable(JSON.parse(cached));
          } catch { /* corrupt cache */ }
        }
      }
      setLoading(false);
    };
    loadSaved();
  }, []);

  const allSections = useMemo(() => {
    if (!timetable?.grid) return [];
    return Object.keys(timetable.grid).sort();
  }, [timetable]);

  const allFaculties = useMemo(() => {
    if (!timetable?.grid) return [];
    const faculties = new Set<string>();
    Object.values(timetable.grid).forEach((secObj: any) => {
      Object.values(secObj.slots).forEach((dayObj: any) => {
        Object.values(dayObj).forEach((slotItems: any) => {
          slotItems.forEach((item: any) => {
            if (item.faculty) faculties.add(item.faculty);
          });
        });
      });
    });
    return Array.from(faculties).sort();
  }, [timetable]);

  // Set default selection based on user role
  useEffect(() => {
    if (user && timetable && allSections.length > 0) {
      if (user.role === 'STUDENT') {
        if (!selectedSection) {
          setSelectedSection(allSections[0]); // default to first section if no preference
        }
      } else {
        // Teacher or Admin
        if (allFaculties.length > 0 && !selectedFaculty && !selectedSection) {
          // Try to find the user in the faculties list
          const userFullName = `${user.first_name} ${user.last_name}`.trim().toLowerCase();
          const userFirstName = user.first_name.toLowerCase();
          const matchingFaculty = allFaculties.find(f => {
            const facLower = f.toLowerCase();
            return facLower.includes(userFirstName) || facLower.includes(userFullName);
          });

          if (matchingFaculty) {
            setSelectedFaculty(matchingFaculty);
          } else {
            setSelectedSection(allSections[0] || ''); // fallback
          }
        }
      }
    }
  }, [user, timetable, allFaculties, allSections]);

  const weekDays = timetable?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const headers = timetable?.headers || Array.from({ length: 10 }, (_, i) => `P${i + 1}`);

  // Build a map from period index to actual time string
  const periodTimeMap = useMemo(() => {
    const map: Record<number, string> = {};
    let periodIdx = 0;
    const breakAfter = timetable?.break_after_index ?? 2;
    const lunchAfter = timetable?.lunch_after_index ?? 5;
    const breakHeaderIdx = breakAfter + 1;
    const lunchHeaderIdx = lunchAfter + 2;
    headers.forEach((h: string, hi: number) => {
      if (hi === breakHeaderIdx || hi === lunchHeaderIdx) return;
      map[periodIdx] = h;
      periodIdx++;
    });
    return map;
  }, [timetable, headers]);

  // Build room lookup from schedule data
  const roomLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    if (!timetable?.schedule) return lookup;
    Object.values(timetable.schedule).forEach((entry: any) => {
      if (entry.room_name) {
        // Use parent section (e.g., "6a-E1" → "6A") for matching grid sections
        const rawSec = (entry.section_id || '').toUpperCase();
        const parentSec = rawSec.split('-')[0];
        const subjectUp = (entry.subject_code || '').toUpperCase();
        const dur = entry.duration || 1;
        // Create lookup entries for each period the class spans (handles labs)
        for (let i = 0; i < dur; i++) {
          const key = `${parentSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`;
          lookup[key] = entry.room_name;
        }
        // Also store with the full section ID for exact matches
        for (let i = 0; i < dur; i++) {
          const key = `${rawSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`;
          lookup[key] = entry.room_name;
        }
      }
    });
    return lookup;
  }, [timetable]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    if (!timetable?.grid) return {};

    const dataByDay: Record<string, any[]> = {};
    weekDays.forEach((d: string) => dataByDay[d] = []);

    const matchFaculty = selectedFaculty !== '';
    const matchSection = selectedSection !== '';

    // Determine the parent section for batch-sibling matching.
    // e.g. if selectedSection is "6A-E1", parentForBatch = "6A" so we also pick up "6A-E2".
    let parentForBatch = '';
    if (matchSection) {
      const batchMatch = selectedSection.match(/^(.+)-(E|B)\d+$/i);
      if (batchMatch) {
        parentForBatch = batchMatch[1]; // e.g. "6A"
      }
    }

    const { grid } = timetable;

    Object.keys(grid).forEach(sectionId => {
      if (matchSection) {
        if (parentForBatch) {
          // Include sibling batches: "6A-E1" and "6A-E2" both match parent "6A"
          const siblingMatch = sectionId.match(/^(.+)-(E|B)\d+$/i);
          const sectionParent = siblingMatch ? siblingMatch[1] : sectionId;
          if (sectionParent !== parentForBatch) return;
        } else {
          if (sectionId !== selectedSection) return;
        }
      }

      const sectionData = grid[sectionId];
      const sectionDays: number[] = sectionData.days || [];

      sectionDays.forEach((dayIdx: number) => {
        const dayName = weekDays[dayIdx];
        if (!dayName) return;

        const daySlots = sectionData.slots[String(dayIdx)] || {};

        let periodCounter = 0;
        const breakAfter = timetable.break_after_index ?? 2;
        const lunchAfter = timetable.lunch_after_index ?? 5;
        const breakHeaderIdx = breakAfter + 1;
        const lunchHeaderIdx = lunchAfter + 2;

        headers.forEach((h: string, hi: number) => {
          const isBreak = hi === breakHeaderIdx;
          const isLunch = hi === lunchHeaderIdx;

          if (isBreak || isLunch) return;

          const currentPeriod = periodCounter;
          const cells: any[] = daySlots[String(periodCounter)] || [];
          periodCounter++;

          cells.forEach((cell: any) => {
            if (matchFaculty && cell.faculty !== selectedFaculty) return;

            // Use actual time from the header (e.g., "1:40-2:35")
            const timeSlot = h;

            // Look up room from schedule
            const roomKey = `${sectionId.toUpperCase()}_${dayIdx}_${currentPeriod}_${(cell.subject || '').toUpperCase()}`;
            const room = roomLookup[roomKey] || cell.room || '';

            let batch = cell.batch || '';
            const subjectUpper = (cell.subject || '').toUpperCase();
            // Only assign batch labels to LAB subjects, not theory classes
            if (subjectUpper.includes('LAB')) {
              if (!batch) {
                const match = sectionId.match(/-(E|B)(\d+)$/i);
                if (match) batch = 'B' + match[2];
              }
              if (subjectUpper.includes('MLLAB')) batch = 'B1';
              if (subjectUpper.includes('NLPLAB')) batch = 'B2';
            }

            dataByDay[dayName].push({
              ...cell,
              time_slot: timeSlot,
              period_index: currentPeriod,
              section: sectionId,
              period_name: h,
              room,
              batch
            });
          });
        });
      });
    });

    // Inject complementary batch lab entries.
    // When MLLAB appears at a time slot, B2 is doing NLPLAB at the same time (and vice versa).
    // We add the complementary lab entry so both show in the same cell.
    const labPairs: Record<string, { complement: string; batch: string; complementBatch: string }> = {
      'MLLAB': { complement: 'NLPLAB', batch: 'B1', complementBatch: 'B2' },
      'NLPLAB': { complement: 'MLLAB', batch: 'B2', complementBatch: 'B1' },
    };

    weekDays.forEach((day: string) => {
      const toAdd: any[] = [];
      dataByDay[day]?.forEach((entry: any) => {
        const subjectUpper = (entry.subject || '').toUpperCase();
        const pair = labPairs[subjectUpper];
        if (!pair) return;

        // Check if the complement already exists at this period
        const complementExists = dataByDay[day].some(
          (e: any) => e.period_index === entry.period_index &&
            (e.subject || '').toUpperCase() === pair.complement
        );
        if (complementExists) return;

        // Look up the complement's room and faculty from the schedule
        let complementRoom = '';
        let complementFaculty = entry.faculty;
        if (timetable.schedule) {
          const complementEntry = Object.values(timetable.schedule).find((se: any) =>
            (se.subject_code || '').toUpperCase() === pair.complement
          );
          if (complementEntry) {
            complementRoom = (complementEntry as any).room_name || '';
            complementFaculty = (complementEntry as any).faculty_name || entry.faculty;
          }
        }

        toAdd.push({
          subject: pair.complement,
          faculty: complementFaculty,
          time_slot: entry.time_slot,
          period_index: entry.period_index,
          section: entry.section,
          period_name: entry.period_name,
          room: complementRoom,
          batch: pair.complementBatch,
          is_substituted: false,
        });

        // Also set the batch on the original entry
        entry.batch = pair.batch;
      });
      if (toAdd.length > 0) {
        dataByDay[day].push(...toAdd);
      }
    });

    // Sort by period index (actual chronological order)
    Object.keys(dataByDay).forEach(day => {
      // Combine sections for the same period+subject+faculty
      const uniqueTaughtSlots: Record<string, any> = {};

      dataByDay[day].forEach(item => {
        // Group by period, subject, and faculty. Parallel classes with different subjects will be separate objects,
        // but they will have the same period_index so they end up in the same cell in the matrix.
        const key = `${item.period_index}_${item.subject}_${item.faculty}`;

        if (uniqueTaughtSlots[key]) {
          const existing = uniqueTaughtSlots[key];
          if (!existing.section.includes(item.section)) {
            existing.section += `, ${item.section}`;
          }
          if (item.batch && (!existing.batch || !existing.batch.includes(item.batch))) {
            existing.batch = existing.batch ? `${existing.batch}, ${item.batch}` : item.batch;
          }
        } else {
          uniqueTaughtSlots[key] = { ...item };
        }
      });

      dataByDay[day] = Object.values(uniqueTaughtSlots);

      // Sort by period_index for correct time ordering
      dataByDay[day].sort((a, b) => (a.period_index ?? 0) - (b.period_index ?? 0));
    });

    return dataByDay;
  }, [timetable, selectedSection, selectedFaculty, weekDays, headers]);

  // Generate 2D matrix for the Week View Grid
  const matrix = useMemo(() => {
    const m: Record<string, Record<number, any[]>> = {};
    weekDays.forEach((d: string) => m[d] = {});

    Object.keys(filteredData).forEach(day => {
      filteredData[day].forEach(cls => {
        if (cls.period_index !== undefined) {
          if (!m[day][cls.period_index]) {
            m[day][cls.period_index] = [];
          }
          m[day][cls.period_index].push(cls);
        }
      });
    });
    return m;
  }, [filteredData, weekDays]);


  const handleExport = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Title
    const title = selectedSection
      ? `Timetable — Section ${selectedSection}`
      : selectedFaculty
        ? `Timetable — ${selectedFaculty}`
        : 'Timetable';
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 21);
    doc.setTextColor(0);

    // Build table headers
    const breakAfter = timetable?.break_after_index ?? 2;
    const lunchAfter = timetable?.lunch_after_index ?? 5;
    const breakHeaderIdx = breakAfter + 1;
    const lunchHeaderIdx = lunchAfter + 2;

    const periodHeaders = headers.filter((_: string, i: number) => i !== breakHeaderIdx && i !== lunchHeaderIdx);
    const tableHead = [['DAY', ...periodHeaders]];

    // Build table body
    const tableBody: any[][] = [];
    weekDays.forEach((day: string) => {
      const row: any[] = [day.substring(0, 3).toUpperCase()];
      let periodCounter = 0;
      headers.forEach((_h: string, hi: number) => {
        if (hi === breakHeaderIdx || hi === lunchHeaderIdx) return;
        const classes = matrix[day]?.[periodCounter] || [];
        periodCounter++;
        if (classes.length === 0) {
          row.push('');
        } else {
          const cellText = classes.map((cls: any) => {
            let line = (cls.subject || '').toUpperCase();
            if (cls.batch) line += ` [${cls.batch}]`;
            line += `\n${cls.faculty || ''}`;
            if (cls.room) line += ` | ${cls.room}`;
            return line;
          }).join('\n---\n');
          row.push(cellText);
        }
      });
      tableBody.push(row);
    });

    // Render table
    autoTable(doc, {
      head: tableHead,
      body: tableBody,
      startY: 25,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [67, 56, 202],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18, fillColor: [245, 245, 255] },
      },
      bodyStyles: {
        halign: 'center',
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw) {
          const raw = String(data.cell.raw);
          if (raw.includes('LAB')) {
            data.cell.styles.fillColor = [240, 253, 244];
          } else if (raw.includes('[')) {
            data.cell.styles.fillColor = [248, 250, 252];
          }
        }
      },
    });

    doc.save(`timetable_${(selectedSection || selectedFaculty || 'all').replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return <div className="flex justify-center p-10">Loading timetable...</div>;
  }

  if (!timetable?.grid) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border mt-6 text-gray-500">
        <Clock className="w-12 h-12 mb-4 text-gray-300" />
        <h3 className="text-xl font-bold text-gray-800">No Timetable Available</h3>
        <p className="mt-2 text-sm text-center">There is no active generated timetable.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Timetable</h1>
          <p className="text-sm text-gray-500 mt-1">Personalized weekly schedule</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          {/* Filters Based on Role */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm max-w-full overflow-hidden">
            {user?.role === 'STUDENT' ? (
              <>
                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="text-sm bg-transparent border-none outline-none text-gray-700 cursor-pointer w-full"
                >
                  {allSections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                </select>
              </>
            ) : (
              <>
                <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={selectedFaculty}
                  onChange={e => {
                    setSelectedFaculty(e.target.value);
                    setSelectedSection('');
                  }}
                  className="text-sm bg-transparent border-none outline-none text-gray-700 cursor-pointer min-w-24 max-w-[140px] truncate"
                >
                  <option value="">-- Faculty --</option>
                  {allFaculties.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                </select>

                <div className="w-px h-6 bg-gray-200 mx-1 shrink-0"></div>

                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={selectedSection}
                  onChange={e => {
                    setSelectedSection(e.target.value);
                    setSelectedFaculty('');
                  }}
                  className="text-sm bg-transparent border-none outline-none text-gray-700 cursor-pointer min-w-24 max-w-[120px] truncate"
                >
                  <option value="">-- Section --</option>
                  {allSections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </>
            )}
          </div>

          <div className="flex bg-white rounded-lg border border-gray-100 p-1 shadow-sm shrink-0">
            <button
              onClick={() => setViewType('week')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewType === 'week'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewType('day')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewType === 'day'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              Day View
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-transparent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center justify-between">
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center flex gap-1">
          <h3 className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-none">
            {selectedFaculty ? `Schedule for ${selectedFaculty}` :
              selectedSection ? `Section ${selectedSection} Schedule` : 'Select a Filter'}
          </h3>
        </div>

        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Week View */}
      {viewType === 'week' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm bg-white/50 backdrop-blur-sm animate-fade-in scrollbar-thin">
          <table className="w-full min-w-[1000px] text-sm border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80">
                <th className="py-3 px-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-slate-200/80 z-10 w-16 shadow-[1px_0_0_0_rgba(226,232,240,0.8)]">
                  Day
                </th>
                {headers.map((h: string, i: number) => (
                  <th key={i} className="py-2 px-1 text-center font-bold text-slate-600 text-[10px] sm:text-xs uppercase tracking-wider">
                    {h.replace('-', ' - ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weekDays.map((dayName: string, rowNum: number) => {
                let periodCounter = 0;
                const breakAfter = timetable?.break_after_index ?? 2;
                const lunchAfter = timetable?.lunch_after_index ?? 5;
                const breakHeaderIdx = breakAfter + 1;
                const lunchHeaderIdx = lunchAfter + 2;

                // Pre-calculate spans to merge adjacent identical classes (Labs)
                const rowCells = [];
                const matrixDay = matrix[dayName] || {};
                let colIdx = 0;

                while (colIdx < headers.length) {
                  const isBreak = colIdx === breakHeaderIdx;
                  const isLunch = colIdx === lunchHeaderIdx;

                  if (isBreak || isLunch) {
                    rowCells.push({ type: isBreak ? 'break' : 'lunch', colIdx, colSpan: 1 });
                    colIdx++;
                    continue;
                  }

                  const currentPeriod = periodCounter;
                  const classes = matrixDay[currentPeriod] || [];

                  if (classes.length === 0) {
                    rowCells.push({ type: 'empty', colIdx, currentPeriod, colSpan: 1 });
                    colIdx++;
                    periodCounter++;
                  } else {
                    let duration = 1;
                    let peekColIdx = colIdx + 1;
                    let peekPeriodCounter = currentPeriod + 1;

                    while (peekColIdx < headers.length) {
                      if (peekColIdx === breakHeaderIdx || peekColIdx === lunchHeaderIdx) break;
                      const peekClasses = matrixDay[peekPeriodCounter] || [];
                      const isSame = peekClasses.length === classes.length && peekClasses.length > 0 &&
                        classes.every((c: any, i: number) => c.subject === peekClasses[i].subject && c.faculty === peekClasses[i].faculty);
                      if (isSame) {
                        duration++;
                        peekColIdx++;
                        peekPeriodCounter++;
                      } else {
                        break;
                      }
                    }
                    rowCells.push({ type: 'class', colIdx, currentPeriod, colSpan: duration, classes });
                    colIdx += duration;
                    periodCounter += duration;
                  }
                }

                return (
                  <tr key={dayName} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-2 px-2 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50/80 transition-colors border-r border-slate-100 shadow-[1px_0_0_0_rgba(241,245,249,1)] z-10 text-xs uppercase">
                      {dayName.substring(0, 3)}
                    </td>
                    {rowCells.map((cell: any, i: number) => {
                      if (cell.type === 'break' || cell.type === 'lunch') {
                        if (rowNum === 0) {
                          return (
                            <td key={cell.colIdx} rowSpan={weekDays.length}
                              className={`bg-gradient-to-b ${cell.type === 'break' ? 'from-amber-50/60 to-orange-50/60 border-amber-100/50' : 'from-blue-50/60 to-indigo-50/60 border-blue-100/50'} border-x p-1 align-middle w-8`}>
                              <div className="flex items-center justify-center h-full">
                                <span className={`font-bold text-[9px] tracking-[0.2em] uppercase whitespace-nowrap -rotate-180 ${cell.type === 'break' ? 'text-amber-700/70' : 'text-blue-700/70'}`} style={{ writingMode: 'vertical-rl' }}>
                                  {cell.type === 'break' ? '☕ Break' : '🍽️ Lunch'}
                                </span>
                              </div>
                            </td>
                          );
                        }
                        return null;
                      }

                      if (cell.type === 'empty') {
                        return <td key={cell.colIdx} className="p-1 border-slate-50/50 border border-dashed"></td>;
                      }

                      return (
                        <td key={cell.colIdx} colSpan={cell.colSpan} className="p-1.5 align-top h-full border border-slate-50/50 border-dashed">
                          <div className="flex flex-col gap-1.5 h-full">
                            {cell.classes.length > 1 ? (
                              (() => {
                                const baseColors = getColorForSubject(cell.classes[0].subject);
                                const isClassToday = dayName === new Date().toLocaleDateString('en-US', { weekday: 'long' });
                                return (
                                  <div className={`relative p-2 rounded-xl border ${baseColors.border} ${baseColors.bg} shadow-sm transition-all duration-300 flex flex-col gap-1.5`}>
                                    {cell.classes.map((cls: any, idx: number) => {
                                      const colors = getColorForSubject(cls.subject);
                                      return (
                                        <div key={idx}
                                          onClick={() => isTeacherOrAdmin && openAttendance(cls, dayName)}
                                          className={`flex flex-col border-b border-black/5 last:border-0 pb-1.5 last:pb-0 ${isTeacherOrAdmin ? 'cursor-pointer hover:bg-black/5 rounded p-1 -mx-1' : ''}`}>
                                          <div className={`font-bold text-xs sm:text-sm ${colors.textPrimary} flex items-center gap-1.5 flex-wrap`}>
                                            <span>{cls.subject}</span>
                                            {cls.batch && <span className="px-1.5 py-0.5 bg-white/60 border border-current/20 rounded-full text-[9px] font-bold tracking-wide shrink-0">{cls.batch}</span>}
                                          </div>
                                          <div className={`flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold ${colors.textSecondary} mt-0.5`}>
                                            <span className="flex items-center gap-1 truncate"><UserIcon className="w-3 h-3 shrink-0" /> {cls.faculty}</span>
                                            {cls.room && <span className="flex items-center gap-1 shrink-0"><MapPin className="w-3 h-3 shrink-0" /> {cls.room}</span>}
                                          </div>
                                          {isTeacherOrAdmin && (
                                            <div className="mt-1.5 pt-1.5 border-t border-black/5 flex justify-end">
                                              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${isClassToday ? 'bg-blue-600 text-white' : 'bg-white/60 text-slate-500'}`}>
                                                {isClassToday ? <ClipboardList className="w-2.5 h-2.5" /> : <Lock className="w-2 h-2" />}
                                                {isClassToday ? 'Mark' : 'Locked'}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()
                            ) : (
                              cell.classes.map((cls: any, idx: number) => {
                                const colors = cls.is_substituted
                                  ? { bg: 'bg-orange-50/90', border: 'border-orange-200', textPrimary: 'text-orange-800', textSecondary: 'text-orange-600/90', icon: 'text-orange-500/80' }
                                  : getColorForSubject(cls.subject);
                                const isClassToday = dayName === new Date().toLocaleDateString('en-US', { weekday: 'long' });

                                return (
                                  <div key={idx}
                                    onClick={() => isTeacherOrAdmin && openAttendance(cls, dayName)}
                                    className={`relative p-2 rounded-xl border ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-all duration-300 ${isTeacherOrAdmin ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}>
                                    <div className={`font-bold text-xs sm:text-sm mb-1.5 ${colors.textPrimary} flex justify-between items-start gap-1`}>
                                      <span className="whitespace-pre-line leading-tight">{cls.subject}</span>
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        {cls.batch && <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full border border-current/20 font-bold tracking-wide">{cls.batch}</span>}
                                        {cls.is_substituted && <span className="text-[8px] bg-orange-100 border border-orange-200 text-orange-700 px-1 py-0.5 rounded uppercase tracking-wider mt-0.5">Sub</span>}
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      {user?.role === 'STUDENT' ? (
                                        <div className={`flex items-start gap-1.5 text-[10px] font-semibold ${colors.textSecondary}`}>
                                          <UserIcon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${colors.icon}`} />
                                          <span className="whitespace-pre-line">{cls.faculty}</span>
                                        </div>
                                      ) : (
                                        <div className={`flex items-start gap-1.5 text-[10px] font-semibold ${colors.textSecondary}`}>
                                          <Users className={`w-3 h-3 flex-shrink-0 mt-0.5 ${colors.icon}`} />
                                          <span className="whitespace-pre-line">Sec {cls.section}</span>
                                        </div>
                                      )}
                                      {cls.room && (
                                        <div className={`flex items-start gap-1.5 text-[10px] font-semibold ${colors.textSecondary}`}>
                                          <MapPin className={`w-3 h-3 flex-shrink-0 mt-0.5 ${colors.icon}`} />
                                          <span className="whitespace-pre-line">{cls.room}</span>
                                        </div>
                                      )}
                                      {isTeacherOrAdmin && (
                                        <div className="mt-1.5 pt-1.5 border-t border-black/5 flex justify-end">
                                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${isClassToday ? 'bg-blue-600 text-white' : 'bg-white/60 text-slate-500'
                                            }`}>
                                            {isClassToday ? <ClipboardList className="w-2.5 h-2.5" /> : <Lock className="w-2 h-2" />}
                                            {isClassToday ? 'Mark' : 'Locked'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Day View */
        <div>
          {/* Day Selector */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-3 pt-1 scrollbar-hide px-1">
            {weekDays.map((day: string) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${selectedDay === day
                  ? 'bg-blue-600 text-white shadow-md transform scale-[1.02]'
                  : 'bg-white text-gray-700 border border-gray-100 hover:border-blue-300 hover:bg-gray-50'
                  }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Day Schedule */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedDay}'s Classes
              </h3>
            </div>

            <div className="space-y-4">
              {filteredData[selectedDay]?.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-100">
                  <p className="text-gray-500 font-medium">No classes scheduled for {selectedDay}.</p>
                </div>
              )}
              {filteredData[selectedDay]?.map((classItem, idx) => {
                const isClassToday = selectedDay === new Date().toLocaleDateString('en-US', { weekday: 'long' });
                return (
                  <div
                    key={idx}
                    onClick={() => isTeacherOrAdmin && openAttendance(classItem, selectedDay)}
                    className={`flex flex-col md:flex-row gap-5 p-5 rounded-xl border transition-all duration-200 group ${classItem.is_substituted
                      ? 'bg-[#fff7ed] border-orange-200 shadow-orange-100/50'
                      : 'bg-[#f0fdf4] border-[#bbf7d0] shadow-green-100/30'
                      } ${isTeacherOrAdmin ? 'cursor-pointer hover:shadow-lg hover:scale-[1.005]' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center shrink-0 md:w-28 gap-2">
                      <div className={`p-3 font-bold text-lg rounded-xl shadow-sm w-full text-center ${classItem.is_substituted
                        ? 'bg-orange-600/10 text-orange-700'
                        : 'bg-emerald-600/10 text-emerald-800'
                        }`}>
                        {classItem.time_slot || classItem.period_name}
                      </div>
                      {isTeacherOrAdmin && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold w-full justify-center ${isClassToday
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}>
                          {isClassToday ? <ClipboardList className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {isClassToday ? 'Mark Attendance' : 'Not Today'}
                        </div>
                      )}
                    </div>

                    <div className={`w-px hidden md:block ${classItem.is_substituted ? 'bg-orange-200' : 'bg-emerald-200'}`}></div>

                    <div className="flex-1 space-y-3 py-1">
                      <div>
                        <h4 className={`font-bold text-xl flex items-center gap-3 ${classItem.is_substituted ? 'text-orange-900' : 'text-emerald-900'}`}>
                          {classItem.subject}
                          {classItem.is_substituted && <span className="text-xs bg-orange-600/10 text-orange-700 px-2 py-1 rounded-md font-bold uppercase tracking-wide">Substitute Class</span>}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <UserIcon className={`w-4 h-4 ${classItem.is_substituted ? 'text-orange-400' : 'text-emerald-500'}`} />
                          <p className={`text-sm font-semibold ${classItem.is_substituted ? 'text-orange-700' : 'text-emerald-700'}`}>{classItem.faculty}</p>
                        </div>
                        {classItem.is_substituted && classItem.original_faculty && (
                          <div className="flex items-center gap-2 mt-1">
                            <UserIcon className="w-3.5 h-3.5 text-orange-400" />
                            <p className="text-xs text-orange-600 italic">Original: {classItem.original_faculty}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 pt-2">
                        <div className={`flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg border ${classItem.is_substituted ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                          <Users className="w-4 h-4 opacity-70" />
                          <span className="font-bold">Sec {classItem.section}</span>
                        </div>
                        {classItem.room && (
                          <div className={`flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg border ${classItem.is_substituted ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                            <MapPin className="w-4 h-4 opacity-70" />
                            <span className="font-bold">{classItem.room}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={attendanceModal.isOpen}
        onClose={() => setAttendanceModal(prev => ({ ...prev, isOpen: false }))}
        classInfo={attendanceModal.classInfo}
        classDate={attendanceModal.classDate}
        teacherName={`${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()}
      />
    </div>
  );
}
