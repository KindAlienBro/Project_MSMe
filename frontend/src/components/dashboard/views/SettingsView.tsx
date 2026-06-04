"use client";
import React from 'react';
import { User, Mail, Building2, Briefcase, Shield, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function SettingsView() {
  const { user } = useAuth();

  const getInitials = () => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account settings and profile preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-md shrink-0">
            {getInitials()}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-sm text-gray-500 font-medium capitalize mt-1">
              {user?.role?.toLowerCase() || 'User'}
            </p>
          </div>
        </div>

        <hr className="border-gray-100 mb-8" />

        <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {/* First Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">First Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                defaultValue={user?.first_name || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Last Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                defaultValue={user?.last_name || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                defaultValue={user?.email || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Department</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                defaultValue={user?.teacher_profile?.dept_name || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Designation */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Designation</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                defaultValue={user?.teacher_profile?.designation || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Role</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                defaultValue={user?.role || ''}
                readOnly
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm outline-none cursor-not-allowed uppercase"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
