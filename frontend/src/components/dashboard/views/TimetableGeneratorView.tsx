"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, Send, AlertCircle, CheckCircle, Wand2, Eye, RotateCcw, Archive, ChevronDown, ChevronUp, X, MessageSquare, BookOpen, Download } from 'lucide-react';
import axios from 'axios';
import { endpoints } from '@/lib/api';
import { ExportPreviewModal } from '../ExportPreviewModal';

const HF_API = process.env.NEXT_PUBLIC_HF_API || 'https://kindalien-timetable-gen.hf.space';

const PALETTE = [
    'bg-blue-50 border-blue-200 text-blue-800',
    'bg-purple-50 border-purple-200 text-purple-800',
    'bg-green-50 border-green-200 text-green-800',
    'bg-orange-50 border-orange-200 text-orange-800',
    'bg-pink-50 border-pink-200 text-pink-800',
    'bg-teal-50 border-teal-200 text-teal-800',
];

// ── Grid renderer ────────────────────────────────────────────────────────
function TimetableGrid({
    grid,
    days,
    headers,
    breakAfter,
    lunchAfter,
    numPeriods,
}: {
    grid: Record<string, any>;
    days: string[];
    headers: string[];
    breakAfter: number;
    lunchAfter: number;
    numPeriods: number;
}) {
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
                            <table className="w-full min-w-[800px] text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 w-16 sticky left-0 bg-gray-50">Day</th>
                                        {headers.map((h, hi) => {
                                            const isBreak = hi === breakAfter + 1;
                                            const isLunch = hi === lunchAfter + 1;
                                            return (
                                                <th key={hi} className={`border border-gray-200 px-2 py-2 text-center font-semibold min-w-[90px] ${isBreak || isLunch ? 'bg-amber-50 text-amber-700 italic font-normal text-[10px]' : 'text-gray-600'}`}>
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
                                                            <td key={hi} rowSpan={totalDays} className="border border-gray-200 px-1 py-1 text-center bg-amber-50 text-amber-600 text-[10px] font-medium"
                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Tea Break</td>
                                                        ) : null;
                                                    }
                                                    if (isLunch) {
                                                        return rowNum === 0 ? (
                                                            <td key={hi} rowSpan={totalDays} className="border border-gray-200 px-1 py-1 text-center bg-blue-50 text-blue-600 text-[10px] font-medium"
                                                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Lunch</td>
                                                        ) : null;
                                                    }
                                                    const cells: any[] = daySlots[String(periodCounter)] ?? [];
                                                    periodCounter++;
                                                    return (
                                                        <td key={hi} className="border border-gray-200 px-1 py-1 align-top">
                                                            {cells.length === 0 ? (
                                                                <span className="text-gray-200 flex justify-center items-center h-10">—</span>
                                                            ) : (
                                                                <div className={`rounded px-1 py-1 border flex flex-col justify-center min-h-[40px] ${color}`}>
                                                                    {cells.map((c: any, ci: number) => (
                                                                        <React.Fragment key={ci}>
                                                                            <div className="text-center w-full">
                                                                                <div className="font-bold leading-tight text-[11px]">{c.subject}</div>
                                                                                <div className="opacity-70 text-[10px] leading-tight">{c.faculty}</div>
                                                                            </div>
                                                                            {ci < cells.length - 1 && (
                                                                                <div className="w-full my-1 border-t border-dashed border-current opacity-30"></div>
                                                                            )}
                                                                        </React.Fragment>
                                                                    ))}
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
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function TimetableGeneratorView() {
    const { user } = useAuth();
    const [timeLimit, setTimeLimit] = useState(120);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [timetable, setTimetable] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Update Timetable state
    const [prompt, setPrompt] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [updateResult, setUpdateResult] = useState<any>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

    // Versions state
    const [versions, setVersions] = useState<any[]>([]);
    const [showVersions, setShowVersions] = useState(false);
    const [isRestoringVersion, setIsRestoringVersion] = useState<string | null>(null);
    const [versionLabel, setVersionLabel] = useState('');
    
    // Export state
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportData, setExportData] = useState<any>(null);
    const [isExportingVersion, setIsExportingVersion] = useState<string | null>(null);

    // Semester selection state
    const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
    const [semesterType, setSemesterType] = useState<'ODD' | 'EVEN' | null>(null);
    const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
    const [lockedSemestersStr, setLockedSemestersStr] = useState<string>('');

    // ── Load timetable on mount ──────────────────────────────────────────
    useEffect(() => {
        const loadSaved = async () => {
            const cached = localStorage.getItem('timetable_v2');
            if (cached) {
                try {
                    setTimetable(JSON.parse(cached));
                    setIsLoading(false);
                    return;
                } catch { /* corrupt */ }
            }
            try {
                const res = await axios.get(`${HF_API}/schedule`);
                if (res.data.exists && res.data.grid) {
                    setTimetable(res.data);
                    localStorage.setItem('timetable_v2', JSON.stringify(res.data));
                }
            } catch { /* API unreachable */ }
            setIsLoading(false);
        };
        loadSaved();
    }, []);

    // ── Fetch versions ───────────────────────────────────────────────────
    const fetchVersions = async () => {
        try {
            const res = await axios.get(`${HF_API}/schedule/versions`);
            setVersions(res.data.versions || []);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    // ── Fetch available semesters ────────────────────────────────────────
    useEffect(() => {
        const fetchSemesters = async () => {
            try {
                const res = await axios.get(`${HF_API}/data/semesters`);
                setAvailableSemesters(res.data.semesters || []);
            } catch { /* ignore */ }
        };
        fetchSemesters();
    }, []);

    // ── Handle semester type toggle ──────────────────────────────────────
    const handleSemesterType = (type: 'ODD' | 'EVEN') => {
        setSemesterType(type);
        const filtered = availableSemesters.filter(s =>
            type === 'ODD' ? s % 2 !== 0 : s % 2 === 0
        );
        setSelectedSemesters(filtered); // Pre-select all
    };

    const toggleSemester = (sem: number) => {
        setSelectedSemesters(prev =>
            prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem].sort()
        );
    };

    const filteredSemesters = availableSemesters.filter(s =>
        semesterType === 'ODD' ? s % 2 !== 0 : semesterType === 'EVEN' ? s % 2 === 0 : false
    );

    if (!user || !['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    // ── Generate ─────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const lockedSems = lockedSemestersStr
                .split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n));

            const res = await axios.post(`${HF_API}/generate`, {
                time_limit_seconds: timeLimit,
                semesters: selectedSemesters.length > 0 ? selectedSemesters : undefined,
                locked_semesters: lockedSems.length > 0 ? lockedSems : undefined,
                version_label: versionLabel.trim() ? versionLabel.trim() : undefined,
            });
            if (res.data.status === 'OPTIMAL' || res.data.status === 'FEASIBLE') {
                setTimetable(res.data);
                localStorage.setItem('timetable_v2', JSON.stringify(res.data));
                fetchVersions(); // Refresh versions list
                setVersionLabel(''); // Clear label after successful generation

                try {
                    await endpoints.syncTimetable(res.data);
                } catch (syncErr) {
                    console.error("Failed to sync to PostgreSQL", syncErr);
                }
            } else {
                setError(`Solver returned: ${res.data.status}`);
            }
        } catch (err: any) {
            const detail = err.response?.data?.detail || err.message || 'Server error.';
            setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleClear = async () => {
        if (!window.confirm("This will save the current timetable as a version and clear it. Continue?")) return;
        localStorage.removeItem('timetable_v2');
        setTimetable(null);
        try {
            const url = versionLabel.trim()
                ? `${HF_API}/schedule?version_label=${encodeURIComponent(versionLabel.trim())}`
                : `${HF_API}/schedule`;
            await axios.delete(url);
            fetchVersions(); // Refresh versions
            setVersionLabel(''); // Clear label
        } catch { /* ignore */ }
    };

    // ── AI Update ────────────────────────────────────────────────────────
    const handlePreview = async () => {
        if (!prompt.trim()) return;
        setIsPreviewing(true);
        setUpdateError(null);
        setPreviewResult(null);
        try {
            const res = await axios.post(`${HF_API}/update`, { prompt, preview_only: true });
            setPreviewResult(res.data);
        } catch (err: any) {
            let msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to preview.';
            const raw = err.response?.data?.raw;
            if (typeof msg !== 'string') msg = JSON.stringify(msg);
            if (err.response?.status === 400 && raw) {
                msg = `Could not parse your instruction. Raw response: ${raw}`;
            } else if (msg.includes('503') || msg.includes('timed out')) {
                msg = 'The AI model is waking up. Please wait and try again.';
            } else if (err.response?.status === 400) {
                msg = `Could not understand the instruction: ${msg}`;
            }
            setUpdateError(msg);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleApply = async () => {
        if (!prompt.trim()) return;
        setIsApplying(true);
        setUpdateError(null);
        setUpdateResult(null);
        setPreviewResult(null);
        try {
            if (user?.role === 'SUPER_TEACHER') {
                // Compute the updated schedule without saving it (propose_only)
                const res = await axios.post(`${HF_API}/update`, { prompt, propose_only: true });
                if (res.data.status !== 'PROPOSED' || !res.data.schedule) {
                    setUpdateError('AI could not process this instruction. Please try a different prompt.');
                    setIsApplying(false);
                    return;
                }
                const proposeRes = await axios.post(`${HF_API}/schedule/propose`, {
                    schedule: res.data.schedule,
                    proposer: user.email,
                    proposer_name: user.email.split('@')[0],
                    description: `AI Update: ${prompt}`
                });
                if (proposeRes.data.status === 'SUCCESS') {
                    setUpdateResult({ changes: ['✅ Changes submitted for Admin approval.'] });
                    setPrompt('');
                    setPreviewResult(null);
                } else {
                    setUpdateError(`API error: ${res.data.status}`);
                }
                setIsApplying(false);
                return;
            }

            const res = await axios.post(`${HF_API}/update`, { prompt, preview_only: false });
            setUpdateResult(res.data);
            if (res.data.status === 'SUCCESS' && res.data.grid) {
                const newTT = {
                    status: 'SAVED',
                    grid: res.data.grid,
                    days: res.data.days,
                    headers: res.data.headers,
                    break_after_index: res.data.break_after_index,
                    lunch_after_index: res.data.lunch_after_index,
                    num_periods: res.data.num_periods,
                };
                setTimetable(newTT);
                localStorage.setItem('timetable_v2', JSON.stringify(newTT));

                try {
                    const newSchedule = await axios.get(`${HF_API}/schedule`);
                    await endpoints.syncTimetable(newSchedule.data);
                } catch (syncErr) {
                    console.error("Failed to sync to PostgreSQL", syncErr);
                }

                try {
                    await endpoints.timetableChange.notify({
                        message: res.data.changes?.join('\n') || 'Timetable updated.'
                    });
                } catch { /* ignore */ }
            }
        } catch (err: any) {
            let msg = err.response?.data?.detail || err.response?.data?.error || "Failed to apply.";
            const raw = err.response?.data?.raw;
            if (typeof msg !== 'string') msg = JSON.stringify(msg);
            if (err.response?.status === 400 && raw) {
                msg = `Could not parse your instruction. Raw response: ${raw}`;
            } else if (msg.includes("503") || msg.includes("timed out")) {
                msg = "The AI model is waking up. Please wait and try again.";
            } else if (msg.includes("timetable generated yet")) {
                msg = "Server lost the timetable. Please regenerate first.";
            } else if (err.response?.status === 400) {
                msg = `Could not understand the instruction: ${msg}`;
            }
            setUpdateError(msg);
        } finally {
            setIsApplying(false);
        }
    };

    // ── Version Restore ──────────────────────────────────────────────────
    const handleRestoreVersion = async (versionId: string) => {
        if (!window.confirm("This will save the current timetable as a version and restore the selected one. Continue?")) return;
        setIsRestoringVersion(versionId);
        try {
            const res = await axios.post(`${HF_API}/schedule/versions/restore/${versionId}`);
            if (res.data.status === 'SUCCESS') {
                const newTT = {
                    status: 'SAVED',
                    grid: res.data.grid,
                    days: res.data.days,
                    headers: res.data.headers,
                    break_after_index: res.data.break_after_index,
                    lunch_after_index: res.data.lunch_after_index,
                    num_periods: res.data.num_periods,
                };
                setTimetable(newTT);
                localStorage.setItem('timetable_v2', JSON.stringify(newTT));
                fetchVersions();
                alert(`Restored: ${res.data.message}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to restore version.");
        } finally {
            setIsRestoringVersion(null);
        }
    };

    // ── Version Export ───────────────────────────────────────────────────
    const handleExportVersion = async (versionId: string) => {
        setIsExportingVersion(versionId);
        try {
            const res = await axios.get(`${HF_API}/schedule/versions/${versionId}`);
            if (res.data.status === 'SUCCESS') {
                setExportData(res.data);
                setExportModalOpen(true);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to fetch version data for export.");
        } finally {
            setIsExportingVersion(null);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🗓️ Timetable Generator</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Generate, update, and manage timetable versions
                    </p>
                </div>
                {timetable && ['ADMIN', 'SUPER_TEACHER'].includes(user?.role) && (
                    <button onClick={handleClear}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition-colors">
                        🗑 Clear &amp; Regenerate
                    </button>
                )}
            </div>

            {/* ═══ Config Panel ═══ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

                {/* ── Semester Selector ── */}
                <div className="mb-6">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        Select Semesters to Generate
                    </label>

                    {/* Odd / Even toggle */}
                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={() => handleSemesterType('ODD')}
                            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm border-2 transition-all duration-200 ${semesterType === 'ODD'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                }`}
                        >
                            🔷 Odd Semesters (1, 3, 5, 7...)
                        </button>
                        <button
                            onClick={() => handleSemesterType('EVEN')}
                            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm border-2 transition-all duration-200 ${semesterType === 'EVEN'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                                }`}
                        >
                            🔶 Even Semesters (2, 4, 6, 8...)
                        </button>
                    </div>

                    {/* Semester checkboxes */}
                    {semesterType && (
                        <div className="flex flex-wrap gap-2 animate-in fade-in">
                            {filteredSemesters.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No {semesterType.toLowerCase()} semesters found in the data.</p>
                            ) : (
                                filteredSemesters.map(sem => (
                                    <button
                                        key={sem}
                                        onClick={() => toggleSemester(sem)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all duration-200 ${selectedSemesters.includes(sem)
                                                ? semesterType === 'ODD'
                                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-sm'
                                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        {selectedSemesters.includes(sem) ? '✅' : '⬜'} Semester {sem}
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {!semesterType && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            ⚠️ Please select Odd or Even semesters first to proceed.
                        </p>
                    )}
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                ⏱ Solver Time Limit: <span className="text-blue-600">{timeLimit}s</span>
                            </label>
                            <input type="range" min={10} max={1800} value={timeLimit}
                                onChange={e => setTimeLimit(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>10s</span><span>1800s</span></div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                🔒 Locked Semesters :
                            </label>
                            <input type="text" value={lockedSemestersStr}
                                onChange={e => setLockedSemestersStr(e.target.value)}
                                placeholder="e.g. 7"
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave empty for none. These won't be modified.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                🏷️ Save Current as Version :
                            </label>
                            <input type="text" value={versionLabel}
                                onChange={e => setVersionLabel(e.target.value)}
                                placeholder="e.g. Midterm Schedule v1"
                                className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Provide a label to name the snapshot.</p>
                        </div>
                    </div>
                </div>

                {['ADMIN', 'SUPER_TEACHER'].includes(user?.role) && (
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button onClick={handleGenerate} disabled={isGenerating || selectedSemesters.length === 0}
                            title={selectedSemesters.length === 0 ? 'Select at least one semester' : ''}
                            className={`flex items-center gap-2 px-7 py-2.5 rounded-lg text-white font-semibold shadow-sm transition-colors ${isGenerating || selectedSemesters.length === 0 ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {isGenerating
                                ? <><RefreshCw className="w-5 h-5 animate-spin" /> Generating...</>
                                : <><Send className="w-5 h-5" /> Generate Timetable ({selectedSemesters.length > 0 ? `Sem ${selectedSemesters.join(', ')}` : 'Select semesters'})</>
                            }
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mt-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <pre className="text-sm text-red-700 whitespace-pre-wrap font-sans">{error}</pre>
                    </div>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center items-center py-10 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading saved schedule...
                </div>
            )}

            {/* ═══ Active Timetable ═══ */}
            {timetable?.grid && !isLoading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {timetable.status === 'SAVED' || !timetable.status
                                    ? '📂 Active Timetable'
                                    : `✅ Timetable Generated — ${timetable.status}`}
                            </h2>
                            {timetable.generated_at && (
                                <p className="text-sm text-gray-500">
                                    {String(timetable.generated_at).slice(0, 16).replace('T', ' ')}
                                </p>
                            )}
                            {timetable.task_count && (
                                <p className="text-xs text-gray-400">{timetable.task_count} tasks scheduled</p>
                            )}
                        </div>
                    </div>

                    <TimetableGrid
                        grid={timetable.grid}
                        days={timetable.days ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']}
                        headers={timetable.headers ?? Array.from({ length: 10 }, (_, i) => `P${i + 1}`)}
                        breakAfter={timetable.break_after_index ?? 2}
                        lunchAfter={timetable.lunch_after_index ?? 5}
                        numPeriods={timetable.num_periods ?? 8}
                    />
                </div>
            )}

            {/* ═══ Saved Versions ═══ */}
            {versions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => setShowVersions(!showVersions)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Archive className="w-5 h-5 text-gray-500" />
                            <span className="font-semibold text-gray-800">Previous Versions ({versions.length})</span>
                        </div>
                        {showVersions ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>

                    {showVersions && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100">
                            {versions.map((v) => {
                                const raw = v.timestamp?.endsWith('Z') ? v.timestamp : (v.timestamp + 'Z');
                                const ts = new Date(raw).toLocaleString();
                                return (
                                    <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{v.label}</p>
                                            <p className="text-xs text-gray-500">
                                                {ts} · {v.history_count} change{v.history_count !== 1 ? 's' : ''} recorded
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleExportVersion(v.id)}
                                                disabled={isExportingVersion === v.id || isRestoringVersion === v.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 disabled:opacity-50"
                                            >
                                                {isExportingVersion === v.id
                                                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching...</>
                                                    : <><Download className="w-3.5 h-3.5" /> Preview &amp; Export</>
                                                }
                                            </button>
                                            <button
                                                onClick={() => handleRestoreVersion(v.id)}
                                                disabled={isRestoringVersion === v.id || isExportingVersion === v.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors border border-blue-200 disabled:opacity-50"
                                            >
                                                {isRestoringVersion === v.id
                                                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Restoring...</>
                                                    : <><RotateCcw className="w-3.5 h-3.5" /> Restore</>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Floating Chatbot Panel ═══ */}
            {timetable?.grid && !isLoading && (
                <>
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
                        className="fixed bottom-8 right-8 z-50 p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center"
                    >
                        {isAiPanelOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                    </button>

                    {/* Chatbot Side Panel */}
                    <div className={`fixed top-0 right-0 h-screen w-full sm:w-[400px] bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-l border-gray-200 flex flex-col ${isAiPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        {/* Header */}
                        <div className="p-4 bg-purple-600 text-white flex items-center gap-3">
                            <Wand2 className="w-5 h-5" />
                            <h2 className="text-lg font-bold">AI Timetable Assistant</h2>
                        </div>

                        {/* Content Scrollable Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            <div className="bg-purple-100 text-purple-900 rounded-xl rounded-tl-sm p-4 text-sm shadow-sm">
                                <p>Hi! I am your AI assistant. Tell me what changes you want to make to the timetable in plain English.</p>
                                <p className="mt-2 text-xs opacity-80">Examples:</p>
                                <ul className="list-disc pl-4 text-xs opacity-80 mt-1 space-y-1">
                                    <li>Prof. Anu is not available on Friday</li>
                                    <li>ML should be scheduled in the morning</li>
                                    <li>Swap Monday P1 NLP with Wednesday P3</li>
                                </ul>
                            </div>

                            {previewResult && (
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-fade-in">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">👁️ Constraint Preview</h3>
                                    <pre className="text-xs text-gray-700 overflow-x-auto bg-gray-50 p-2 rounded">{JSON.stringify(previewResult.parsed_constraints, null, 2)}</pre>
                                </div>
                            )}

                            {updateResult && (
                                <div className="bg-green-50 rounded-xl border border-green-200 p-4 shadow-sm animate-fade-in">
                                    <h3 className="text-xs font-semibold text-green-800 mb-2">✅ Applied Successfully</h3>
                                    {updateResult.changes?.map((c: string, i: number) => (
                                        <p key={i} className="text-xs text-green-700 mb-1 leading-relaxed">{c}</p>
                                    ))}
                                </div>
                            )}

                            {updateError && (
                                <div className="bg-red-50 rounded-xl border border-red-200 p-4 shadow-sm animate-fade-in flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-red-700 leading-relaxed">{updateError}</p>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-200">
                            <input
                                type="text" value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                                placeholder="Type your instruction..."
                                className="w-full rounded-full border-gray-300 border px-4 py-3 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm mb-3 bg-gray-50"
                            />
                            <div className="flex gap-2">
                                <button onClick={handlePreview} disabled={isPreviewing || !prompt.trim()}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm border ${isPreviewing || !prompt.trim() ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                                    {isPreviewing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview
                                </button>
                                <button onClick={handleApply} disabled={isApplying || !prompt.trim()}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white font-medium transition-colors text-sm shadow-sm ${isApplying || !prompt.trim() ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                    {isApplying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {user?.role === 'SUPER_TEACHER' ? 'Propose' : 'Apply'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ Export Preview Modal ═══ */}
            {exportModalOpen && exportData && (
                <ExportPreviewModal
                    isOpen={exportModalOpen}
                    onClose={() => setExportModalOpen(false)}
                    matrix={{}}
                    rawGrid={exportData.grid}
                    headers={exportData.headers || Array.from({ length: 10 }, (_, i) => `P${i + 1}`)}
                    weekDays={exportData.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']}
                    breakAfterIndex={exportData.break_after_index ?? 2}
                    lunchAfterIndex={exportData.lunch_after_index ?? 5}
                    selectedSection={exportData.label || "Version"}
                    selectedFaculty={""}
                />
            )}
        </div>
    );
}
