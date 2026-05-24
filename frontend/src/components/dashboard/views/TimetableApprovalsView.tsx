"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, CheckCircle, XCircle, Clock, CalendarDays, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { endpoints } from '@/lib/api';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

export function TimetableApprovalsView() {
    const { user } = useAuth();
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchProposals = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${HF_API}/schedule/proposals`);
            setProposals(res.data.proposals || []);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to load proposals.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'ADMIN') {
            fetchProposals();
        }
    }, [user]);

    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    const handleApprove = async (id: string) => {
        if (!confirm("Are you sure you want to approve and apply these changes to the active timetable?")) return;
        setActionLoading(id);
        try {
            await axios.post(`${HF_API}/schedule/proposals/${id}/approve`);
            
            // Sync the newly approved timetable directly to PostgreSQL
            try {
                const newSchedule = await axios.get(`${HF_API}/schedule`);
                await endpoints.syncTimetable(newSchedule.data);
            } catch (syncErr) {
                console.error("Failed to sync to PostgreSQL", syncErr);
            }

            await fetchProposals();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to approve.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm("Are you sure you want to reject and delete this proposal?")) return;
        setActionLoading(id);
        try {
            await axios.delete(`${HF_API}/schedule/proposals/${id}`);
            await fetchProposals();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to reject.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">✅ Timetable Approvals</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Review and approve timetable changes proposed by Super Teachers
                    </p>
                </div>
                <button onClick={fetchProposals}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors border border-blue-100">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-100 border-dashed rounded-xl">
                    <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-800">All caught up!</h3>
                    <p className="text-gray-500 text-sm mt-1">No pending timetable proposals to review.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {proposals.map(proposal => (
                        <div key={proposal.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="border-b border-gray-50 bg-gray-50/50 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                            {proposal.proposer_name} <span className="text-xs font-normal text-gray-500">({proposal.proposer})</span>
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Proposed on {new Date(proposal.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleReject(proposal.id)}
                                        disabled={actionLoading === proposal.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" /> Reject
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(proposal.id)}
                                        disabled={actionLoading === proposal.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Approve & Apply
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-4">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-gray-400" />
                                    Description: {proposal.description}
                                </h4>
                                
                                {proposal.changes && proposal.changes.length > 0 ? (
                                    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                            {proposal.changes_count} Cell(s) Modified
                                        </p>
                                        <ul className="space-y-2">
                                            {proposal.changes.filter((change: any) => {
                                                if (!change.before || !change.after) return true;
                                                return change.before.day_index !== change.after.day_index || 
                                                       change.before.period_index !== change.after.period_index ||
                                                       change.before.subject_code !== change.after.subject_code ||
                                                       change.before.faculty_name !== change.after.faculty_name;
                                            }).map((change: any, i: number) => {
                                                const dMap = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                const before = change.before;
                                                const after = change.after;
                                                
                                                const getDay = (idx: number) => idx >= 0 && idx < dMap.length ? dMap[idx] : `Day ${idx}`;
                                                const getPeriod = (idx: number) => idx >= 0 ? `P${idx + 1}` : 'P?';

                                                if (before && after) {
                                                    const subject = (before.subject_code || '').toUpperCase();
                                                    const section = (before.section_id || '').split('-')[0].toUpperCase();
                                                    const afterSubject = (after.subject_code || '').toUpperCase();
                                                    const afterSection = (after.section_id || '').split('-')[0].toUpperCase();
                                                    
                                                    if (before.day_index !== after.day_index || before.period_index !== after.period_index) {
                                                        return (
                                                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                                                                <span>
                                                                    <strong className="font-medium text-blue-700">{subject} ({section}):</strong>{' '}
                                                                    Moved from <span className="line-through text-red-400 mx-1">{getDay(before.day_index)} {getPeriod(before.period_index)}</span>{' '}
                                                                    to <span className="text-green-600 font-medium">{getDay(after.day_index)} {getPeriod(after.period_index)}</span>
                                                                </span>
                                                            </li>
                                                        );
                                                    } else {
                                                        return (
                                                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                                                                <span>
                                                                    <strong className="font-medium">{getDay(before.day_index)} {getPeriod(before.period_index)}:</strong>{' '}
                                                                    <span className="line-through text-red-400 mr-1">{subject} ({section})</span>{' '}
                                                                    <span className="text-green-600 font-medium">{afterSubject} ({afterSection})</span>
                                                                </span>
                                                            </li>
                                                        );
                                                    }
                                                } else if (before && !after) {
                                                    const subject = (before.subject_code || '').toUpperCase();
                                                    const section = (before.section_id || '').split('-')[0].toUpperCase();
                                                    return (
                                                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                                                            <span>
                                                                <strong className="font-medium">{getDay(before.day_index)} {getPeriod(before.period_index)}:</strong>{' '}
                                                                {subject} ({section}) <span className="text-red-500 italic text-xs ml-1">Removed</span>
                                                            </span>
                                                        </li>
                                                    );
                                                } else if (!before && after) {
                                                    const subject = (after.subject_code || '').toUpperCase();
                                                    const section = (after.section_id || '').split('-')[0].toUpperCase();
                                                    return (
                                                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                                                            <span>
                                                                <strong className="font-medium">{getDay(after.day_index)} {getPeriod(after.period_index)}:</strong>{' '}
                                                                {subject} ({section}) <span className="text-green-600 italic text-xs ml-1">Added</span>
                                                            </span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 text-center">
                                        <p className="text-sm text-gray-500">No specific grid changes logged (or full regeneration proposed).</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
