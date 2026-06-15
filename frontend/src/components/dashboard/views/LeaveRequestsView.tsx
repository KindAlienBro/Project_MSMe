"use client";
import React, { useState, useEffect } from 'react';
import { Calendar, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

interface LeaveRequest {
  leave_id: string;
  faculty_id: string;
  days: string[];
  reason: string;
  status: string;
}

export function LeaveRequestsView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_TEACHER';
  const isStrictAdmin = user?.role === 'ADMIN';

  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaves' | 'cancellations'>('leaves');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: 'Medical',
    description: ''
  });

  const getDayNames = (start: string, end: string) => {
    const days: string[] = [];
    let currentDate = new Date(start);
    const endDate = new Date(end);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    while (currentDate <= endDate) {
      const dayName = dayNames[currentDate.getDay()];
      if (dayName !== 'Sunday') {
        // Ensure we don't add duplicates if it's more than a week
        if (!days.includes(dayName)) days.push(dayName);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await axios.get(`${HF_API}/leave`);
      let allLeaves = response.data.leaves || [];

      // Filter if not admin
      if (!isAdmin) {
        const firstName = (user?.first_name || '').toLowerCase();
        const lastName = (user?.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();

        allLeaves = allLeaves.filter((r: LeaveRequest) => {
          const facId = (r.faculty_id || '').toLowerCase();

          if (!firstName && !lastName) return false; // Safety check

          return facId === fullName ||
            (firstName && facId.includes(firstName)) ||
            (lastName && facId.includes(lastName));
        });
      }
      setLeaveRequests(allLeaves);
      // Fetch Cancellations
      try {
        const cRes = await axios.get(`${HF_API}/cancellations`);
        let allCancels = cRes.data.cancellations || [];
        if (!isAdmin) {
          const currentTeacherName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim().toLowerCase();
          const currentTeacherNameStripped = currentTeacherName.replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();
          allCancels = allCancels.filter((c: any) => {
            if (!c.faculty_id) return false;
            const fac = c.faculty_id.toLowerCase().replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();
            return fac.includes(currentTeacherNameStripped) || currentTeacherNameStripped.includes(fac) || c.faculty_id === 'teacher';
          });
        }
        setCancellations(allCancels);
      } catch (err) { console.error("Failed to fetch cancellations", err); }
      
    } catch (error) {
      console.error("Failed to fetch leave requests", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [user]);

  const pendingCount = leaveRequests.filter((r: LeaveRequest) => r.status === 'PENDING').length;
  const approvedCount = leaveRequests.filter((r: LeaveRequest) => r.status === 'APPROVED').length;
  const rejectedCount = leaveRequests.filter((r: LeaveRequest) => r.status === 'REJECTED').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const daysList = getDayNames(formData.start_date, formData.end_date);
      if (daysList.length === 0) {
        alert("Invalid dates or no working days found.");
        return;
      }

      const payload = {
        faculty_id: `${user?.first_name} ${user?.last_name}`,
        days: daysList,
        reason: `${formData.reason}: ${formData.description} (${formData.start_date} to ${formData.end_date})`
      };

      await axios.post(`${HF_API}/leave`, payload);

      setShowForm(false);
      setFormData({
        start_date: '',
        end_date: '',
        reason: 'Medical',
        description: ''
      });
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to submit leave request", error);
      alert("Failed to submit leave request");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.post(`${HF_API}/leave/approve/${id}`);
      fetchLeaveRequests();
      alert("Leave approved and substitute algorithm triggered.");
    } catch (e: any) {
      alert('Error approving leave: ' + e.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.post(`${HF_API}/leave/reject/${id}`);
      fetchLeaveRequests();
    } catch (e: any) {
      alert('Error rejecting leave: ' + e.message);
    }
  };

  const handleCancelStatus = async (id: string, status: string) => {
    try {
      await axios.post(`${HF_API}/cancellations/${id}/status`, { status });
      fetchLeaveRequests();
      if (status === 'APPROVED') {
        alert("Cancellation approved. You can now use the Drag & Drop editor to reschedule.");
      }
    } catch (e: any) {
      alert('Error updating cancellation: ' + e.message);
    }
  };

  const handleReschedule = (c: any) => {
    const params = new URLSearchParams({
       section: c.section_id,
       day: c.day,
       period: c.period.toString(),
       subject: c.subject
    });
    window.location.href = `/dashboard/drag-drop-editor?${params.toString()}`;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{isAdmin ? 'All Leave Requests' : 'My Leave Requests'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isAdmin ? 'Manage faculty leave requests and automate substitutions' : 'Apply for leave and track your applications'}</p>
        </div>

        {!isAdmin && activeTab === 'leaves' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors self-start sm:self-auto"
          >
            <FileText className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Apply for Leave'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'leaves' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Leave Applications
        </button>
        <button 
          onClick={() => setActiveTab('cancellations')}
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'cancellations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Class Cancellations
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{leaveRequests.length}</p>
          <p className="text-sm text-gray-600 mt-1">Total Requests</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{pendingCount}</p>
          <p className="text-sm text-gray-600 mt-1">Pending</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{approvedCount}</p>
          <p className="text-sm text-gray-600 mt-1">Approved</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{activeTab === 'leaves' ? rejectedCount : cancellations.filter(c => c.status === 'REJECTED').length}</p>
          <p className="text-sm text-gray-600 mt-1">Rejected</p>
        </div>
      </div>

      {/* Leave Application Form */}
      {showForm && !isAdmin && activeTab === 'leaves' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Apply for Leave</h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Medical">Medical</option>
                <option value="Personal">Personal</option>
                <option value="Conference">Conference</option>
                <option value="Workshop">Workshop</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please provide details about your leave request..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-900">
                Your leave request will be sent to the department head for approval.
                The system will try to find substitutes for your classes automatically upon approval.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Leave Request
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Requests List */}
      {activeTab === 'leaves' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">{isAdmin ? 'Action Required' : 'My Leave History'}</h2>

        {leaveRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No leave requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaveRequests.map((request) => (
              <div
                key={request.leave_id}
                className="p-5 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {request.faculty_id}
                      </h3>
                      <span className="text-sm text-gray-500">
                        ({request.days.join(', ')})
                      </span>
                      <span
                        className={`text-xs font-medium px-3 py-1.5 rounded-full ${request.status === 'PENDING'
                          ? 'bg-orange-50 text-orange-600'
                          : request.status === 'APPROVED'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                          }`}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{request.reason}</p>
                  </div>

                  {isStrictAdmin && request.status === 'PENDING' && (
                    <div className="flex w-full sm:w-auto gap-2">
                      <button
                        onClick={() => handleApprove(request.leave_id)}
                        className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-green-700 transition-colors">Approve</button>
                      <button
                        onClick={() => handleReject(request.leave_id)}
                        className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-red-700 transition-colors">Reject</button>
                    </div>
                  )}

                  {!isStrictAdmin && request.status === 'PENDING' && (
                    <div className="w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg w-full sm:w-auto text-sm font-medium cursor-default"
                      >
                        Pending Approval
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Class Cancellations List */}
      {activeTab === 'cancellations' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">{isAdmin ? 'Pending Cancellations' : 'My Class Cancellations'}</h2>

        {cancellations.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No class cancellation requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cancellations.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-xl border border-gray-200 hover:border-red-200 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        {c.subject} <span className="font-normal text-gray-500">({c.section_id})</span>
                      </h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {c.day} • Period {c.period + 1}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${c.status === 'PENDING'
                          ? 'bg-orange-100 text-orange-700'
                          : c.status === 'APPROVED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-medium text-gray-500">Requested by:</span> {c.faculty_id}
                    </p>
                    <p className="text-sm text-gray-600 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                      <span className="font-medium text-gray-700">Reason:</span> {c.reason}
                    </p>
                  </div>

                  {isStrictAdmin && c.status === 'PENDING' && (
                    <div className="flex w-full sm:w-auto gap-2">
                      <button
                        onClick={() => handleCancelStatus(c.id, 'APPROVED')}
                        className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-green-700 transition-colors">Approve</button>
                      <button
                        onClick={() => handleCancelStatus(c.id, 'REJECTED')}
                        className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-red-700 transition-colors">Reject</button>
                    </div>
                  )}

                  {!isStrictAdmin && c.status === 'PENDING' && (
                    <div className="w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg w-full sm:w-auto text-sm font-medium cursor-default"
                      >
                        Pending Approval
                      </button>
                    </div>
                  )}

                  {isStrictAdmin && c.status === 'APPROVED' && (
                    <div className="flex w-full sm:w-auto gap-2">
                      <button
                        onClick={() => handleReschedule(c)}
                        className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                          Reschedule Class
                      </button>
                    </div>
                  )}
                  
                  {!isAdmin && c.status === 'PENDING' && (
                    <div className="w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg w-full sm:w-auto text-sm font-medium cursor-default"
                      >
                        Pending Approval
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
