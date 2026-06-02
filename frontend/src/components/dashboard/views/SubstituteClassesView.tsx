"use client";
import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Clock, ArrowRight, UserPlus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { endpoints } from '@/lib/api';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

interface ProposedSwap {
  subject_code: string;
  day: string;
  original_period: number;
  new_period: number;
}

interface AffectedSlot {
  subject_code: string;
  section_id: string;
  day: string;
  period: number;
  room_id: string;
}

interface SubstitutionRequest {
  request_id: string;
  leave_id: string;
  affected_slot: AffectedSlot;
  original_faculty_id: string;
  candidate_faculty_id: string;
  priority_level: number;
  status: string;
  sent_at: string;
  expires_at: string;
  proposed_swap?: ProposedSwap;
}

export function SubstituteClassesView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [requests, setRequests] = useState<SubstitutionRequest[]>([]);
  const [unresolved, setUnresolved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${HF_API}/substitution/pending`);
      let allReqs = response.data.substitutions || [];

      if (!isAdmin) {
        const firstName = (user?.first_name || '').toLowerCase();
        const lastName = (user?.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        allReqs = allReqs.filter((r: SubstitutionRequest) => {
          const candidateId = r.candidate_faculty_id.toLowerCase();
          const originalId = r.original_faculty_id.toLowerCase();

          // Do not show requests to the teacher who is on leave
          if ((firstName && originalId.includes(firstName)) ||
            (originalId && firstName.includes(originalId)) ||
            originalId === fullName ||
            (lastName && originalId.includes(lastName))) {
            return false;
          }

          // Match by: internal ID contains first name, or first/last name matches ID
          return (firstName && candidateId.includes(firstName)) ||
            (candidateId && firstName.includes(candidateId)) ||
            candidateId === fullName ||
            (lastName && candidateId.includes(lastName));
        });
      }
      setRequests(allReqs);

      if (isAdmin) {
        const uRes = await axios.get(`${HF_API}/substitution/unresolved`);
        setUnresolved(uRes.data.unresolved || []);
      }
    } catch (error) {
      console.error("Failed to fetch substitution requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAccept = async (id: string) => {
    // Check if request has expired
    const req = requests.find(r => r.request_id === id);
    if (req?.expires_at && new Date(req.expires_at) < new Date()) {
      alert('This substitution request has expired. Please refresh the page.');
      fetchRequests();
      return;
    }

    try {
      await axios.post(`${HF_API}/substitution/${id}/accept`);
      // Invalidate timetable cache so TimetableView fetches fresh data with substitution
      localStorage.removeItem('timetable_v2');
      fetchRequests();
      
      // Notify students of the change!
      try {
        await endpoints.timetableChange.notify({
            message: "A substitute teacher has been assigned to one of your classes. Please check your schedule.",
            notification_type: "SUBSTITUTION_UPDATE"
        });
      } catch (e) {
        console.error("Failed to broadcast substitution notification", e);
      }

      alert("Substitution Accepted! Timetable updated. Go to Timetable to see the change.");
    } catch (e: any) {
      const serverMsg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Unknown error';
      const status = e?.response?.status;
      if (status === 400) {
        alert(`Could not accept substitution: ${serverMsg}\nThe request may have expired or already been handled.`);
      } else {
        alert(`Error accepting substitution: ${serverMsg}`);
      }
      fetchRequests();
    }
  };

  const handleDecline = async (id: string) => {
    // Check if request has expired
    const req = requests.find(r => r.request_id === id);
    if (req?.expires_at && new Date(req.expires_at) < new Date()) {
      alert('This substitution request has expired. Please refresh the page.');
      fetchRequests();
      return;
    }

    try {
      await axios.post(`${HF_API}/substitution/${id}/decline`);
      fetchRequests();
    } catch (e: any) {
      const serverMsg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Unknown error';
      alert(`Error declining substitution: ${serverMsg}`);
      fetchRequests();
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{isAdmin ? 'Substitution Management' : 'Substitution Requests'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isAdmin ? 'Monitor automated substitutions and resolve conflicts' : 'Review and respond to class substitution requests'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">{isAdmin ? 'Active Pending Requests (System Working)' : 'Action Required'}</h2>

        {requests.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pending substitution requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.request_id}
                className={`p-5 rounded-xl border transition-all duration-200 ${req.priority_level === 1 ? 'border-green-200 bg-green-50' : req.priority_level === 2 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded bg-white border ${req.priority_level === 1 ? 'text-green-700 border-green-200' : 'text-orange-700 border-orange-200'}`}>
                        Priority {req.priority_level}
                      </span>
                      <h3 className="font-semibold text-gray-900">
                        {req.affected_slot.subject_code} - Section {req.affected_slot.section_id.toUpperCase()}
                      </h3>
                    </div>

                    <div className="text-sm text-gray-700 flex flex-col gap-1 mt-3">
                      <p><strong>Original Faculty:</strong> {req.original_faculty_id}</p>
                      <p><strong>When:</strong> {req.affected_slot.day}, P{req.affected_slot.period + 1}</p>
                      <p><strong>Room:</strong> {req.affected_slot.room_id}</p>

                      {req.proposed_swap && (
                        <div className="mt-2 p-3 bg-white rounded border border-blue-100 shadow-sm flex items-start gap-3">
                          <AlertCircle className="text-blue-500 w-5 h-5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-blue-900 text-xs mb-1">Proposed Swap Requirement</p>
                            <p className="text-xs text-blue-800">
                              You teach {req.proposed_swap.subject_code} on {req.proposed_swap.day} P{req.proposed_swap.original_period + 1}.
                              By accepting, your class moves to P{req.proposed_swap.new_period + 1}.
                            </p>
                          </div>
                        </div>
                      )}

                      {isAdmin && (
                        <p className="mt-2 text-xs text-gray-500 bg-white inline-block px-2 py-1 rounded border border-gray-200">Candidate: {req.candidate_faculty_id}</p>
                      )}
                    </div>
                  </div>

                  {!isAdmin && req.status === 'PENDING' && (() => {
                    const isExpired = req.expires_at && new Date(req.expires_at) < new Date();
                    return isExpired ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium border border-gray-200">
                        <Clock className="w-3.5 h-3.5" /> Expired
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleAccept(req.request_id)}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Accept
                        </button>
                        <button
                          onClick={() => handleDecline(req.request_id)}
                          className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm flex items-center justify-center gap-2">
                          <XCircle className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    );
                  })()}

                  {isAdmin && (
                    <span className={`text-xs flex items-center gap-1 ${req.expires_at && new Date(req.expires_at) < new Date() ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      <Clock className="w-3 h-3" />
                      {req.expires_at && new Date(req.expires_at) < new Date() ? 'Expired' : `Expires: ${new Date(req.expires_at).toLocaleTimeString()}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Unresolved Conflicts (Manual Assignment Required)
          </h2>
          {unresolved.length === 0 ? (
            <p className="text-gray-500 text-sm">No unresolved conflicts at this time.</p>
          ) : (
            <div className="space-y-3">
              {unresolved.map((u, i) => (
                <div key={i} className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <p className="font-medium text-red-900">Slot could not be filled automatically</p>
                  <p className="text-sm text-red-800 mt-1">Check change history or manually update timetable.</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
