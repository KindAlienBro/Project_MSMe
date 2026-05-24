"use client";
import React from 'react';
import { MapPin, Users } from 'lucide-react';

const PALETTES = [
    { bg: 'bg-indigo-50/80', border: 'border-indigo-100', textPrimary: 'text-indigo-800', textSecondary: 'text-indigo-600/90', icon: 'text-indigo-500/80' },
    { bg: 'bg-emerald-50/80', border: 'border-emerald-100', textPrimary: 'text-emerald-800', textSecondary: 'text-emerald-600/90', icon: 'text-emerald-500/80' },
    { bg: 'bg-rose-50/80', border: 'border-rose-100', textPrimary: 'text-rose-800', textSecondary: 'text-rose-600/90', icon: 'text-rose-500/80' },
    { bg: 'bg-amber-50/80', border: 'border-amber-100', textPrimary: 'text-amber-800', textSecondary: 'text-amber-600/90', icon: 'text-amber-500/80' },
    { bg: 'bg-cyan-50/80', border: 'border-cyan-100', textPrimary: 'text-cyan-800', textSecondary: 'text-cyan-600/90', icon: 'text-cyan-500/80' },
    { bg: 'bg-fuchsia-50/80', border: 'border-fuchsia-100', textPrimary: 'text-fuchsia-800', textSecondary: 'text-fuchsia-600/90', icon: 'text-fuchsia-500/80' },
];

function getColorForSubject(subject: string) {
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTES[Math.abs(hash) % PALETTES.length];
}

const TIMETABLE_HEADERS = [
    "8:45-9:40",   // P1
    "9:40-10:35",  // P2
    "10:35-10:50", // BREAK
    "10:50-11:45", // P3
    "11:45-12:40", // P4
    "12:40-1:40",  // LUNCH
    "1:40-2:35",   // P5
    "2:35-3:30",   // P6
    "3:30-4:25",   // P7
    "4:25-5:20"    // P8
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface ScheduleEntry {
    section_id: string;
    day_index: number;
    period_index: number;
    duration: number;
    subject_code: string;
    faculty_name: string;
    room_id?: string;
    [key: string]: any;
}

interface TimetableGridProps {
    schedule: Record<string, ScheduleEntry>;
    title?: string;
}

export function TimetableGrid({ schedule, title }: TimetableGridProps) {
    if (!schedule || Object.keys(schedule).length === 0) {
        return (
            <div className="text-center text-gray-500 py-10">
                No schedule data available.
            </div>
        );
    }

    // Extract unique parent sections from schedule
    const parentSections = new Set<string>();
    Object.values(schedule).forEach((info) => {
        const secId = info.section_id || '';
        const parent = secId.split('-')[0].toUpperCase();
        if (parent) parentSections.add(parent);
    });
    const sortedSections = Array.from(parentSections).sort();

    // Build merged grid: mergedGrid[parentSec][dayIndex][periodIndex] = [{subject, faculty}]
    type CellEntry = { subject: string; faculty: string; room: string };
    const mergedGrid: Record<string, Record<number, Record<number, CellEntry[]>>> = {};

    sortedSections.forEach(sec => { mergedGrid[sec] = {}; });

    Object.values(schedule).forEach((info) => {
        const secId = info.section_id || '';
        const parentSec = secId.split('-')[0].toUpperCase();
        if (!mergedGrid[parentSec]) mergedGrid[parentSec] = {};

        const day = info.day_index ?? 0;
        const period = info.period_index ?? 0;
        const dur = info.duration ?? 1;
        const subject = (info.subject_code || '?').toUpperCase();
        let faculty = info.faculty_name || '';
        faculty = faculty.replace(/Prof\. /g, '').replace(/Dr\. /g, '')
            .replace(/Mr\. /g, '').replace(/Ms\. /g, '');

        for (let i = 0; i < dur; i++) {
            if (!mergedGrid[parentSec][day]) mergedGrid[parentSec][day] = {};
            if (!mergedGrid[parentSec][day][period + i]) mergedGrid[parentSec][day][period + i] = [];
            const entry = { subject, faculty, room: info.room_name || info.room_id || '' };
            const existing = mergedGrid[parentSec][day][period + i];
            if (!existing.find(e => e.subject === entry.subject && e.faculty === entry.faculty)) {
                existing.push(entry);
            }
        }
    });

    // Detect if Saturday has classes
    const daysInSolution = new Set<number>();
    Object.values(schedule).forEach(info => daysInSolution.add(info.day_index ?? 0));
    const allDayIndices = [0, 1, 2, 3, 4];
    if (daysInSolution.has(5)) allDayIndices.push(5);
    const allDayNames = [...DAYS, 'Saturday'];

    return (
        <div className="space-y-12">
            {title && (
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
                </div>
            )}
            {sortedSections.map(pSec => (
                <div key={pSec} className="space-y-5 animate-fade-in">
                    <div className="flex items-center gap-3 px-1">
                        <h4 className="text-lg font-bold text-slate-800">Section {pSec}</h4>
                        <div className="h-px bg-gradient-to-r from-slate-200 to-transparent flex-1 rounded-full"></div>
                    </div>
                    
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-sm bg-white/50 backdrop-blur-sm">
                        <table className="w-full text-sm border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200/80">
                                    <th className="py-4 px-4 text-left font-bold text-slate-600 text-xs uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-slate-200/80 z-10 w-24">
                                        Day
                                    </th>
                                    {TIMETABLE_HEADERS.map((h, i) => (
                                        <th key={i} className="py-4 px-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">
                                            {h.replace('-', ' - ')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {allDayIndices.map((dayIdx, rowNum) => {
                                    const dayName = allDayNames[dayIdx] || `Day${dayIdx}`;
                                    let periodCounter = 0;
                                    return (
                                        <tr key={dayIdx} className="hover:bg-slate-50/40 transition-colors group">
                                            <td className="py-3 px-4 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50/80 transition-colors border-r border-slate-100 shadow-[1px_0_0_0_rgba(241,245,249,1)] z-10">
                                                {dayName.substring(0, 3)}
                                            </td>
                                            {TIMETABLE_HEADERS.map((headerText, colIdx) => {
                                                const isBreak = headerText === "10:35-10:50";
                                                const isLunch = headerText === "12:40-1:40";

                                                if (isBreak) {
                                                    if (rowNum === 0) {
                                                        return (
                                                            <td key={colIdx} rowSpan={allDayIndices.length}
                                                                className="bg-gradient-to-b from-amber-50/60 to-orange-50/60 border-x border-amber-100/50 p-2 align-middle w-12">
                                                                <div className="flex items-center justify-center h-full">
                                                                    <span className="text-amber-700/70 font-bold text-[10px] tracking-[0.3em] uppercase whitespace-nowrap -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                                        ☕ Tea Break
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return null;
                                                }
                                                if (isLunch) {
                                                    if (rowNum === 0) {
                                                        return (
                                                            <td key={colIdx} rowSpan={allDayIndices.length}
                                                                className="bg-gradient-to-b from-blue-50/60 to-indigo-50/60 border-x border-blue-100/50 p-2 align-middle w-12">
                                                                <div className="flex items-center justify-center h-full">
                                                                    <span className="text-blue-700/70 font-bold text-[10px] tracking-[0.3em] uppercase whitespace-nowrap -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                                                        🍽️ Lunch Break
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return null;
                                                }

                                                const entries = mergedGrid[pSec]?.[dayIdx]?.[periodCounter] || [];
                                                const currentPeriod = periodCounter;
                                                periodCounter++;

                                                if (entries.length === 0) {
                                                    return <td key={`${colIdx}-${currentPeriod}`} className="p-2 border-slate-50/50 border border-dashed"></td>;
                                                }

                                                return (
                                                    <td key={`${colIdx}-${currentPeriod}`} className="p-2 align-top h-full border border-slate-50/50 border-dashed">
                                                        <div className="flex flex-col gap-2 h-full">
                                                            {entries.map((entry, idx) => {
                                                                const colors = getColorForSubject(entry.subject);
                                                                return (
                                                                    <div key={idx} 
                                                                         className={`relative p-3 rounded-xl border ${colors.border} ${colors.bg} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 min-w-[130px]`}>
                                                                        <div className={`font-bold text-sm mb-2 ${colors.textPrimary}`}>
                                                                            {entry.subject}
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <div className={`flex items-center gap-2 text-[11px] font-semibold ${colors.textSecondary}`}>
                                                                                <Users className={`w-3.5 h-3.5 flex-shrink-0 ${colors.icon}`} />
                                                                                <span className="truncate">{entry.faculty}</span>
                                                                            </div>
                                                                            {entry.room && (
                                                                                <div className={`flex items-center gap-2 text-[11px] font-semibold ${colors.textSecondary}`}>
                                                                                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${colors.icon}`} />
                                                                                    <span className="truncate">{entry.room}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
                </div>
            ))}
        </div>
    );
}
