"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, GitCompare, RefreshCw } from 'lucide-react';
import axios from 'axios';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

const PALETTE = [
    'bg-blue-50 border-blue-200 text-blue-800',
    'bg-purple-50 border-purple-200 text-purple-800',
    'bg-green-50 border-green-200 text-green-800',
    'bg-orange-50 border-orange-200 text-orange-800',
    'bg-pink-50 border-pink-200 text-pink-800',
    'bg-teal-50 border-teal-200 text-teal-800',
];

// ── Grid renderer — consumes the pre-built grid from api.py ────────────────
function TimetableGrid({
    grid,
    days,
    headers,
    breakAfter,
    lunchAfter,
}: {
    grid: Record<string, any>;
    days: string[];
    headers: string[];
    breakAfter: number;
    lunchAfter: number;
}) {
    if (!grid) return null;
    const sections = Object.keys(grid).sort();
    const breakHeaderIdx = breakAfter + 1;
    const lunchHeaderIdx = lunchAfter + 2;

    return (
        <div className="space-y-10">
            {sections.map((section, si) => {
                const { slots } = grid[section];
                const color = PALETTE[si % PALETTE.length];
                const dayIndices: number[] = grid[section].days;
                const totalDays = dayIndices.length;

                return (
                    <div key={section}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
                                Section {section}
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                            <table className="min-w-full text-xs border-collapse bg-white">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 w-16 sticky left-0 bg-gray-50">
                                            Day
                                        </th>
                                        {headers.map((h, hi) => {
                                            const isBreak = hi === breakHeaderIdx;
                                            const isLunch = hi === lunchHeaderIdx;
                                            return (
                                                <th
                                                    key={hi}
                                                    className={`border border-gray-200 px-2 py-2 text-center font-semibold min-w-[90px] ${isBreak || isLunch ? 'bg-amber-50 text-amber-700 italic font-normal text-[10px]' : 'text-gray-600'
                                                        }`}
                                                >
                                                    {h}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dayIndices.map((dayIdx, rowNum) => {
                                        const dayName = days[dayIdx] ?? `Day ${dayIdx}`;
                                        const daySlots = slots[String(dayIdx)] ?? {};
                                        let periodCounter = 0;

                                        return (
                                            <tr key={dayIdx} className="hover:bg-gray-50/50">
                                                <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600 bg-gray-50 sticky left-0 text-xs">
                                                    {dayName.slice(0, 3)}
                                                </td>
                                                {headers.map((h, hi) => {
                                                    const isBreak = hi === breakHeaderIdx;
                                                    const isLunch = hi === lunchHeaderIdx;

                                                    if (isBreak) {
                                                        return rowNum === 0 ? (
                                                            <td
                                                                key={hi}
                                                                rowSpan={totalDays}
                                                                className="border border-gray-200 px-1 py-1 text-center bg-amber-50 text-amber-600 text-[10px] font-medium"
                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                            >
                                                                Tea Break
                                                            </td>
                                                        ) : null;
                                                    }
                                                    if (isLunch) {
                                                        return rowNum === 0 ? (
                                                            <td
                                                                key={hi}
                                                                rowSpan={totalDays}
                                                                className="border border-gray-200 px-1 py-1 text-center bg-blue-50 text-blue-600 text-[10px] font-medium"
                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                                            >
                                                                Lunch
                                                            </td>
                                                        ) : null;
                                                    }

                                                    const cells: any[] = daySlots[String(periodCounter)] ?? [];
                                                    periodCounter++;

                                                    return (
                                                        <td key={hi} className="border border-gray-200 px-1 py-1 align-top">
                                                            {cells.length === 0 ? (
                                                                <span className="text-gray-200 flex justify-center items-center h-10">—</span>
                                                            ) : (
                                                                cells.map((c: any, ci: number) => (
                                                                    <div key={ci} className={`rounded px-1.5 py-1 mb-0.5 border ${color}`}>
                                                                        <div className="font-bold leading-tight text-[11px]">{c.subject}</div>
                                                                        <div className="opacity-70 text-[10px] leading-tight">{c.faculty}</div>
                                                                    </div>
                                                                ))
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
                );
            })}
        </div>
    );
}

export function OriginalVsCurrentView() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'original' | 'current'>('original');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch both current and original schedules from HF
                const [currRes, origRes] = await Promise.all([
                    axios.get(`${HF_API}/schedule`),
                    axios.get(`${HF_API}/schedule/original`)
                ]);

                // Get history to count total changes
                let changes = 0;
                try {
                    const histRes = await axios.get(`${HF_API}/history`);
                    changes = histRes.data.count || 0;
                } catch { /* ignore */ }

                setData({
                    current: currRes.data.exists ? currRes.data : null,
                    original: origRes.data.exists ? origRes.data : null,
                    total_changes: changes
                });
            } catch (err: any) {
                setError(err.message || "Failed to load schedules.");
            } finally {
                setLoading(false);
            }
        };
        if (user && ['ADMIN', 'SUPER_TEACHER'].includes(user.role)) fetchData();
    }, [user]);

    if (!user || !['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center p-10">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-600">Loading schedules...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">{error}</h3>
            </div>
        );
    }

    const origAt = data?.original?.generated_at?.slice(0, 16).replace('T', ' ') || 'N/A';
    const currAt = data?.current?.generated_at?.slice(0, 16).replace('T', ' ') || 'N/A';

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">📊 Original vs Current</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Compare the original generated timetable with the current (modified) version
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Original Generated</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">{origAt}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Last Updated</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">{currAt}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Changes</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">{data?.total_changes ?? 0}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button onClick={() => setActiveTab('original')}
                        className={`flex-1 px-6 py-3.5 text-sm font-medium transition-colors ${activeTab === 'original' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                        🗂️ Original Timetable
                    </button>
                    <button onClick={() => setActiveTab('current')}
                        className={`flex-1 px-6 py-3.5 text-sm font-medium transition-colors ${activeTab === 'current' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                        📅 Current Timetable
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'original' ? (
                        data?.original?.grid ? (
                            <>
                                <p className="text-xs text-gray-500 mb-4">Generated on {origAt} — never modified</p>
                                <TimetableGrid
                                    grid={data.original.grid}
                                    days={data.original.days}
                                    headers={data.original.headers}
                                    breakAfter={data.original.break_after_index}
                                    lunchAfter={data.original.lunch_after_index}
                                />
                            </>
                        ) : (
                            <p className="text-gray-500 text-center py-8">
                                Original snapshot not available. Regenerate the timetable to create one.
                            </p>
                        )
                    ) : (
                        data?.current?.grid ? (
                            <>
                                <p className="text-xs text-gray-500 mb-4">Last updated: {currAt} — {data?.total_changes ?? 0} change(s) applied</p>
                                <TimetableGrid
                                    grid={data.current.grid}
                                    days={data.current.days}
                                    headers={data.current.headers}
                                    breakAfter={data.current.break_after_index}
                                    lunchAfter={data.current.lunch_after_index}
                                />
                            </>
                        ) : (
                            <p className="text-gray-500 text-center py-8">No current schedule available.</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
