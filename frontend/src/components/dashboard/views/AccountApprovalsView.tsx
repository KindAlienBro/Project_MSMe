"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { endpoints } from '@/lib/api';
import { UserCheck, UserX, Clock, ShieldCheck, Mail, Building, User, Trash2, AlertTriangle, Users } from 'lucide-react';

interface UserAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  teacher_profile?: {
    dept_name: string;
    designation: string;
  };
}

function NotificationToast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="animate-slide-in-right fixed bottom-6 right-6 z-50">
      <div className={`px-5 py-4 rounded-xl shadow-xl flex items-center gap-3 border ${
        type === 'success' 
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-100/50' 
          : 'bg-red-50 text-red-800 border-red-200 shadow-red-100/50'
      }`}>
        {type === 'success' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <UserX className="w-5 h-5 text-red-600" />}
        <p className="font-semibold text-sm">{message}</p>
      </div>
    </div>
  );
}

export function AccountApprovalsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'deactivated'>('pending');
  
  const [pendingUsers, setPendingUsers] = useState<UserAccount[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserAccount[]>([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState<UserAccount[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const res = await endpoints.approvals.list();
        setPendingUsers(res.data);
      } else if (activeTab === 'active') {
        const res = await endpoints.approvals.activeList();
        setActiveUsers(res.data);
      } else if (activeTab === 'deactivated') {
        const res = await endpoints.approvals.deactivatedList();
        setDeactivatedUsers(res.data);
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} users`, error);
      setToast({ message: `Failed to load ${activeTab} accounts.`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const handleAction = async (id: number, action: 'approve' | 'reject' | 'delete' | 'reactivate' | 'toggle-super') => {
    setProcessingId(id);
    try {
      if (action === 'approve') {
        await endpoints.approvals.approve(id);
        setPendingUsers(prev => prev.filter(u => u.id !== id));
        setToast({ message: 'Account approved successfully!', type: 'success' });
      } else if (action === 'reject') {
        await endpoints.approvals.reject(id);
        setPendingUsers(prev => prev.filter(u => u.id !== id));
        setToast({ message: 'Account rejected successfully!', type: 'success' });
      } else if (action === 'delete') {
        await endpoints.approvals.delete(id);
        setActiveUsers(prev => prev.filter(u => u.id !== id));
        setToast({ message: 'Account deactivated successfully.', type: 'success' });
        setDeleteConfirmId(null);
      } else if (action === 'reactivate') {
        await endpoints.approvals.reactivate(id);
        setDeactivatedUsers(prev => prev.filter(u => u.id !== id));
        setToast({ message: 'Account reactivated successfully.', type: 'success' });
      } else if (action === 'toggle-super') {
        const res = await endpoints.approvals.toggleSuperTeacher(id);
        setActiveUsers(prev => prev.map(u => u.id === id ? { ...u, role: res.data.role } : u));
        setToast({ message: res.data.message, type: 'success' });
      }
    } catch (error) {
      console.error(`Failed to ${action} user`, error);
      setToast({ message: `Failed to ${action} account. Please try again.`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700">Access Denied</h2>
        <p className="text-gray-500 mt-2">Only Department Admins can view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10 animate-fade-in">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Manage Faculty Accounts
          </h1>
          <p className="text-gray-500 mt-1">Review pending registrations and manage active faculty members.</p>
        </div>
        
        {/* Tab Toggle */}
        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
            {pendingUsers.length > 0 && activeTab !== 'pending' && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pendingUsers.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-white text-emerald-600 shadow-sm border border-gray-200/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Active Faculty
          </button>
          <button
            onClick={() => setActiveTab('deactivated')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'deactivated'
                ? 'bg-white text-gray-700 shadow-sm border border-gray-200/50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
            }`}
          >
            <UserX className="w-4 h-4" />
            Deactivated
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeTab === 'pending' ? (
        /* PENDING TAB CONTENT */
        pendingUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-2">There are no pending account registrations right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{u.first_name} {u.last_name}</h3>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" /> <span className="truncate" title={u.email}>{u.email}</span>
                    </div>
                    {u.teacher_profile && (
                      <>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <User className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.designation.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <Building className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.dept_name} Department</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 border-t border-gray-100">
                  <button onClick={() => handleAction(u.id, 'reject')} disabled={processingId === u.id} className="flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                    {processingId === u.id ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <><UserX className="w-4 h-4" /> Reject</>}
                  </button>
                  <button onClick={() => handleAction(u.id, 'approve')} disabled={processingId === u.id} className="flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 border-l border-gray-100 transition-colors disabled:opacity-50">
                    {processingId === u.id ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <><UserCheck className="w-4 h-4" /> Approve</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'active' ? (
        /* ACTIVE TAB CONTENT */
        activeUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No active faculty found</h3>
            <p className="text-gray-500 mt-2">There are currently no approved faculty members in your department.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                      <ShieldCheck className="w-3.5 h-3.5" /> Active
                    </div>
                    {u.role === 'SUPER_TEACHER' && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-md">SUPER</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{u.first_name} {u.last_name}</h3>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" /> <span className="truncate" title={u.email}>{u.email}</span>
                    </div>
                    {u.teacher_profile && (
                      <>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <User className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.designation.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <Building className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.dept_name} Department</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 border-t border-gray-100 bg-gray-50 divide-x divide-gray-200">
                  <button 
                    onClick={() => handleAction(u.id, 'toggle-super')}
                    disabled={processingId === u.id}
                    className={`flex items-center justify-center gap-2 py-3.5 text-xs font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 ${u.role === 'SUPER_TEACHER' ? 'text-amber-600' : 'text-blue-600'}`}
                  >
                    {processingId === u.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (
                      u.role === 'SUPER_TEACHER' ? 'Remove Super' : 'Make Super'
                    )}
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(u.id)}
                    className="flex items-center justify-center gap-2 py-3.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* DEACTIVATED TAB CONTENT */
        deactivatedUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserX className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No deactivated accounts</h3>
            <p className="text-gray-500 mt-2">There are currently no deactivated faculty members.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deactivatedUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group opacity-75 hover:opacity-100">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide">
                      <UserX className="w-3.5 h-3.5" /> Deactivated
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight line-through decoration-gray-300">{u.first_name} {u.last_name}</h3>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2.5 text-sm text-gray-500">
                      <Mail className="w-4 h-4 text-gray-400" /> <span className="truncate" title={u.email}>{u.email}</span>
                    </div>
                    {u.teacher_profile && (
                      <>
                        <div className="flex items-center gap-2.5 text-sm text-gray-500">
                          <User className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.designation.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-500">
                          <Building className="w-4 h-4 text-gray-400" /> <span>{u.teacher_profile.dept_name} Department</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={() => handleAction(u.id, 'reactivate')}
                    disabled={processingId === u.id}
                    className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {processingId === u.id ? <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <><UserCheck className="w-4 h-4" /> Reactivate Account</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Deactivate Faculty Account?</h3>
              <p className="text-gray-500 text-sm mb-6">
                Are you absolutely sure you want to deactivate this account? 
                They will no longer be able to log in, but their data will remain in the database.
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={processingId === deleteConfirmId}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(deleteConfirmId, 'delete')}
                  disabled={processingId === deleteConfirmId}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {processingId === deleteConfirmId ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deactivating...</>
                  ) : (
                    'Yes, deactivate account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
