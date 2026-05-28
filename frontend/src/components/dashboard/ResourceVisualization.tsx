"use client";

import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { endpoints } from '@/lib/api';
import { Building, Users, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';

const COLORS_STAFF = ['#ef4444', '#10b981']; // Red for occupied, Green for free
const COLORS_ROOMS = ['#f59e0b', '#3b82f6']; // Orange for occupied, Blue for free

interface ResourceData {
  total: number;
  occupied: number;
  free: number;
}

export function ResourceVisualization({ timetable }: { timetable?: any }) {
  const [staffData, setStaffData] = useState<ResourceData | null>(null);
  const [roomsData, setRoomsData] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<'rooms' | 'staff' | null>(null);

  // Extract actual names from timetable schedule
  const [occupiedTeachers, setOccupiedTeachers] = useState<string[]>([]);
  const [occupiedRooms, setOccupiedRooms] = useState<string[]>([]);
  const [allTeachers, setAllTeachers] = useState<string[]>([]);
  const [allRooms, setAllRooms] = useState<string[]>([]);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const response = await endpoints.resourceVisualization();
        if (response.data) {
          const backendData = response.data;

          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const today = days[new Date().getDay()];

          // Extract all teachers and rooms from schedule
          const allTeacherSet = new Set<string>();
          const allRoomSet = new Set<string>();
          const occupiedTeacherSet = new Set<string>();
          const occupiedRoomSet = new Set<string>();

          if (timetable && timetable.schedule) {
            Object.values(timetable.schedule).forEach((entry: any) => {
              if (entry.faculty_name) allTeacherSet.add(entry.faculty_name);
              if (entry.room_name || entry.room_id) allRoomSet.add(entry.room_name || entry.room_id);

              if (entry.day_name === today) {
                if (entry.faculty_name) occupiedTeacherSet.add(entry.faculty_name);
                if (entry.room_name || entry.room_id) occupiedRoomSet.add(entry.room_name || entry.room_id);
              }
            });

            backendData.staff.occupied = occupiedTeacherSet.size;
            backendData.staff.free = Math.max(0, backendData.staff.total - occupiedTeacherSet.size);
            backendData.rooms.occupied = occupiedRoomSet.size;
            backendData.rooms.free = Math.max(0, backendData.rooms.total - occupiedRoomSet.size);
          }

          setOccupiedTeachers(Array.from(occupiedTeacherSet).sort());
          setOccupiedRooms(Array.from(occupiedRoomSet).sort());
          setAllTeachers(Array.from(allTeacherSet).sort());
          setAllRooms(Array.from(allRoomSet).sort());

          setStaffData(backendData.staff);
          setRoomsData(backendData.rooms);
        }
      } catch (error) {
        console.error("Failed to fetch resource visualization data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, [timetable]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse h-64">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="bg-gray-100 rounded-lg"></div>
          <div className="bg-gray-100 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!staffData || !roomsData) {
    return null;
  }

  const staffChartData = [
    { name: 'Occupied', value: staffData.occupied },
    { name: 'Free', value: staffData.free },
  ];

  const roomsChartData = [
    { name: 'Occupied', value: roomsData.occupied },
    { name: 'Free', value: roomsData.free },
  ];

  const freeTeachers = allTeachers.filter(t => !occupiedTeachers.includes(t));
  const freeRooms = allRooms.filter(r => !occupiedRooms.includes(r));

  const togglePanel = (panel: 'rooms' | 'staff') => {
    setExpandedPanel(prev => prev === panel ? null : panel);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Building className="w-5 h-5 text-indigo-600" />
        Live Resource Occupancy
        <span className="text-xs font-normal text-gray-400 ml-2">Click charts for details</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Physical Resources */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Physical Resources (Rooms/Labs)</h3>
          <p className="text-xs text-gray-500 mb-2">Total: {roomsData.total}</p>
          <div
            className="w-full h-48 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => togglePanel('rooms')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roomsChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roomsChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_ROOMS[index % COLORS_ROOMS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <button
            onClick={() => togglePanel('rooms')}
            className="mt-2 flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
          >
            {expandedPanel === 'rooms' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expandedPanel === 'rooms' ? 'Hide Details' : 'View Details'}
          </button>

          {expandedPanel === 'rooms' && (
            <div className="w-full mt-3 animate-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Occupied Rooms */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <h4 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Occupied ({occupiedRooms.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {occupiedRooms.length === 0 ? (
                      <p className="text-[10px] text-amber-500 italic">None occupied today</p>
                    ) : (
                      occupiedRooms.map((room, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-800 font-medium bg-white/60 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          {room}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Free Rooms */}
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Free ({freeRooms.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {freeRooms.length === 0 ? (
                      <p className="text-[10px] text-blue-500 italic">All rooms occupied</p>
                    ) : (
                      freeRooms.map((room, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-blue-800 font-medium bg-white/60 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                          {room}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Staff Resources */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600" /> Staff Resources
          </h3>
          <p className="text-xs text-gray-500 mb-2">Total: {staffData.total}</p>
          <div
            className="w-full h-48 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => togglePanel('staff')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={staffChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {staffChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_STAFF[index % COLORS_STAFF.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <button
            onClick={() => togglePanel('staff')}
            className="mt-2 flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
          >
            {expandedPanel === 'staff' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expandedPanel === 'staff' ? 'Hide Details' : 'View Details'}
          </button>

          {expandedPanel === 'staff' && (
            <div className="w-full mt-3 animate-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Occupied Staff */}
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <h4 className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Occupied ({occupiedTeachers.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {occupiedTeachers.length === 0 ? (
                      <p className="text-[10px] text-red-500 italic">None occupied today</p>
                    ) : (
                      occupiedTeachers.map((teacher, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-red-800 font-medium bg-white/60 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                          {teacher}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Free Staff */}
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Free ({freeTeachers.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {freeTeachers.length === 0 ? (
                      <p className="text-[10px] text-emerald-500 italic">All staff occupied</p>
                    ) : (
                      freeTeachers.map((teacher, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium bg-white/60 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          {teacher}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
