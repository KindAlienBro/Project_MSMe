"use client";
import React, { useState } from 'react';
import { UserCog, Calendar, Clock, MapPin, Filter } from 'lucide-react';

interface SubRequest {
  request_id: string;
  affected_slot: {
    subject_code: string;
    section_id: string;
    day: string;
    period: number;
    room_id: string;
  };
  original_faculty_id: string;
  candidate_faculty_id: string;
  priority_level: number;
  status: string;
  sent_at: string;
  expires_at: string;
}

interface Props {
  requests: SubRequest[];
  isAdmin: boolean;
}

export function SubstituteRequests({ requests, isAdmin }: Props) {
  const [filter, setFilter] = useState('all');

  const filteredRequests = filter === 'all'
    ? requests
    : requests.filter(req => req.status.toLowerCase() === filter);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 'bg-orange-50 text-orange-600';
      case 'ACCEPTED': return 'bg-green-50 text-green-600';
      case 'DECLINED': return 'bg-red-50 text-red-600';
      case 'WITHDRAWN': return 'bg-gray-100 text-gray-500';
      case 'TIMEOUT': return 'bg-gray-100 text-gray-400';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-pink-50 rounded-lg">
            <UserCog className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Substitute Requests</h2>
            <p className="text-xs text-gray-500">
              {requests.filter(r => r.status === 'PENDING').length} pending
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
          >
            <option value="all">All ({requests.length})</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
          <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {filteredRequests.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No substitute requests.</p>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req.request_id}
              className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {req.affected_slot.subject_code.toUpperCase()} — Sec {req.affected_slot.section_id.toUpperCase()}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Original: {req.original_faculty_id}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{req.affected_slot.day}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>P{req.affected_slot.period + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{req.affected_slot.room_id}</span>
                </div>
              </div>

              {isAdmin && (
                <p className="text-[10px] text-gray-400 mt-2">
                  Candidate: {req.candidate_faculty_id}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}