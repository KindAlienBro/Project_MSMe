"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Send, Eye, RefreshCw, Wand2, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { TimetableGrid } from '@/components/dashboard/TimetableGrid';
import { endpoints } from '@/lib/api';

const HF_API = 'https://kindalien-timetable-gen.hf.space';
const SLM_API = 'https://vishwasmsme-timetable-slm-api.hf.space';

export function UpdateTimetableView() {
    const { user } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasSchedule, setHasSchedule] = useState<boolean | null>(null);

    useEffect(() => {
        const checkSchedule = async () => {
            // Check local storage first
            const cached = localStorage.getItem('timetable_v2');
            if (cached) {
                setHasSchedule(true);
                return;
            }
            try {
                const res = await axios.get(`${HF_API}/schedule`);
                setHasSchedule(res.data.exists);
                if (res.data.exists && res.data.grid) {
                    localStorage.setItem('timetable_v2', JSON.stringify(res.data));
                }
            } catch {
                setHasSchedule(false);
            }
        };
        // Only run if user is authenticated (token exists) to avoid 401 on page load
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (user && ['ADMIN', 'SUPER_TEACHER'].includes(user.role) && token) {
            checkSchedule();
            // Pre-warm the SLM API to wake it up if it's sleeping, preventing an unexpected 503 translating to a 400 error later.
            try {
                axios.get(`${SLM_API}/health`, { timeout: 3000 }).catch(() => {});
            } catch (e) {}
        }
    }, [user]);

    if (!user || !['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    if (hasSchedule === false) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">No Timetable Generated</h3>
                <p className="text-gray-500 mt-2">Go to Timetable Generator first to create one.</p>
            </div>
        );
    }

    const handlePreview = async () => {
        if (!prompt.trim()) return;
        setIsPreviewing(true);
        setError(null);
        setPreviewResult(null);
        try {
            const res = await axios.post(`${HF_API}/update`, {
                prompt: prompt, preview_only: true
            });
            setPreviewResult(res.data);
        } catch (err: any) {
            let errorMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to preview constraint.";
            const raw = err.response?.data?.raw;
            if (err.response?.status === 400 && raw) {
                errorMsg = `Could not parse your instruction. Raw response: ${raw}`;
            } else if (errorMsg.includes("503") || errorMsg.includes("Read timed out")) {
                errorMsg = "The AI model is currently waking up from sleep. Please wait a few seconds and try again.";
            } else if (err.response?.status === 400) {
                errorMsg = `Could not understand the instruction: ${errorMsg}`;
            }
            setError(errorMsg);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleApply = async () => {
        if (!prompt.trim()) return;
        setIsApplying(true);
        setError(null);
        setResult(null);
        setPreviewResult(null);
        try {
            const res = await axios.post(`${HF_API}/update`, {
                prompt: prompt, preview_only: false
            });
            setResult(res.data);
            // Save the updated schedule to local storage so the Generator view sees it
            if (res.data.status === 'SUCCESS' && res.data.grid) {
                // Determine changed slots by diffing against current local grid before overwriting
                const prevGridRaw = localStorage.getItem('timetable_v2');
                const prevGrid = prevGridRaw ? JSON.parse(prevGridRaw).grid || {} : {};
                const updatedGrid = JSON.parse(JSON.stringify(res.data.grid));
                const hasPrevGrid = Object.keys(prevGrid).length > 0;

                if (hasPrevGrid) {
                    Object.keys(updatedGrid).forEach(secId => {
                        const secDays = updatedGrid[secId].slots || {};
                        const prevSecDays = prevGrid[secId]?.slots || {};
                        Object.keys(secDays).forEach(dayIdx => {
                            const daySlots = secDays[dayIdx] || {};
                            const prevDaySlots = prevSecDays[dayIdx] || {};
                            Object.keys(daySlots).forEach(pIdx => {
                                const classes = daySlots[pIdx] || [];
                                const prevClasses = prevDaySlots[pIdx] || [];
                                
                                classes.forEach((cls: any) => {
                                    // If class wasn't here previously, flag it to trigger highlighting visually
                                    const existed = prevClasses.find((pc: any) => pc.subject === cls.subject && pc.faculty === cls.faculty);
                                    if (!existed) {
                                        cls.is_substituted = true;
                                    } else if (existed.is_substituted) {
                                        // Carry over previous substitution flags
                                        cls.is_substituted = true;
                                        cls.original_faculty = existed.original_faculty;
                                    }
                                });
                            });
                        });
                    });
                }

                localStorage.setItem('timetable_v2', JSON.stringify({
                    status: 'SAVED',
                    grid: updatedGrid,
                    days: res.data.days,
                    headers: res.data.headers,
                    break_after_index: res.data.break_after_index,
                    lunch_after_index: res.data.lunch_after_index,
                    num_periods: res.data.num_periods,
                }));
                // Broadcast notification to all students
                try {
                    await endpoints.timetableChange.notify({
                        message: res.data.changes?.join('\n') || 'The timetable has been updated by the admin.'
                    });
                } catch (e) {
                    console.error('Failed to send notifications', e);
                }
            }
        } catch (err: any) {
            let errorMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to apply update.";
            const raw = err.response?.data?.raw;
            if (err.response?.status === 400 && raw) {
                errorMsg = `Could not parse your instruction. Raw response: ${raw}`;
            } else if (errorMsg.includes("503") || errorMsg.includes("Read timed out") || errorMsg.includes("504")) {
                errorMsg = "The AI model is currently waking up from sleep. Please wait a few seconds and try again.";
            } else if (errorMsg.includes("timetable generated yet")) {
                errorMsg = "The server has lost the timetable (session expired). Please go to Generator view and click 'Generate Timetable' again to sync.";
            } else if (err.response?.status === 400) {
                errorMsg = `Could not understand the instruction: ${errorMsg}`;
            }
            setError(errorMsg);
        } finally {
            setIsApplying(false);
        }
    };

    const handleRevert = async () => {
        if (!window.confirm("Are you sure you want to revert all changes and restore the original timetable? This cannot be undone.")) return;
        try {
            await axios.post(`${HF_API}/schedule/revert`);
            localStorage.removeItem('timetable_v2');
            setResult(null);
            setPreviewResult(null);
            setPrompt('');
            alert("Successfully reverted to the original timetable.");
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to revert schedule.");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">✏️ Update Timetable</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Natural language timetable modification — only affected slots are rescheduled
                    </p>
                </div>
                <button
                    onClick={handleRevert}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
                >
                    <RotateCcw className="w-4 h-4" />
                    Revert Changes
                </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 How it works</h3>
                <p className="text-xs text-blue-700 mb-3">
                    Type a natural language instruction. Only the affected slots will be rescheduled — the rest stays unchanged.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-blue-600">
                    <span>• Prof. Anu is not available on Friday</span>
                    <span>• NLP Lab must be in consecutive slots</span>
                    <span>• ML should be scheduled in the morning</span>
                    <span>• Limit Sanjay to 3 hours per day</span>
                    <span>• Prof. Kavitha should have Wednesday free</span>
                    <span>• Swap Monday P1 NLP with Wednesday P3 ML</span>
                </div>
            </div>

            {/* Input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    💬 Enter your instruction:
                </label>
                <input
                    type="text" value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                    placeholder="e.g. Prof. Anu is not available on Friday"
                    className="w-full rounded-lg border-gray-300 border p-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm mb-4"
                />

                <div className="flex gap-3">
                    <button onClick={handleApply} disabled={isApplying || !prompt.trim()}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-colors ${isApplying || !prompt.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isApplying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Applying...</> : <><Wand2 className="w-4 h-4" /> Apply Change</>}
                    </button>
                    <button onClick={handlePreview} disabled={isPreviewing || !prompt.trim()}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors border ${isPreviewing || !prompt.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        {isPreviewing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Previewing...</> : <><Eye className="w-4 h-4" /> Preview Constraint</>}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}
            </div>

            {/* Preview Result */}
            {previewResult && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">👁️ Constraint Preview</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Source: <span className="font-semibold">{previewResult.source === 'local' ? 'Local Parser' : 'SLM API'}</span>
                    </p>
                    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 overflow-x-auto">
                        <pre className="text-xs text-gray-700">{JSON.stringify(previewResult.parsed_constraints, null, 2)}</pre>
                    </div>
                </div>
            )}

            {/* Applied Result */}
            {result && (
                <div className="space-y-6">
                    <div className="bg-green-50 rounded-xl border border-green-200 p-6">
                        <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Timetable Updated!</h3>
                        {result.changes?.map((c: string, i: number) => (
                            <p key={i} className="text-sm text-green-700 mb-1">{c}</p>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Original Timetable</h3>
                            <TimetableGrid schedule={result.previous_schedule} />
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Updated Timetable</h3>
                            <TimetableGrid schedule={result.updated_schedule} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
