"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import {
    AlertCircle, Save, Undo2, RotateCcw, GripVertical,
    CheckCircle, X, Clock, MapPin, ChevronRight, Zap, Info, History,
    Plus, Users, BookOpen, ToggleLeft, ToggleRight, UserPlus, Loader2
} from 'lucide-react';
import { endpoints } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ClassEntry {
    subject: string;
    faculty: string;
    is_substituted?: boolean;
    original_faculty?: string;
    duration?: number;
    elective_group?: string;
    is_open_elective?: boolean;
    [key: string]: any;
}

interface GroupedMoveEntry {
    section: string;
    dayIdx: number;
    periodIdx: number;
    cardIndex: number;
    classData: ClassEntry;
}

interface DragPayload {
    section: string;
    dayIdx: number;
    periodIdx: number;
    cardIndex: number;
    classData: ClassEntry;
    
    // Group properties
    duration: number;
    isGroupMove: boolean;
    groupEntries: GroupedMoveEntry[];
}

interface EditRecord {
    payload: DragPayload;
    targetSection: string;
    targetDay: number;
    targetPeriod: number;
    replacedEntries: GroupedMoveEntry[]; // Classes that were at the target before drop
    timestamp: number;
}

// ─── Add Subject types ─────────────────────────────────────────────────────
interface SubjectData {
    code: string;
    name: string;
    type: string;
    credits: number;
    is_core?: boolean;
    is_heavy?: boolean;
}

interface FacultyData {
    id: string;
    name: string;
    designation: string;
    max_hours: number;
    status?: 'free' | 'busy';
}

interface AddSubjectTarget {
    section: string;
    dayIdx: number;
    periodIdx: number | null;
    isGlobal?: boolean;
    globalPeriods?: number[];
}

// ─── Color palette for sections ─────────────────────────────────────────────
const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; pill: string }> = {};
const PALETTE = [
    { bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.18)', text: '#4f46e5', pill: 'bg-indigo-500' },
    { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.18)', text: '#059669', pill: 'bg-emerald-500' },
    { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)', text: '#d97706', pill: 'bg-amber-500' },
    { bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.18)', text: '#db2777', pill: 'bg-pink-500' },
    { bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.18)', text: '#0284c7', pill: 'bg-sky-500' },
    { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.18)', text: '#7c3aed', pill: 'bg-violet-500' },
];

function getSectionColor(section: string, idx: number) {
    if (!SECTION_COLORS[section]) {
        SECTION_COLORS[section] = PALETTE[idx % PALETTE.length];
    }
    return SECTION_COLORS[section];
}

// ─── Subject color hash ────────────────────────────────────────────────────
const SUBJECT_HUES: Record<string, number> = {};
function subjectHue(subject: string): number {
    if (!SUBJECT_HUES[subject]) {
        let h = 0;
        for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) % 360;
        SUBJECT_HUES[subject] = h;
    }
    return SUBJECT_HUES[subject];
}

// ─── Deep clone helper ─────────────────────────────────────────────────────
function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

// ─── Normalize helpers for matching grid ↔ schedule entries ────────────
// The grid stores shortened faculty names (no "Prof./Dr./Mr./Ms." prefix)
// and UPPERCASED subject codes, while the schedule stores the originals.
function normalizeFaculty(name: string): string {
    return name.replace(/Prof\.\s*/g, '').replace(/Dr\.\s*/g, '')
               .replace(/Mr\.\s*/g, '').replace(/Ms\.\s*/g, '').trim().toLowerCase();
}
function normalizeSubject(code: string): string {
    return code.trim().toUpperCase();
}

const HF_API = process.env.NEXT_PUBLIC_HF_API || 'https://kindalien-timetable-gen.hf.space';

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export function DragDropTimetableEditor() {
    const { user } = useAuth();

    // Grid data
    const [grid, setGrid] = useState<Record<string, any> | null>(null);
    const [originalGrid, setOriginalGrid] = useState<Record<string, any> | null>(null);
    const [schedule, setSchedule] = useState<Record<string, any> | null>(null);
    const [originalSchedule, setOriginalSchedule] = useState<Record<string, any> | null>(null);

    const [days, setDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    const [headers, setHeaders] = useState<string[]>([]);
    const [breakAfter, setBreakAfter] = useState(2);
    const [lunchAfter, setLunchAfter] = useState(5);

    // Editor state
    const [activeSection, setActiveSection] = useState<string>('');
    const [editHistory, setEditHistory] = useState<EditRecord[]>([]);
    const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
    const [highlightedCells, setHighlightedCells] = useState<Record<string, { status: 'free' | 'conflict'; reason?: string }>>({});
    const [hoveredConflictCell, setHoveredConflictCell] = useState<{ key: string; reason: string; x: number; y: number } | null>(null);
    const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [showAvailablePanel, setShowAvailablePanel] = useState(false);
    const [savedChanges, setSavedChanges] = useState<{ subject: string; faculty: string; fromDay: string; fromPeriod: number; toDay: string; toPeriod: number; savedAt: string }[]>([]);
    const [highlightInfo, setHighlightInfo] = useState<{ day: string, period: number, subject: string } | null>(null);

    // ── Add Subject state ─────────────────────────────────────────────────
    const [subjectsList, setSubjectsList] = useState<SubjectData[]>([]);
    const [facultiesList, setFacultiesList] = useState<FacultyData[]>([]);
    const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
    const [addSubjectTarget, setAddSubjectTarget] = useState<AddSubjectTarget | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [useCustomSubject, setUseCustomSubject] = useState(false);
    const [customSubjectName, setCustomSubjectName] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState<string>('');
    const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
    const [freeTeachers, setFreeTeachers] = useState<FacultyData[]>([]);
    const [busyTeachers, setBusyTeachers] = useState<FacultyData[]>([]);
    const [loadingTeachers, setLoadingTeachers] = useState(false);
    const [injectingSubject, setInjectingSubject] = useState(false);
    const [removingClass, setRemovingClass] = useState<string | null>(null);

    // Refs
    const gridRef = useRef<HTMLDivElement>(null);

    // ── Load timetable from API ───────────────────────────────────────────
    useEffect(() => {
        const loadTimetable = async () => {
            try {
                const res = await axios.get(`${HF_API}/schedule`);
                const data = res.data;
                if (data && data.exists && data.grid) {
                    setGrid(deepClone(data.grid));
                    setOriginalGrid(deepClone(data.grid));
                    
                    if (data.schedule) {
                        setSchedule(deepClone(data.schedule));
                        setOriginalSchedule(deepClone(data.schedule));
                    }
                    
                    if (data.days) setDays(data.days);
                    if (data.headers) setHeaders(data.headers);
                    if (data.break_after_index != null) setBreakAfter(data.break_after_index);
                    if (data.lunch_after_index != null) setLunchAfter(data.lunch_after_index);

                    const sectionsList = Object.keys(data.grid).sort();
                    let targetSection = sectionsList.length > 0 ? sectionsList[0] : '';
                    if (typeof window !== 'undefined') {
                        const params = new URLSearchParams(window.location.search);
                        const querySection = params.get('section');
                        if (querySection && sectionsList.includes(querySection)) {
                            targetSection = querySection;
                        }
                        
                        const dayName = params.get('day');
                        const periodStr = params.get('period');
                        const subject = params.get('subject');
                        if (dayName && periodStr && subject) {
                            setHighlightInfo({ day: dayName, period: parseInt(periodStr, 10), subject });
                        }
                    }
                    setActiveSection(targetSection);
                } else {
                    setError("No active timetable found on the server.");
                }
            } catch (err) {
                console.error("Failed to load timetable.", err);
                setError("Failed to fetch timetable from server.");
            }
        };
        loadTimetable();
    }, []);

    // ── Load subjects & faculties for Add Subject feature ─────────────────
    useEffect(() => {
        const loadMasterData = async () => {
            try {
                const [subRes, facRes] = await Promise.all([
                    axios.get(`${HF_API}/data/subjects`),
                    axios.get(`${HF_API}/data/faculties`),
                ]);
                setSubjectsList(subRes.data.subjects || []);
                setFacultiesList(facRes.data.faculties || []);
            } catch (err) {
                console.error('Failed to load subjects/faculties for Add Subject', err);
            }
        };
        loadMasterData();
    }, []);

    // ── Compute free teachers for a given slot (client-side) ─────────────
    const computeFreeTeachers = useCallback((dayIdx: number, periodIdx: number | null, globalPeriods?: number[]) => {
        if (!grid || facultiesList.length === 0) return;
        
        const periodsToCheck = globalPeriods && globalPeriods.length > 0 ? globalPeriods : (periodIdx !== null ? [periodIdx] : []);
        if (periodsToCheck.length === 0) {
            setFreeTeachers([]);
            setBusyTeachers([]);
            return;
        }

        setLoadingTeachers(true);

        // A teacher can only be in one place — always scan ALL sections
        const busyNames = new Set<string>();
        for (const sec of Object.keys(grid)) {
            for (const p of periodsToCheck) {
                const classes: any[] = grid[sec]?.slots?.[String(dayIdx)]?.[String(p)] || [];
                classes.forEach((c: any) => busyNames.add((c.faculty || '').trim().toLowerCase()));
            }
        }

        const free: FacultyData[] = [];
        const busy: FacultyData[] = [];

        for (const fac of facultiesList) {
            const shortName = fac.name.replace(/Prof\.\s*/g, '').replace(/Dr\.\s*/g, '')
                .replace(/Mr\.\s*/g, '').replace(/Ms\.\s*/g, '').trim().toLowerCase();
            const fullNameLower = fac.name.trim().toLowerCase();

            if (busyNames.has(shortName) || busyNames.has(fullNameLower)) {
                busy.push({ ...fac, status: 'busy' });
            } else {
                free.push({ ...fac, status: 'free' });
            }
        }

        setFreeTeachers(free);
        setBusyTeachers(busy);
        setLoadingTeachers(false);
    }, [grid, facultiesList]);

    // ── Open Add Subject modal ───────────────────────────────────────────
    const openAddSubjectModal = useCallback((section: string, dayIdx: number, periodIdx: number) => {
        setAddSubjectTarget({ section, dayIdx, periodIdx });
        setSelectedSubject('');
        setUseCustomSubject(false);
        setCustomSubjectName('');
        setSelectedFaculty('');
        setSelectedSections(new Set([section])); // Start with just the clicked section
        setShowAddSubjectModal(true);
        computeFreeTeachers(dayIdx, periodIdx);
    }, [computeFreeTeachers]);

    // ── Open Global Add Subject modal ────────────────────────────────────
    const openGlobalAddSubjectModal = useCallback(() => {
        if (!grid || Object.keys(grid).length === 0) return;
        const firstSection = activeSection || Object.keys(grid).sort()[0];
        setAddSubjectTarget({ section: firstSection, dayIdx: 0, periodIdx: null, isGlobal: true, globalPeriods: [] });
        setSelectedSubject('');
        setUseCustomSubject(false);
        setCustomSubjectName('');
        setSelectedFaculty('');
        setSelectedSections(new Set()); // Start with none selected
        setShowAddSubjectModal(true);
        // Free teachers will be computed when a period is selected
        setFreeTeachers([]);
        setBusyTeachers([]);
    }, [grid, activeSection]);

    // ── Toggle a section in multi-select ─────────────────────────────────
    const toggleSection = useCallback((sec: string) => {
        setSelectedSections(prev => {
            const next = new Set(prev);
            if (next.has(sec)) {
                // Don't allow deselecting the last section
                if (next.size > 1) next.delete(sec);
            } else {
                next.add(sec);
            }
            return next;
        });
    }, []);

    // ── Select / deselect all sections ───────────────────────────────────
    const selectAllSections = useCallback((all: boolean) => {
        if (all && grid) {
            setSelectedSections(new Set(Object.keys(grid).sort()));
        } else if (addSubjectTarget && !addSubjectTarget.isGlobal) {
            setSelectedSections(new Set([addSubjectTarget.section]));
        } else {
            setSelectedSections(new Set());
        }
    }, [grid, addSubjectTarget]);

    // ── Inject subject into timetable ────────────────────────────────────
    const handleInjectSubject = async () => {
        if (!addSubjectTarget || !selectedFaculty || !grid) return;
        const hasValidPeriod = addSubjectTarget.isGlobal 
            ? (addSubjectTarget.globalPeriods && addSubjectTarget.globalPeriods.length > 0)
            : addSubjectTarget.periodIdx !== null;
            
        if (!hasValidPeriod) return;

        // Resolve the subject code
        const effectiveSubject = useCustomSubject ? customSubjectName.trim().toLowerCase().replace(/\s+/g, '_') : selectedSubject;
        if (!effectiveSubject) return;

        setInjectingSubject(true);
        setError(null);

        try {
            const subjectData = subjectsList.find(s => s.code === effectiveSubject);
            const duration = subjectData?.type === 'LAB' ? 2 : 1;

            // Build entries for all selected sections and periods
            const targetSections = Array.from(selectedSections);
            const periods = addSubjectTarget.isGlobal && addSubjectTarget.globalPeriods && addSubjectTarget.globalPeriods.length > 0 
                ? addSubjectTarget.globalPeriods 
                : [addSubjectTarget.periodIdx];

            const entries: any[] = [];
            for (const sec of targetSections) {
                for (const pIdx of periods) {
                    if (pIdx === null) continue;
                    entries.push({
                        section_id: sec,
                        day_index: addSubjectTarget.dayIdx,
                        period_index: pIdx,
                        subject_code: effectiveSubject,
                        faculty_name: selectedFaculty,
                        duration,
                    });
                }
            }

            const res = await axios.post(`${HF_API}/schedule/inject`, { entries });

            if (res.data.status === 'SUCCESS') {
                // Update the grid and schedule from the response
                if (res.data.grid) {
                    setGrid(deepClone(res.data.grid));
                    setOriginalGrid(deepClone(res.data.grid));
                }
                if (res.data.schedule) {
                    setSchedule(deepClone(res.data.schedule));
                    setOriginalSchedule(deepClone(res.data.schedule));
                }

                // Close modal
                setShowAddSubjectModal(false);
                setAddSubjectTarget(null);

                // Show success briefly
                setSavingState('saved');
                setTimeout(() => setSavingState('idle'), 2500);
            } else {
                setError('Failed to inject subject: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('Inject subject failed', err);
            setError('Failed to add subject: ' + (err?.response?.data?.detail || err.message || 'Server error'));
        } finally {
            setInjectingSubject(false);
        }
    };

    // ── Remove class from timetable ──────────────────────────────────────
    const handleRemoveClass = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to remove this class from the timetable?")) return;
        
        setRemovingClass(taskId);
        setError(null);

        try {
            const res = await axios.post(`${HF_API}/schedule/remove`, { task_id: taskId });
            if (res.data.status === 'SUCCESS') {
                if (res.data.grid) {
                    setGrid(deepClone(res.data.grid));
                    setOriginalGrid(deepClone(res.data.grid));
                }
                if (res.data.schedule) {
                    setSchedule(deepClone(res.data.schedule));
                    setOriginalSchedule(deepClone(res.data.schedule));
                }
                setSavingState('saved');
                setTimeout(() => setSavingState('idle'), 2500);
            } else {
                setError('Failed to remove class: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('Remove class failed', err);
            setError('Failed to remove class: ' + (err?.response?.data?.detail || err.message || 'Server error'));
        } finally {
            setRemovingClass(null);
        }
    };

    // ── Derived values ────────────────────────────────────────────────────
    const sections = grid ? Object.keys(grid).sort() : [];
    const breakHeaderIdx = breakAfter + 1;
    const lunchHeaderIdx = lunchAfter + 2;
    const hasUnsavedChanges = editHistory.length > 0;

    // Build room lookup from schedule data
    const roomLookup = useMemo(() => {
        const lookup: Record<string, string> = {};
        if (!schedule) return lookup;
        Object.values(schedule).forEach((entry: any) => {
            if (entry.room_name) {
                const rawSec = (entry.section_id || '').toUpperCase();
                const parentSec = rawSec.split('-')[0];
                const subjectUp = (entry.subject_code || '').toUpperCase();
                const dur = entry.duration || 1;
                for (let i = 0; i < dur; i++) {
                    lookup[`${parentSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`] = entry.room_name;
                    lookup[`${rawSec}_${entry.day_index}_${entry.period_index + i}_${subjectUp}`] = entry.room_name;
                }
            }
        });
        return lookup;
    }, [schedule]);

    // Get the day indices for the active section
    const activeDayIndices: number[] = grid && activeSection && grid[activeSection]
        ? (grid[activeSection].days || [0, 1, 2, 3, 4])
        : [0, 1, 2, 3, 4];

    // ── Group conflict detection ───────────────────────────────────────────
    const checkGroupConflict = useCallback((
        payload: DragPayload | null,
        targetDay: number,
        targetPeriod: number,
    ): { conflict: boolean; conflictReason: string; conflictDetails?: { subject: string; faculty: string; section: string } } => {
        if (!grid || !payload) return { conflict: false, conflictReason: '' };

        // For each entry in the group, calculate its relative target
        const deltaDay = targetDay - payload.dayIdx;
        const deltaPeriod = targetPeriod - payload.periodIdx;

        // Determine real teaching periods to check bounds
        let numTeachingPeriods = 0;
        for (let hi = 0; hi < headers.length; hi++) {
            if (hi !== breakHeaderIdx && hi !== lunchHeaderIdx) numTeachingPeriods++;
        }

        // 1. Prevent labs from parsing across breaks
        if (payload.duration > 1) {
            let minP = 999;
            let maxP = -1;
            for (const ge of payload.groupEntries) {
                const tgtP = ge.periodIdx + deltaPeriod;
                if (tgtP < minP) minP = tgtP;
                if (tgtP > maxP) maxP = tgtP;
            }

            let teachingCount = 0;
            let minH = -1;
            let maxH = -1;
            for (let hi = 0; hi < headers.length; hi++) {
                if (hi === breakHeaderIdx || hi === lunchHeaderIdx) continue;
                if (teachingCount === minP) minH = hi;
                if (teachingCount === maxP) maxH = hi;
                teachingCount++;
            }

            if (minH !== -1 && maxH !== -1) {
                for (let hi = minH + 1; hi < maxH; hi++) {
                    if (hi === breakHeaderIdx || hi === lunchHeaderIdx) {
                        return { conflict: true, conflictReason: 'Cannot span across a break' };
                    }
                }
            }
        }

        for (const entry of payload.groupEntries) {
            const entryTargetDay = entry.dayIdx + deltaDay;
            const entryTargetPeriod = entry.periodIdx + deltaPeriod;

            // 1. Boundary checks (ensure lab blocks don't go out of bounds)
            if (entryTargetDay < 0 || entryTargetDay >= days.length || entryTargetPeriod < 0 || entryTargetPeriod >= numTeachingPeriods) {
                 return { conflict: true, conflictReason: 'Out of bounds' };
            }

            // 2. Cell occupancy check (Target slot must be either empty, or occupied by pieces of our own moving group)
            const isMainSectionDrag = entry.section === payload.section;
            const tgtSectionId = isMainSectionDrag ? activeSection : entry.section;
            const targetSectionSlots = grid[tgtSectionId]?.slots?.[String(entryTargetDay)] || {};
            const classesInTarget: ClassEntry[] = targetSectionSlots[String(entryTargetPeriod)] || [];

            const hasUnrelatedClass = classesInTarget.some(cls => {
                return !payload.groupEntries.some(ge =>
                    ge.section === tgtSectionId &&
                    ge.dayIdx === entryTargetDay &&
                    ge.periodIdx === entryTargetPeriod &&
                    normalizeSubject(ge.classData.subject) === normalizeSubject(cls.subject) &&
                    ge.classData.faculty === cls.faculty
                );
            });

            if (hasUnrelatedClass) {
                const blockingClass = classesInTarget.find(cls =>
                    !payload.groupEntries.some(ge =>
                        ge.section === tgtSectionId &&
                        ge.dayIdx === entryTargetDay &&
                        ge.periodIdx === entryTargetPeriod &&
                        normalizeSubject(ge.classData.subject) === normalizeSubject(cls.subject) &&
                        ge.classData.faculty === cls.faculty
                    )
                );
                return { 
                    conflict: true, 
                    conflictReason: blockingClass 
                        ? `${tgtSectionId}: ${blockingClass.subject} (${blockingClass.faculty}) already scheduled here`
                        : `${tgtSectionId} is occupied`,
                    conflictDetails: blockingClass ? { subject: blockingClass.subject, faculty: blockingClass.faculty, section: tgtSectionId } : undefined
                };
            }

            // 3. Faculty conflict check across all sections
            for (const sec of Object.keys(grid)) {
                const daySlots = grid[sec]?.slots?.[String(entryTargetDay)] || {};
                const classesInSlot: ClassEntry[] = daySlots[String(entryTargetPeriod)] || [];


                for (const cls of classesInSlot) {
                    if (cls.faculty === entry.classData.faculty) {
                        // Skip if this class is one of the ones we are moving
                        // We check if ANY group entry has its SOURCE at (sec, entryTargetDay, entryTargetPeriod)
                        // with matching subject/faculty — meaning the class at the target IS part of our drag group
                        const isMovingEntry = payload.groupEntries.some(ge => 
                             ge.section === sec && 
                             ge.dayIdx === entryTargetDay && 
                             ge.periodIdx === entryTargetPeriod && 
                             ge.classData.faculty === cls.faculty &&
                             normalizeSubject(ge.classData.subject) === normalizeSubject(cls.subject)
                        );
                        if (!isMovingEntry) {
                            return { 
                                conflict: true, 
                                conflictReason: `${cls.faculty} is teaching ${cls.subject} in Section ${sec} at this time`,
                                conflictDetails: { subject: cls.subject, faculty: cls.faculty, section: sec }
                            };
                        }
                    }
                }
            }
        }
        
        return { conflict: false, conflictReason: '' };
    }, [grid, activeSection, days.length, headers.length, breakHeaderIdx, lunchHeaderIdx]);

    // ── Find all available slots for a group ────────────────────────────
    const findAvailableSlots = useCallback((
        payload: DragPayload | null
    ): { day: number; period: number; dayName: string; headerLabel: string; status: 'free' | 'conflict'; reason?: string }[] => {
        if (!grid || !activeSection || !payload) return [];
        const results: { day: number; period: number; dayName: string; headerLabel: string; status: 'free' | 'conflict'; reason?: string }[] = [];

        const sectionData = grid[activeSection];
        if (!sectionData) return results;

        const dayIndices: number[] = sectionData.days || [0, 1, 2, 3, 4];

        // Count teaching periods (headers minus break/lunch)
        let numTeachingPeriods = 0;
        for (let hi = 0; hi < headers.length; hi++) {
            if (hi !== breakHeaderIdx && hi !== lunchHeaderIdx) numTeachingPeriods++;
        }

        for (const dayIdx of dayIndices) {
            for (let pIdx = 0; pIdx < numTeachingPeriods; pIdx++) {
                // Skip origin cell
                if (dayIdx === payload.dayIdx && pIdx === payload.periodIdx) continue;

                // Check group conflict at target day/period
                const { conflict, conflictReason } = checkGroupConflict(payload, dayIdx, pIdx);

                if (!conflict) {
                    // Build header label
                    let headerIdx = 0;
                    let teachingCount = 0;
                    for (let hi = 0; hi < headers.length; hi++) {
                        if (hi === breakHeaderIdx || hi === lunchHeaderIdx) continue;
                        if (teachingCount === pIdx) { headerIdx = hi; break; }
                        teachingCount++;
                    }

                    results.push({
                        day: dayIdx,
                        period: pIdx,
                        dayName: days[dayIdx] || `Day ${dayIdx}`,
                        headerLabel: headers[headerIdx] || `P${pIdx + 1}`,
                        status: 'free',
                    });
                } else {
                    let headerIdx = 0;
                    let teachingCount = 0;
                    for (let hi = 0; hi < headers.length; hi++) {
                        if (hi === breakHeaderIdx || hi === lunchHeaderIdx) continue;
                        if (teachingCount === pIdx) { headerIdx = hi; break; }
                        teachingCount++;
                    }
                    results.push({
                        day: dayIdx,
                        period: pIdx,
                        dayName: days[dayIdx] || `Day ${dayIdx}`,
                        headerLabel: headers[headerIdx] || `P${pIdx + 1}`,
                        status: 'conflict',
                        reason: conflictReason,
                    });
                }
            }
        }

        return results;
    }, [grid, activeSection, headers, days, breakHeaderIdx, lunchHeaderIdx, checkGroupConflict]);

    // ── Highlight cells during drag ───────────────────────────────────────
    const computeHighlights = useCallback((payload: DragPayload) => {
        if (!grid || !activeSection) return;
        const highlights: Record<string, { status: 'free' | 'conflict'; reason?: string }> = {};
        const sectionData = grid[activeSection];
        if (!sectionData) return;

        const dayIndices: number[] = sectionData.days || [0, 1, 2, 3, 4];
        let numTeachingPeriods = 0;
        for (let hi = 0; hi < headers.length; hi++) {
            if (hi !== breakHeaderIdx && hi !== lunchHeaderIdx) numTeachingPeriods++;
        }

        for (const dayIdx of dayIndices) {
            for (let pIdx = 0; pIdx < numTeachingPeriods; pIdx++) {
                if (dayIdx === payload.dayIdx && pIdx === payload.periodIdx && activeSection === payload.section) continue;

                const key = `${dayIdx}-${pIdx}`;

                const { conflict, conflictReason } = checkGroupConflict(payload, dayIdx, pIdx);

                if (conflict) {
                    highlights[key] = { status: 'conflict', reason: conflictReason };
                } else {
                    highlights[key] = { status: 'free' };
                }
            }
        }

        setHighlightedCells(highlights);
    }, [grid, activeSection, headers, breakHeaderIdx, lunchHeaderIdx, checkGroupConflict]);

    // ── Drag handlers ─────────────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent, initialPayload: ClassEntry & any) => {
        // Wait, the caller is passing DragPayload: { section, dayIdx, periodIdx, cardIndex, classData }
        // We need to type it as any to handle the transition, or just Omit.
        e.dataTransfer.effectAllowed = 'move';
        const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
        ghost.style.width = '160px';
        ghost.style.opacity = '0.9';
        ghost.style.transform = 'rotate(2deg)';
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 80, 25);
        setTimeout(() => document.body.removeChild(ghost), 0);
        const { duration = 1, elective_group, is_open_elective } = initialPayload.classData;
        let isGroupMove = false;

        let collectedClasses: { section: string, dayIdx: number, periodIdx: number, cardIndex: number, classData: ClassEntry }[] = [];

        // Step 1: Horizontal collection (Electives across slots/sections)
        if (is_open_elective && grid) {
             isGroupMove = true;
             Object.keys(grid).forEach(sec => {
                 const classes = grid[sec]?.slots?.[String(initialPayload.dayIdx)]?.[String(initialPayload.periodIdx)] || [];
                 classes.forEach((c: any, cIdx: number) => {
                     if (c.elective_group === elective_group) {
                          collectedClasses.push({ section: sec, dayIdx: initialPayload.dayIdx, periodIdx: initialPayload.periodIdx, cardIndex: cIdx, classData: c });
                     }
                 });
             });
        } else if (elective_group && grid) {
             isGroupMove = true;
             Object.keys(grid).forEach(sec => {
                 const classes = grid[sec]?.slots?.[String(initialPayload.dayIdx)]?.[String(initialPayload.periodIdx)] || [];
                 classes.forEach((c: any, cIdx: number) => {
                     if (c.elective_group === elective_group) {
                          collectedClasses.push({ section: sec, dayIdx: initialPayload.dayIdx, periodIdx: initialPayload.periodIdx, cardIndex: cIdx, classData: c });
                     }
                 });
             });
        } else {
             // If there are multiple classes in this cell (e.g. batch labs), collect all of them so they move together
             const slotClasses = grid[initialPayload.section]?.slots?.[String(initialPayload.dayIdx)]?.[String(initialPayload.periodIdx)] || [];
             if (slotClasses.length > 1) {
                 isGroupMove = true;
                 slotClasses.forEach((c: any, cIdx: number) => {
                     collectedClasses.push({ section: initialPayload.section, dayIdx: initialPayload.dayIdx, periodIdx: initialPayload.periodIdx, cardIndex: cIdx, classData: c });
                 });
             } else {
                 collectedClasses.push({ section: initialPayload.section, dayIdx: initialPayload.dayIdx, periodIdx: initialPayload.periodIdx, cardIndex: initialPayload.cardIndex, classData: initialPayload.classData });
             }
        }

        // Step 2: Vertical collection (Duration logic for each collected class)
        const groupEntries: GroupedMoveEntry[] = [];
        for (const baseClass of collectedClasses) {
             if (baseClass.classData.duration && baseClass.classData.duration > 1) {
                  isGroupMove = true;
                  let pStart = baseClass.periodIdx;
                  const daySlots = grid?.[baseClass.section]?.slots?.[String(baseClass.dayIdx)] || {};
                  while (pStart > 0) {
                      const prevClasses = daySlots[String(pStart - 1)] || [];
                      if (prevClasses.some((c: any) => c.subject === baseClass.classData.subject && c.faculty === baseClass.classData.faculty)) {
                          pStart--;
                      } else {
                          break;
                      }
                  }
                  for (let i = 0; i < baseClass.classData.duration; i++) {
                      const p = pStart + i;
                      const pClasses = daySlots[String(p)] || [];
                      const cIdx = pClasses.findIndex((c: any) => c.subject === baseClass.classData.subject && c.faculty === baseClass.classData.faculty);
                      if (cIdx !== -1) {
                           if (!groupEntries.some(ge => ge.section === baseClass.section && ge.dayIdx === baseClass.dayIdx && ge.periodIdx === p && normalizeSubject(ge.classData.subject) === normalizeSubject(baseClass.classData.subject))) {
                                groupEntries.push({
                                    section: baseClass.section,
                                    dayIdx: baseClass.dayIdx,
                                    periodIdx: p,
                                    cardIndex: cIdx,
                                    classData: pClasses[cIdx]
                                });
                           }
                      }
                  }
             } else {
                  if (!groupEntries.some(ge => ge.section === baseClass.section && ge.dayIdx === baseClass.dayIdx && ge.periodIdx === baseClass.periodIdx && normalizeSubject(ge.classData.subject) === normalizeSubject(baseClass.classData.subject))) {
                       groupEntries.push(baseClass);
                  }
             }
        }

        const payload: DragPayload = {
            ...initialPayload,
            duration,
            isGroupMove,
            groupEntries,
        };

        setDragPayload(payload);
        setShowAvailablePanel(true);
        computeHighlights(payload);
    };

    const handleDragOver = (e: React.DragEvent, dayIdx: number, periodIdx: number) => {
        e.preventDefault();
        if (!dragPayload) return;

        const key = `${dayIdx}-${periodIdx}`;
        const highlight = highlightedCells[key];

        if (highlight?.status === 'free') {
            e.dataTransfer.dropEffect = 'move';
            setHoveredConflictCell(null);
        } else if (highlight?.status === 'conflict') {
            e.dataTransfer.dropEffect = 'none';
            setHoveredConflictCell({ key, reason: highlight.reason || 'Conflict', x: e.clientX, y: e.clientY });
        } else {
            // Cell occupied but no conflict — allow swap
            e.dataTransfer.dropEffect = 'move';
            setHoveredConflictCell(null);
        }
    };

    const handleDrop = (e: React.DragEvent, targetDay: number, targetPeriod: number) => {
        e.preventDefault();
        if (!dragPayload || !grid) return;

        const key = `${targetDay}-${targetPeriod}`;
        if (highlightedCells[key]?.status === 'conflict') return;

        // Same cell — no-op
        if (
            dragPayload.section === activeSection &&
            dragPayload.dayIdx === targetDay &&
            dragPayload.periodIdx === targetPeriod
        ) {
            endDrag();
            return;
        }

        const newGrid = deepClone(grid);
        const newSchedule = schedule ? deepClone(schedule) : null;

        const deltaDay = targetDay - dragPayload.dayIdx;
        const deltaPeriod = targetPeriod - dragPayload.periodIdx;

        // Sort group entries descending by periodIdx and cardIndex to safely splice
        const sortedEntries = [...dragPayload.groupEntries].sort((a, b) => {
            if (a.periodIdx !== b.periodIdx) return b.periodIdx - a.periodIdx;
            return b.cardIndex - a.cardIndex;
        });

        for (const entry of sortedEntries) {
            // Remove from source
            const srcSection = newGrid[entry.section];
            if (!srcSection?.slots?.[String(entry.dayIdx)]?.[String(entry.periodIdx)]) continue;
            const srcClasses = srcSection.slots[String(entry.dayIdx)][String(entry.periodIdx)];
            const [removed] = srcClasses.splice(entry.cardIndex, 1);
            if (!removed) continue;

            // Target calculations
            const tgtDay = entry.dayIdx + deltaDay;
            const tgtPeriod = entry.periodIdx + deltaPeriod;
            const isMainSectionDrag = entry.section === dragPayload.section;
            const tgtSectionId = isMainSectionDrag ? activeSection : entry.section;

            // Ensure target section path exists
            const tgt = newGrid[tgtSectionId];
            if (!tgt) continue;
            if (!tgt.slots) tgt.slots = {};
            if (!tgt.slots[String(tgtDay)]) tgt.slots[String(tgtDay)] = {};
            if (!tgt.slots[String(tgtDay)][String(tgtPeriod)]) {
                tgt.slots[String(tgtDay)][String(tgtPeriod)] = [];
            }

            // Append to target
            const tgtClasses = tgt.slots[String(tgtDay)][String(tgtPeriod)];
            tgtClasses.push(removed);

            // Update schedule
            if (newSchedule) {
                const matchedIds: string[] = [];
                for (const [tid, info] of Object.entries(newSchedule)) {
                     const schedSec = (info as any).section_id;
                     if (
                         schedSec && schedSec.toUpperCase().startsWith(entry.section) &&
                         (info as any).day_index === entry.dayIdx &&
                         (info as any).period_index === entry.periodIdx &&
                         normalizeSubject((info as any).subject_code || '') === normalizeSubject(removed.subject) &&
                         normalizeFaculty((info as any).faculty_name || '') === normalizeFaculty(removed.faculty)
                     ) {
                         matchedIds.push(tid);
                     }
                }
                for (const tid of matchedIds) {
                     newSchedule[tid].day_index = tgtDay;
                     newSchedule[tid].period_index = tgtPeriod;
                }
            }
        }

        const record: EditRecord = {
            payload: dragPayload,
            targetSection: activeSection,
            targetDay,
            targetPeriod,
            replacedEntries: [],
            timestamp: Date.now(),
        };

        if (newSchedule) setSchedule(newSchedule);
        setGrid(newGrid);
        setEditHistory(prev => [...prev, record]);
        endDrag();
    };

    const handleDragEnd = () => {
        endDrag();
    };

    const endDrag = () => {
        setDragPayload(null);
        setHighlightedCells({});
        setShowAvailablePanel(false);
        setHoveredConflictCell(null);
    };

    // ── Quick-drop from available panel ───────────────────────────────────
    const handleQuickDrop = (targetDay: number, targetPeriod: number) => {
        if (!dragPayload || !grid) return;

        const syntheticEvent = { preventDefault: () => {} } as React.DragEvent;
        handleDrop(syntheticEvent, targetDay, targetPeriod);
    };

    // ── Undo ──────────────────────────────────────────────────────────────
    const handleUndo = () => {
        if (editHistory.length === 0 || !grid) return;

        const newHistory = [...editHistory];
        const last = newHistory.pop()!;
        const newGrid = deepClone(grid);
        const newSchedule = schedule ? deepClone(schedule) : null;

        const deltaDay = last.targetDay - last.payload.dayIdx;
        const deltaPeriod = last.targetPeriod - last.payload.periodIdx;

        // Traverse in original order to cleanly push them back
        for (const entry of last.payload.groupEntries) {
            const tgtDay = entry.dayIdx + deltaDay;
            const tgtPeriod = entry.periodIdx + deltaPeriod;
            const isMainSectionDrag = entry.section === last.payload.section;
            const tgtSectionId = isMainSectionDrag ? last.targetSection : entry.section;

            // Remove from target
            const tgt = newGrid[tgtSectionId];
            if (tgt?.slots?.[String(tgtDay)]?.[String(tgtPeriod)]) {
                const tgtPeriodClasses = tgt.slots[String(tgtDay)][String(tgtPeriod)];
                const idx = tgtPeriodClasses.findIndex((c: ClassEntry) => c.subject === entry.classData.subject && c.faculty === entry.classData.faculty);
                if (idx >= 0) tgtPeriodClasses.splice(idx, 1);
            }

            // Put it back in the source
            const src = newGrid[entry.section];
            if (src) {
                if (!src.slots) src.slots = {};
                if (!src.slots[String(entry.dayIdx)]) src.slots[String(entry.dayIdx)] = {};
                if (!src.slots[String(entry.dayIdx)][String(entry.periodIdx)]) {
                    src.slots[String(entry.dayIdx)][String(entry.periodIdx)] = [];
                }
                const srcPeriodClasses = src.slots[String(entry.dayIdx)][String(entry.periodIdx)];
                // Insert at exact cardIndex to restore order
                srcPeriodClasses.splice(entry.cardIndex, 0, entry.classData);
            }

            if (newSchedule) {
                const matchedIds: string[] = [];
                for (const [tid, info] of Object.entries(newSchedule)) {
                     const schedSec = (info as any).section_id;
                     if (
                         schedSec && schedSec.toUpperCase().startsWith(tgtSectionId) &&
                         (info as any).day_index === tgtDay &&
                         (info as any).period_index === tgtPeriod &&
                         normalizeSubject((info as any).subject_code || '') === normalizeSubject(entry.classData.subject) &&
                         normalizeFaculty((info as any).faculty_name || '') === normalizeFaculty(entry.classData.faculty)
                     ) {
                         matchedIds.push(tid);
                     }
                }
                for (const tid of matchedIds) {
                     newSchedule[tid].day_index = entry.dayIdx;
                     newSchedule[tid].period_index = entry.periodIdx;
                }
            }
        }

        if (newSchedule) setSchedule(newSchedule);
        setGrid(newGrid);
        setEditHistory(newHistory);
    };

    // ── Revert all (unsaved changes only) ─────────────────────────────────
    const handleRevertAll = () => {
        if (!originalGrid) return;
        if (!window.confirm('Revert ALL unsaved changes? This cannot be undone.')) return;
        const revertedGrid = deepClone(originalGrid);
        const revertedSchedule = originalSchedule ? deepClone(originalSchedule) : null;
        setGrid(revertedGrid);
        if (revertedSchedule) setSchedule(revertedSchedule);
        setEditHistory([]);
        setSavingState('idle');
    };

    // ── Revert to original (server-side, restores generated timetable) ───
    const [reverting, setReverting] = useState(false);
    const handleRevertToOriginal = async () => {
        if (!window.confirm(
            'Revert to the ORIGINAL generated timetable?\n\nThis will undo ALL saved drag & drop changes and restore the timetable to its initial state. This cannot be undone.'
        )) return;

        setReverting(true);
        setError(null);

        try {
            const res = await axios.post(`${HF_API}/schedule/revert`);
            const data = res.data;

            if (data.status === 'SUCCESS' && data.grid) {
                setGrid(deepClone(data.grid));
                setOriginalGrid(deepClone(data.grid));

                if (data.schedule) {
                    setSchedule(deepClone(data.schedule));
                    setOriginalSchedule(deepClone(data.schedule));
                }

                setEditHistory([]);
                setSavedChanges([]);
                setSavingState('idle');
            } else {
                setError('Revert failed: ' + (data.message || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('Revert to original failed', err);
            setError('Failed to revert: ' + (err?.response?.data?.detail || err.message || 'Server error'));
        } finally {
            setReverting(false);
        }
    };

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!grid) return;
        setSavingState('saving');
        setError(null);

        try {
            // Sync up with the central HF backend so students see changes dynamically mapped
            if (schedule) {
                try {
                    if (user?.role === 'SUPER_TEACHER') {
                        const res = await axios.post(`${HF_API}/schedule/propose`, {
                            schedule: schedule,
                            proposer: user.email,
                            proposer_name: user.email.split('@')[0],
                            description: "Manual drag & drop modifications"
                        });
                        if (res.data.status !== 'SUCCESS') throw new Error('API reported failure');
                        alert("Changes submitted for Admin approval. The timetable will revert to the active version until approved.");
                        // Refresh to show the active timetable again
                        window.location.reload();
                        return;
                    } else {
                        const res = await axios.post(`${HF_API}/schedule/overwrite`, {
                            schedule: schedule
                        });
                        if (res.data.status !== 'SUCCESS') throw new Error('API reported failure');
                    }
                } catch (hfError) {
                    console.error('Failed to sync changes with HF API', hfError);
                    setError("Backend failed to save the changes. Ensure the backend deployed the new update.");
                    setSavingState('idle');
                    return;
                }
            } else {
                 setError("Missing internal schedule mapping. Cannot save to backend.");
                 setSavingState('idle');
                 return;
            }

            // Notify via Django API
            const changeMessages = editHistory.map(e =>
                `Moved ${e.payload.classData.subject} (${e.payload.classData.faculty}) from ${days[e.payload.dayIdx]?.slice(0, 3)} P${e.payload.periodIdx + 1} → ${days[e.targetDay]?.slice(0, 3)} P${e.targetPeriod + 1}`
            );

            try {
                await endpoints.timetableChange.notify({
                    message: changeMessages.join('\n') || 'Timetable has been updated via drag & drop editor.'
                });
            } catch {
                console.error('Failed to send notification, but timetable was saved locally.');
            }

            // Preserve a log of what was saved so the editor shows it
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newSaved = editHistory.map(e => ({
                subject: e.payload.classData.subject,
                faculty: e.payload.classData.faculty,
                fromDay: days[e.payload.dayIdx]?.slice(0, 3) || `D${e.payload.dayIdx}`,
                fromPeriod: e.payload.periodIdx + 1,
                toDay: days[e.targetDay]?.slice(0, 3) || `D${e.targetDay}`,
                toPeriod: e.targetPeriod + 1,
                savedAt: now,
            }));
            setSavedChanges(prev => [...newSaved, ...prev]);

            setOriginalGrid(deepClone(grid));
            if (schedule) setOriginalSchedule(deepClone(schedule));
            setEditHistory([]);
            setSavingState('saved');
            setTimeout(() => setSavingState('idle'), 2500);
        } catch (err: any) {
            setError('Failed to save changes: ' + (err.message || 'Unknown error'));
            setSavingState('idle');
        }
    };

    // ── Access guard ──────────────────────────────────────────────────────
    if (!user || !['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    if (!grid) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">No Timetable Found</h3>
                <p className="text-gray-500 mt-2">Generate a timetable first via the Timetable Generator.</p>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fade-in pb-28">
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <GripVertical className="w-6 h-6 text-indigo-500" />
                        Drag & Drop Editor
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Drag classes between slots to reschedule. Green = free, Red = conflict.
                    </p>
                </div>
                {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm font-medium animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        {editHistory.length} unsaved change{editHistory.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {/* ── How it works ──────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-indigo-700 space-y-1">
                        <p className="font-semibold text-sm text-indigo-800">How to use</p>
                        <p>• <strong>Drag</strong> any class card and <strong>drop</strong> it on a highlighted slot</p>
                        <p>• <span className="inline-block w-3 h-3 rounded bg-emerald-200 border border-emerald-400 mr-1 align-middle" /> Green cells = free slot (no conflicts)</p>
                        <p>• <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-400 mr-1 align-middle" /> Red cells = faculty conflict (blocked)</p>
                        <p>• The <strong>Available Slots</strong> panel on the right shows all free slots during a drag</p>
                    </div>
                </div>
            </div>

            {/* ── Section tabs ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                {sections.map((sec, idx) => {
                    const color = getSectionColor(sec, idx);
                    const isActive = sec === activeSection;
                    return (
                        <button
                            key={sec}
                            onClick={() => setActiveSection(sec)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${isActive
                                ? `${color.pill} text-white border-transparent shadow-md scale-105`
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Section {sec}
                        </button>
                    );
                })}
            </div>

            {/* ── Main layout: grid + available panel ───────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5">
                {/* ── Timetable grid ────────────────────────────────────────── */}
                <div className="flex-1 min-w-0" ref={gridRef}>
                    <div className="overflow-x-auto scrollbar-hide rounded-2xl border border-gray-200 shadow-sm bg-white">
                        <table className="w-full min-w-[1000px] text-xs border-collapse table-fixed">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-50 to-slate-50">
                                    <th className="border border-gray-200 px-3 py-3 text-left font-bold text-gray-600 w-16 sticky left-0 bg-gray-50 z-10">
                                        Day
                                    </th>
                                    {headers.map((h, hi) => {
                                        const isBreak = hi === breakHeaderIdx;
                                        const isLunch = hi === lunchHeaderIdx;
                                        return (
                                            <th
                                                key={hi}
                                                className={`border border-gray-200 px-2 py-3 text-center font-semibold min-w-[110px] ${isBreak || isLunch
                                                    ? 'bg-amber-50/70 text-amber-600 italic font-normal text-[10px] min-w-[30px]'
                                                    : 'text-gray-600'
                                                    }`}
                                            >
                                                {h}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {activeDayIndices.map((dayIdx, rowNum) => {
                                    const dayName = days[dayIdx] ?? `Day ${dayIdx}`;
                                    const sectionData = grid[activeSection];
                                    const slots = sectionData?.slots || {};
                                    const daySlots = slots[String(dayIdx)] || {};
                                    let periodCounter = 0;

                                    return (
                                        <tr key={dayIdx} className="group">
                                            <td className="border border-gray-200 px-2 py-2 font-bold text-gray-600 bg-gray-50 sticky left-0 z-10 text-xs">
                                                {dayName.slice(0, 3)}
                                            </td>
                                            {headers.map((h, hi) => {
                                                const isBreak = hi === breakHeaderIdx;
                                                const isLunch = hi === lunchHeaderIdx;

                                                if (isBreak) {
                                                    return rowNum === 0 ? (
                                                        <td
                                                            key={hi}
                                                            rowSpan={activeDayIndices.length}
                                                            className="border border-gray-200 px-1 py-1 text-center bg-gradient-to-b from-amber-50 to-orange-50 text-amber-600 text-[10px] font-semibold"
                                                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                        >
                                                            ☕ Tea Break
                                                        </td>
                                                    ) : null;
                                                }
                                                if (isLunch) {
                                                    return rowNum === 0 ? (
                                                        <td
                                                            key={hi}
                                                            rowSpan={activeDayIndices.length}
                                                            className="border border-gray-200 px-1 py-1 text-center bg-gradient-to-b from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold"
                                                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                        >
                                                            🍽 Lunch
                                                        </td>
                                                    ) : null;
                                                }

                                                const currentPeriod = periodCounter;
                                                periodCounter++;
                                                const cells: ClassEntry[] = daySlots[String(currentPeriod)] || [];
                                                const cellKey = `${dayIdx}-${currentPeriod}`;
                                                const highlightData = dragPayload ? highlightedCells[cellKey] : undefined;
                                                const highlight = highlightData?.status;
                                                const isSource = dragPayload &&
                                                    dragPayload.section === activeSection &&
                                                    dragPayload.dayIdx === dayIdx &&
                                                    dragPayload.periodIdx === currentPeriod;

                                                return (
                                                    <td
                                                        key={hi}
                                                        className={`border border-gray-200 px-1.5 py-1.5 align-top transition-all duration-200 min-h-[60px] relative ${isSource
                                                            ? 'bg-blue-100/60 ring-2 ring-blue-400 ring-inset'
                                                            : highlight === 'free'
                                                                ? 'bg-emerald-50/80 ring-2 ring-emerald-400/60 ring-inset shadow-inner'
                                                                : highlight === 'conflict'
                                                                    ? 'bg-red-50/80 ring-2 ring-red-400/60 ring-inset cursor-not-allowed'
                                                                    : 'hover:bg-gray-50/50'
                                                            }`}
                                                        onDragOver={(e) => handleDragOver(e, dayIdx, currentPeriod)}
                                                        onDrop={(e) => handleDrop(e, dayIdx, currentPeriod)}
                                                    >
                                                        {/* Free slot indicator during drag */}
                                                        {highlight === 'free' && cells.length === 0 && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center animate-pulse">
                                                                    <ChevronRight className="w-3 h-3 text-emerald-600" />
                                                                </div>
                                                            </div>
                                                        )}


                                                        {/* Conflict X icon during drag */}
                                                        {highlight === 'conflict' && (
                                                            <div className="absolute top-0.5 right-0.5 pointer-events-none">
                                                                <X className="w-3 h-3 text-red-500" />
                                                            </div>
                                                        )}

                                                        {cells.length === 0 && !highlight ? (
                                                            <div className="flex justify-center items-center h-12 group/empty relative">
                                                                <span className="text-gray-200 group-hover/empty:opacity-0 transition-opacity">—</span>
                                                                <button
                                                                    onClick={() => openAddSubjectModal(activeSection, dayIdx, currentPeriod)}
                                                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/empty:opacity-100 transition-all duration-200"
                                                                    title="Add subject to this slot"
                                                                >
                                                                    <div className="w-7 h-7 rounded-full bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 flex items-center justify-center transition-all hover:scale-110 shadow-sm">
                                                                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            cells.map((c, ci) => {
                                                                const hue = subjectHue(c.subject);
                                                                const isHighlighted = highlightInfo && 
                                                                    highlightInfo.day === dayName && 
                                                                    highlightInfo.period === currentPeriod && 
                                                                    highlightInfo.subject === c.subject;

                                                                return (
                                                                    <div
                                                                        key={ci}
                                                                        draggable
                                                                        onDragStart={(e) => handleDragStart(e, {
                                                                            section: activeSection,
                                                                            dayIdx,
                                                                            periodIdx: currentPeriod,
                                                                            cardIndex: ci,
                                                                            classData: c,
                                                                        })}
                                                                        onDragEnd={handleDragEnd}
                                                                        className={`relative rounded-lg px-2 py-1.5 mb-1 cursor-grab active:cursor-grabbing transition-all duration-150 hover:scale-[1.03] hover:shadow-md group/card border ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-1 animate-pulse z-20' : ''}`}
                                                                        style={{
                                                                            backgroundColor: `hsl(${hue}, 85%, 96%)`,
                                                                            borderColor: `hsl(${hue}, 60%, 80%)`,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className="font-bold leading-tight text-[11px] truncate pr-2"
                                                                            style={{ color: `hsl(${hue}, 70%, 30%)` }}
                                                                        >
                                                                            {c.subject}
                                                                        </div>
                                                                        <div
                                                                            className="text-[10px] leading-tight truncate mt-0.5"
                                                                            style={{ color: `hsl(${hue}, 40%, 50%)` }}
                                                                        >
                                                                            {c.faculty}
                                                                        </div>
                                                                        {(() => {
                                                                            const roomKey = `${activeSection.toUpperCase()}_${dayIdx}_${currentPeriod}_${(c.subject || '').toUpperCase()}`;
                                                                            const room = roomLookup[roomKey];
                                                                            return room ? (
                                                                                <div
                                                                                    className="text-[9px] leading-tight truncate mt-0.5 flex items-center gap-0.5 opacity-70"
                                                                                    style={{ color: `hsl(${hue}, 40%, 50%)` }}
                                                                                >
                                                                                    <MapPin className="w-2.5 h-2.5 inline shrink-0" />
                                                                                    {room}
                                                                                </div>
                                                                            ) : null;
                                                                        })()}
                                                                        
                                                                        {/* ── Badges ── */}
                                                                        <div className="absolute -bottom-1 right-0.5 flex gap-1 shadow-sm rounded-full overflow-hidden">
                                                                            {c.duration && c.duration > 1 && (
                                                                                <span className="bg-purple-500 text-white text-[8px] font-bold px-1.5 py-0.5">Lab</span>
                                                                            )}
                                                                            {c.is_open_elective && (
                                                                                <span className="bg-yellow-500 text-white text-[8px] font-bold px-1.5 py-0.5">OE</span>
                                                                            )}
                                                                            {c.elective_group && !c.is_open_elective && (
                                                                                <span className="bg-sky-500 text-white text-[8px] font-bold px-1.5 py-0.5">Elec</span>
                                                                            )}
                                                                        </div>

                                                                        {/* Grab handle indicator */}
                                                                        <div className="absolute top-0.5 right-0.5 opacity-0 group-hover/card:opacity-40 transition-opacity flex flex-col gap-1">
                                                                            <GripVertical className="w-3 h-3" style={{ color: `hsl(${hue}, 50%, 50%)` }} />
                                                                        </div>
                                                                        
                                                                        {/* Delete class button (only for manual classes/injected or if they have task_id) */}
                                                                        {c.task_id && (
                                                                            <button
                                                                                onClick={(e) => handleRemoveClass(c.task_id, e)}
                                                                                disabled={removingClass === c.task_id}
                                                                                className="absolute bottom-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white/80 hover:bg-red-50 p-1 rounded-md text-red-500 hover:text-red-700 shadow-sm z-10"
                                                                                title="Remove this class"
                                                                            >
                                                                                {removingClass === c.task_id ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    <X className="w-3 h-3" />
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
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
                </div>

                {/* ── Floating Conflict Tooltip (rendered outside table to avoid overflow clipping) ── */}
                {hoveredConflictCell && dragPayload && (
                    <div
                        className="fixed z-[200] pointer-events-none"
                        style={{
                            top: hoveredConflictCell.y - 16,
                            left: hoveredConflictCell.x,
                            transform: 'translate(-50%, -100%)',
                        }}
                    >
                        <div className="bg-gray-900/95 backdrop-blur-sm text-white text-[11px] leading-snug rounded-xl px-3.5 py-2.5 shadow-2xl max-w-[300px] border border-white/10 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <AlertCircle className="w-3 h-3 text-red-400" />
                                </div>
                                <div>
                                    <div className="font-semibold text-red-300 text-[10px] uppercase tracking-wider mb-0.5">Conflict</div>
                                    <div className="text-white/90">{hoveredConflictCell.reason}</div>
                                </div>
                            </div>
                        </div>
                        {/* Arrow pointing down */}
                        <div className="flex justify-center">
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900/95" />
                        </div>
                    </div>
                )}

                {/* ── Available Slots Panel ──────────────────────────────────── */}
                <div
                    className={`w-72 flex-shrink-0 transition-all duration-300 ${showAvailablePanel && dragPayload
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 translate-x-4 pointer-events-none w-0 overflow-hidden'
                        }`}
                >
                    {dragPayload && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 sticky top-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-sm font-bold text-gray-800">Available Slots</h3>
                            </div>
                            <div className="mb-3 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                                <div className="text-[11px] font-bold text-indigo-800 truncate">{dragPayload.classData.subject}</div>
                                <div className="text-[10px] text-indigo-600 truncate">{dragPayload.classData.faculty}</div>
                            </div>

                            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                                {(() => {
                                    const available = findAvailableSlots(dragPayload);
                                    const free = available.filter(a => a.status === 'free');
                                    const conflicts = available.filter(a => a.status === 'conflict');

                                    return (
                                        <>
                                            {free.length === 0 ? (
                                                <p className="text-xs text-gray-400 py-3 text-center">No free slots available</p>
                                            ) : (
                                                free.map((slot, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleQuickDrop(slot.day, slot.period)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors group"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-semibold text-emerald-800">
                                                                {slot.dayName.slice(0, 3)}
                                                            </div>
                                                            <div className="text-[10px] text-emerald-600 truncate">
                                                                {slot.headerLabel}
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                ))
                                            )}

                                            {conflicts.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <p className="text-[10px] font-semibold text-red-500 mb-1 flex items-center gap-1">
                                                        <X className="w-3 h-3" /> Conflicts
                                                    </p>
                                                    {conflicts.map((slot, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-red-50/50 border border-red-100 mb-1"
                                                            title={slot.reason || 'Conflict'}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                                <div className="text-[10px] text-red-700 font-semibold">
                                                                    {slot.dayName.slice(0, 3)} — {slot.headerLabel}
                                                                </div>
                                                            </div>
                                                            {slot.reason && (
                                                                <div className="text-[9px] text-red-500 ml-5 leading-snug">
                                                                    {slot.reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Add Subject Modal ────────────────────────────────────────────── */}
            {showAddSubjectModal && addSubjectTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => { setShowAddSubjectModal(false); setAddSubjectTarget(null); }}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Plus className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Add Subject</h2>
                                        {addSubjectTarget.isGlobal ? (
                                            <p className="text-indigo-200 text-xs mt-0.5">Global subject injection</p>
                                        ) : (
                                            <p className="text-indigo-200 text-xs mt-0.5">
                                                Section {addSubjectTarget.section} • {days[addSubjectTarget.dayIdx]?.slice(0, 3)} 
                                                {addSubjectTarget.periodIdx !== null ? ` • P${addSubjectTarget.periodIdx + 1}` : ''}
                                                {(() => {
                                                    if (addSubjectTarget.periodIdx === null) return '';
                                                    let teachingCount = 0;
                                                    for (let hi = 0; hi < headers.length; hi++) {
                                                        if (hi === breakHeaderIdx || hi === lunchHeaderIdx) continue;
                                                        if (teachingCount === addSubjectTarget.periodIdx) {
                                                            return ` (${headers[hi]})`;
                                                        }
                                                        teachingCount++;
                                                    }
                                                    return '';
                                                })()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowAddSubjectModal(false); setAddSubjectTarget(null); }}
                                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
                            {/* Step 1: Target Sections (Global only) */}
                            {addSubjectTarget.isGlobal && (
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                                <Users className="w-4 h-4 text-amber-600" />
                                                Step 1: Select Target Sections
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Select which sections to add this subject to
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => selectAllSections(true)}
                                                className="text-xs font-medium text-amber-600 hover:text-amber-800 px-2 py-1 rounded bg-amber-100 transition-colors"
                                            >
                                                Select All
                                            </button>
                                            <button 
                                                onClick={() => selectAllSections(false)}
                                                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {sections.map(sec => {
                                            const isSelected = selectedSections.has(sec);
                                            return (
                                                <button
                                                    key={sec}
                                                    onClick={() => toggleSection(sec)}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all duration-200 ${
                                                        isSelected 
                                                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-amber-300 hover:bg-amber-50'
                                                    }`}
                                                >
                                                    {sec}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 text-xs text-amber-700 font-medium">
                                        {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Global Day Selection (Global only) */}
                            {addSubjectTarget.isGlobal && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                                        <Clock className="w-4 h-4 text-indigo-600" />
                                        Step 2: Select Day
                                    </label>
                                    <div>
                                        <select
                                            value={addSubjectTarget.dayIdx}
                                            onChange={(e) => {
                                                const d = parseInt(e.target.value);
                                                setAddSubjectTarget(prev => prev ? { ...prev, dayIdx: d, periodIdx: null, globalPeriods: [] } : prev);
                                                setSelectedFaculty('');
                                                setFreeTeachers([]);
                                                setBusyTeachers([]);
                                            }}
                                            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            {days.map((d, i) => (
                                                <option key={i} value={i}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Select Subject */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <BookOpen className="w-4 h-4 text-indigo-500" />
                                        {addSubjectTarget.isGlobal ? 'Step 3: Select Subject' : 'Select Subject'}
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={useCustomSubject}
                                            onChange={(e) => {
                                                setUseCustomSubject(e.target.checked);
                                                if (e.target.checked) setSelectedSubject('');
                                            }}
                                            className="rounded text-indigo-500 focus:ring-indigo-500"
                                        />
                                        Custom / Generic Subject
                                    </label>
                                </div>
                                
                                {useCustomSubject ? (
                                    <input
                                        type="text"
                                        value={customSubjectName}
                                        onChange={(e) => setCustomSubjectName(e.target.value)}
                                        placeholder="e.g. VAP, Faculty Hour, Soft Skills..."
                                        className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                                    />
                                ) : (
                                    <>
                                        <select
                                            value={selectedSubject}
                                            onChange={(e) => setSelectedSubject(e.target.value)}
                                            className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                                        >
                                            <option value="">— Choose a subject —</option>
                                            {subjectsList.map(sub => (
                                                <option key={sub.code} value={sub.code}>
                                                    {sub.name} ({sub.code.toUpperCase()}) — {sub.type} • {sub.credits} credits
                                                </option>
                                            ))}
                                        </select>
                                        {selectedSubject && (() => {
                                            const sub = subjectsList.find(s => s.code === selectedSubject);
                                            return sub ? (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.type === 'LAB' ? 'bg-purple-100 text-purple-700' : sub.type === 'SOFTSKILL' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {sub.type}
                                                    </span>
                                                    {sub.type === 'LAB' && (
                                                        <span className="text-[10px] text-gray-500">• Will occupy 2 consecutive periods</span>
                                                    )}
                                                </div>
                                            ) : null;
                                        })()}
                                    </>
                                )}
                            </div>

                            {/* Step 4: Find Free Slots (Global only) */}
                            {addSubjectTarget.isGlobal && (
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
                                    <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-3">
                                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                                        Step 4: Select a Free Slot
                                    </label>
                                    <p className="text-xs text-emerald-600 mb-3">
                                        {selectedSections.size === 0 
                                            ? 'Please select at least one section first.' 
                                            : `Available periods where all ${selectedSections.size} selected section(s) are free. You can select multiple:`}
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {(() => {
                                            if (selectedSections.size === 0) return null;
                                            
                                            const freeList: { periodIdx: number, label: string }[] = [];
                                            const d = String(addSubjectTarget.dayIdx);

                                            for (let hi = 0; hi < headers.length; hi++) {
                                                if (hi === breakHeaderIdx || hi === lunchHeaderIdx) continue;
                                                let teachingIdx = 0;
                                                for (let j = 0; j < hi; j++) { if (j !== breakHeaderIdx && j !== lunchHeaderIdx) teachingIdx++; }

                                                let isFreeInAll = true;
                                                for (const sec of selectedSections) {
                                                    const classes = grid?.[sec]?.slots?.[d]?.[String(teachingIdx)];
                                                    if (classes && classes.length > 0) {
                                                        isFreeInAll = false;
                                                        break;
                                                    }
                                                }
                                                if (isFreeInAll) {
                                                    freeList.push({ periodIdx: teachingIdx, label: headers[hi] });
                                                }
                                            }

                                            if (freeList.length === 0) {
                                                return <div className="text-xs text-red-500 font-medium w-full p-2 bg-red-50 border border-red-100 rounded-lg">No common free slots found for the selected sections on this day.</div>;
                                            }

                                            return freeList.map(slot => {
                                                const isSelected = addSubjectTarget.globalPeriods?.includes(slot.periodIdx);
                                                return (
                                                    <button
                                                        key={slot.periodIdx}
                                                        onClick={() => {
                                                            setAddSubjectTarget(prev => {
                                                                if (!prev) return prev;
                                                                let newPeriods = prev.globalPeriods ? [...prev.globalPeriods] : [];
                                                                if (newPeriods.includes(slot.periodIdx)) {
                                                                    newPeriods = newPeriods.filter(p => p !== slot.periodIdx);
                                                                } else {
                                                                    newPeriods.push(slot.periodIdx);
                                                                }
                                                                computeFreeTeachers(prev.dayIdx, null, newPeriods);
                                                                return { ...prev, globalPeriods: newPeriods };
                                                            });
                                                        }}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all duration-200 ${
                                                            isSelected 
                                                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' 
                                                                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                        }`}
                                                    >
                                                        P{slot.periodIdx + 1} ({slot.label})
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Free Teachers */}
                            {(!addSubjectTarget.isGlobal || (addSubjectTarget.globalPeriods && addSubjectTarget.globalPeriods.length > 0)) && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <UserPlus className="w-4 h-4 text-emerald-500" />
                                            {addSubjectTarget.isGlobal ? 'Step 5: Choose Teacher' : 'Choose Teacher'}
                                        </label>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                {freeTeachers.length} free
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                                {busyTeachers.length} busy
                                            </span>
                                        </div>
                                    </div>

                                    {loadingTeachers ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* Free teachers */}
                                            {freeTeachers.length === 0 && (
                                                <div className="text-center py-4 text-sm text-gray-400">
                                                    No teachers are free at this slot
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {freeTeachers.map(fac => {
                                                    const isSelected = selectedFaculty === fac.name;
                                                    return (
                                                        <button
                                                            key={fac.id}
                                                            onClick={() => setSelectedFaculty(isSelected ? '' : fac.name)}
                                                            className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                                                                isSelected
                                                                    ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200'
                                                                    : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm'
                                                            }`}
                                                        >
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                                                                isSelected ? 'bg-indigo-500' : 'bg-emerald-500'
                                                            }`}>
                                                                {fac.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-semibold text-gray-800 truncate">
                                                                    {fac.name}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] text-gray-500">{fac.designation}</span>
                                                                    <span className="text-gray-300">•</span>
                                                                    <span className="text-[10px] text-gray-500">{fac.max_hours}h/wk</span>
                                                                </div>
                                                            </div>
                                                            {isSelected && (
                                                                <CheckCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Busy teachers (collapsed) */}
                                            {busyTeachers.length > 0 && (
                                                <details className="mt-3">
                                                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">
                                                        Show {busyTeachers.length} busy teacher{busyTeachers.length !== 1 ? 's' : ''}
                                                    </summary>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                        {busyTeachers.map(fac => (
                                                            <div
                                                                key={fac.id}
                                                                className="flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-red-50/30 opacity-50"
                                                            >
                                                                <div className="w-9 h-9 rounded-full bg-red-200 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
                                                                    {fac.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-medium text-gray-500 truncate line-through">
                                                                        {fac.name}
                                                                    </div>
                                                                    <div className="text-[10px] text-red-500">Occupied at this hour</div>
                                                                </div>
                                                                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/80">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                    {(useCustomSubject ? customSubjectName.trim() : selectedSubject) && selectedFaculty ? (
                                        <span className="text-indigo-600 font-medium">
                                            ✓ {useCustomSubject ? customSubjectName : subjectsList.find(s => s.code === selectedSubject)?.name} → {selectedFaculty}
                                            {selectedSections.size > 1 ? ` (${selectedSections.size} sections)` : ''}
                                        </span>
                                    ) : (
                                        <span>Select a subject and teacher to proceed</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => { setShowAddSubjectModal(false); setAddSubjectTarget(null); }}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleInjectSubject}
                                        disabled={!(useCustomSubject ? customSubjectName.trim() : selectedSubject) || !selectedFaculty || injectingSubject || selectedSections.size === 0 || (addSubjectTarget.isGlobal ? (!addSubjectTarget.globalPeriods || addSubjectTarget.globalPeriods.length === 0) : addSubjectTarget.periodIdx === null)}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${
                                            !(useCustomSubject ? customSubjectName.trim() : selectedSubject) || !selectedFaculty || injectingSubject || selectedSections.size === 0 || (addSubjectTarget.isGlobal ? (!addSubjectTarget.globalPeriods || addSubjectTarget.globalPeriods.length === 0) : addSubjectTarget.periodIdx === null)
                                                ? 'bg-indigo-300 text-white cursor-not-allowed'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200'
                                        }`}
                                    >
                                        {injectingSubject ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                Add to Timetable
                                                {selectedSections.size > 1 && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                                                        ×{selectedSections.size}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Error banner ───────────────────────────────────────────────── */}
            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                </div>
            )}

            {/* ── Edit history (unsaved) ────────────────────────────────────── */}
            {editHistory.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Unsaved Changes ({editHistory.length})
                    </h3>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-hide">
                        {[...editHistory].reverse().map((edit, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
                                <MapPin className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="font-medium text-gray-800">{edit.payload.classData.subject}</span>
                                <span className="text-gray-400">
                                    {days[edit.payload.dayIdx]?.slice(0, 3)} P{edit.payload.periodIdx + 1}
                                </span>
                                <ChevronRight className="w-3 h-3 text-gray-300" />
                                <span className="text-indigo-600 font-medium">
                                    {days[edit.targetDay]?.slice(0, 3)} P{edit.targetPeriod + 1}
                                </span>
                                <span className="text-gray-400 ml-auto text-[10px]">
                                    {new Date(edit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Saved changes log ───────────────────────────────────────────── */}
            {savedChanges.length > 0 && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            Saved Changes ({savedChanges.length})
                        </h3>
                        <button
                            onClick={() => setSavedChanges([])}
                            className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-hide">
                        {savedChanges.map((ch, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-emerald-50 rounded-lg px-3 py-2">
                                <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                <span className="font-medium text-gray-800">{ch.subject}</span>
                                <span className="text-gray-400">
                                    {ch.fromDay} P{ch.fromPeriod}
                                </span>
                                <ChevronRight className="w-3 h-3 text-gray-300" />
                                <span className="text-emerald-600 font-medium">
                                    {ch.toDay} P{ch.toPeriod}
                                </span>
                                <span className="text-gray-400 ml-auto text-[10px]">{ch.savedAt}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Action bar (sticky bottom) ─────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 lg:left-64">
                <div className="mx-auto max-w-7xl px-6 py-3">
                    <div className="flex items-center gap-4 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-2xl px-4 py-3 overflow-x-auto scrollbar-hide">
                        <div className="flex items-center flex-nowrap shrink-0 gap-2">
                            <button
                                onClick={handleUndo}
                                disabled={editHistory.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${editHistory.length === 0
                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:scale-95'
                                    }`}
                            >
                                <Undo2 className="w-4 h-4" />
                                Undo
                            </button>
                            <button
                                onClick={handleRevertAll}
                                disabled={editHistory.length === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${editHistory.length === 0
                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                    : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 active:scale-95'
                                    }`}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Revert Unsaved
                            </button>
                            <button
                                onClick={openGlobalAddSubjectModal}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 ml-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Subject
                            </button>
                            <button
                                onClick={handleRevertToOriginal}
                                disabled={reverting}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                                    reverting
                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:border-orange-300 active:scale-95'
                                }`}
                            >
                                {reverting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                                        Reverting...
                                    </>
                                ) : (
                                    <>
                                        <History className="w-4 h-4" />
                                        Revert to Original
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="flex-1 min-w-[20px]" />

                        <div className="flex items-center gap-3 shrink-0 flex-nowrap">
                            {savingState === 'saved' && (
                                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium animate-fade-in">
                                    <CheckCircle className="w-4 h-4" />
                                    Saved!
                                </div>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={editHistory.length === 0 || savingState === 'saving'}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${editHistory.length === 0 || savingState === 'saving'
                                    ? 'bg-indigo-300 text-white cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200'
                                    }`}
                            >
                                {savingState === 'saving' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                        {editHistory.length > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                                                {editHistory.length}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CSS animations ─────────────────────────────────────────────── */}
            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                /* Hide scrollbars but keep scroll functionality */
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
