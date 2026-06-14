"use client";
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { StudentAttendanceView } from '@/components/dashboard/views/StudentAttendanceView';
import { FacultyAttendanceHistoryView } from '@/components/dashboard/views/FacultyAttendanceHistoryView';

export default function AttendancePage() {
    const { user } = useAuth();

    if (!user) return null;

    if (user.role === 'STUDENT') {
        return <StudentAttendanceView />;
    }

    return <FacultyAttendanceHistoryView />;
}
