"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Clock, ChevronDown, ChevronUp, RefreshCw, RotateCcw, Filter, Undo2 } from 'lucide-react';
import axios from 'axios';

const HF_API = process.env.NEXT_PUBLIC_HF_API || 'https://kindalien-timetable-gen.hf.space';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface HistoryEntry {
    id: string;
    timestamp: string;
    operation_type: string;
    description: string;
    affected_sections: string[];
    changes: any[];
    status: string;
    constraints: any[];
    prompt?: string;
    changes_summary?: string;
}

/** Operation type badge */
function opBadge(op: string) {
    const map: Record<string, { bg: string; text: string }> = {
        'MANUAL_OVERWRITE': { bg: 'bg-blue-100', text: 'text-blue-700' },
        'INJECT_SUBJECT': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
        'REMOVE_SUBJECT': { bg: 'bg-red-100', text: 'text-red-700' },
        'LLM_UPDATE': { bg: 'bg-purple-100', text: 'text-purple-700' },
        'SUBSTITUTION': { bg: 'bg-orange-100', text: 'text-orange-700' },
        'REVERT': { bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    const style = map[op] || { bg: 'bg-gray-100', text: 'text-gray-700' };
    const label: Record<string, string> = {
        'MANUAL_OVERWRITE': 'Drag & Drop',
        'INJECT_SUBJECT': 'Added Subject',
        'REMOVE_SUBJECT': 'Removed Subject',
        'LLM_UPDATE': 'AI Update',
        'SUBSTITUTION': 'Substitution',
        'REVERT': 'Revert',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
            {label[op] || op}
        </span>
    );
}

export function ChangeHistoryView() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    
    const [classFilter, setClassFilter] = useState<string>('ALL');
    const [opFilter, setOpFilter] = useState<string>('ALL');

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${HF_API}/history`);
            setHistory(res.data.history || []);
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to load history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && ['ADMIN', 'SUPER_TEACHER'].includes(user.role)) fetchHistory();
    }, [user]);

    const handleClearHistory = async () => {
        if (!window.confirm("Are you sure you want to clear all history logs? This only deletes the logs, not the timetable.")) return;
        try {
            await axios.delete(`${HF_API}/history`);
            setHistory([]);
            alert("History cleared.");
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to clear history.");
        }
    };

    const handleRevertEntry = async (e: React.MouseEvent, entry: HistoryEntry) => {
        e.stopPropagation();
        if (entry.status === 'REVERTED') {
            alert("This change has already been reverted.");
            return;
        }
        if (!window.confirm(`Are you sure you want to revert: "${entry.description}"?`)) return;
        try {
            await axios.post(`${HF_API}/history/revert/${entry.id}`);
            alert("Successfully reverted change.");
            fetchHistory();
        } catch (err: any) {
            if (err.response?.status === 409) {
                const msg = typeof err.response.data?.detail === 'object' 
                    ? err.response.data.detail.message 
                    : (err.response.data?.detail || "Conflicts detected. Overwrite newer changes?");
                if (window.confirm(msg)) {
                    try {
                        await axios.post(`${HF_API}/history/revert/${entry.id}?force=true`);
                        alert("Successfully force reverted change.");
                        fetchHistory();
                    } catch (err2: any) {
                        setError(err2.response?.data?.error || "Failed to force revert.");
                    }
                }
            } else {
                setError(err.response?.data?.error || err.response?.data?.detail || "Failed to revert change.");
            }
        }
    };

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
                <span className="ml-2 text-gray-600">Loading history...</span>
            </div>
        );
    }

    const uniqueClasses = Array.from(new Set(history.flatMap(h => h.affected_sections || []))).sort();
    const uniqueOps = Array.from(new Set(history.map(h => h.operation_type || 'UNKNOWN'))).sort();

    const filteredHistory = history.filter(h => {
        if (classFilter !== 'ALL' && !(h.affected_sections || []).includes(classFilter)) return false;
        if (opFilter !== 'ALL' && (h.operation_type || 'UNKNOWN') !== opFilter) return false;
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">📋 Change History</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        All timetable modifications are logged here
                    </p>
                </div>
                {history.length > 0 && (
                    <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Clear History Logs
                    </button>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-md">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {history.length > 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Filter className="w-4 h-4 text-indigo-500" /> Filters:
                    </div>
                    <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
                        className="rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="ALL">All Classes</option>
                        {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)}
                        className="rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="ALL">All Operations</option>
                        {uniqueOps.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                </div>
            )}

            {history.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600">No Changes Yet</h3>
                    <p className="text-sm text-gray-400 mt-1">Timetable modifications will appear here.</p>
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No changes match the selected filters.</div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-600">Showing {filteredHistory.length} change(s)</p>
                    {filteredHistory.map((entry, i) => {
                        const raw = entry.timestamp.endsWith('Z') ? entry.timestamp : entry.timestamp + 'Z';
                        const ts = new Date(raw).toLocaleString();
                        const isExpanded = expandedIndex === i;
                        const isReverted = entry.status === 'REVERTED';
                        return (
                            <div key={entry.id || i} className={`rounded-xl shadow-sm border overflow-hidden transition-all ${isReverted ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-100'}`}>
                                {/* Header Row */}
                                <div
                                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50/80 transition-colors text-left cursor-pointer gap-3"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${entry.status === 'SUCCESS' ? 'bg-green-500' : isReverted ? 'bg-gray-400' : 'bg-amber-500'}`} />
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {opBadge(entry.operation_type || 'UPDATE')}
                                                <span className="text-xs text-gray-500">{ts}</span>
                                                {isReverted && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-300 text-gray-700">REVERTED</span>
                                                )}
                                            </div>
                                            <p className={`text-sm mt-1 ${isReverted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {entry.description || entry.prompt || 'No description'}
                                            </p>
                                            {entry.affected_sections && entry.affected_sections.length > 0 && (
                                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                                    {entry.affected_sections.map(sec => (
                                                        <span key={sec} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded">{sec}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                                        {entry.operation_type !== 'REVERT' && !isReverted && (
                                            <button
                                                onClick={(e) => handleRevertEntry(e, entry)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors border border-amber-200"
                                            >
                                                <Undo2 className="w-3.5 h-3.5" /> Revert
                                            </button>
                                        )}
                                        <div className="p-1 hover:bg-gray-200 rounded">
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4 bg-gray-50/50">
                                        {entry.changes && entry.changes.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                                                    Detailed Changes ({entry.changes.length} cell{entry.changes.length > 1 ? 's' : ''})
                                                </p>
                                                <div className="grid gap-2">
                                                    {entry.changes.map((change: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                                                            <div className="flex flex-col md:flex-row gap-3 items-stretch">
                                                                {/* BEFORE */}
                                                                <div className="flex-1 bg-red-50 text-red-800 p-3 rounded-lg border border-red-100">
                                                                    <span className="font-bold text-[10px] text-red-500 uppercase block mb-1.5">Before</span>
                                                                    {change.before ? (
                                                                        <div className="space-y-1">
                                                                            <div className="font-bold text-sm">{(change.before.subject_code || '').toUpperCase()}</div>
                                                                            <div className="text-xs opacity-80">
                                                                                📅 {change.before.day_name || DAYS[change.before.day_index] || ''} · Period {(change.before.period_index ?? 0) + 1}
                                                                            </div>
                                                                            <div className="text-xs opacity-80">
                                                                                🏫 {change.before.section_id} · 👤 {change.before.faculty_name || ''}
                                                                            </div>
                                                                        </div>
                                                                    ) : <span className="text-xs italic opacity-60">Empty slot</span>}
                                                                </div>
                                                                {/* Arrow */}
                                                                <div className="flex items-center justify-center text-gray-400 font-bold text-xl">→</div>
                                                                {/* AFTER */}
                                                                <div className="flex-1 bg-green-50 text-green-800 p-3 rounded-lg border border-green-100">
                                                                    <span className="font-bold text-[10px] text-green-500 uppercase block mb-1.5">After</span>
                                                                    {change.after ? (
                                                                        <div className="space-y-1">
                                                                            <div className="font-bold text-sm">{(change.after.subject_code || '').toUpperCase()}</div>
                                                                            <div className="text-xs opacity-80">
                                                                                📅 {change.after.day_name || DAYS[change.after.day_index] || ''} · Period {(change.after.period_index ?? 0) + 1}
                                                                            </div>
                                                                            <div className="text-xs opacity-80">
                                                                                🏫 {change.after.section_id} · 👤 {change.after.faculty_name || ''}
                                                                            </div>
                                                                        </div>
                                                                    ) : <span className="text-xs italic opacity-60">Removed</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {entry.constraints && entry.constraints.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase">Constraints Applied</p>
                                                <div className="bg-white rounded-lg border border-gray-200 p-3 mt-1 overflow-x-auto">
                                                    <pre className="text-xs text-gray-700">{JSON.stringify(entry.constraints, null, 2)}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
