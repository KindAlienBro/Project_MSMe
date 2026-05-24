"use client";
import React from 'react';
import { Bell, CheckCircle, AlertCircle, UserCog, Calendar } from 'lucide-react';

interface Props {
  leaves: any[];
  subRequests: any[];
}

export function RecentNotifications({ leaves, subRequests }: Props) {
  // Build activity items from real leaves and substitution request data
  const activities = React.useMemo(() => {
    const items: { id: string; type: string; message: string; time: string; icon: 'leave' | 'sub' | 'info' }[] = [];

    // Add leave activities
    leaves.forEach(leave => {
      const statusLabel = leave.status === 'APPROVED' ? 'approved' : leave.status === 'REJECTED' ? 'rejected' : 'submitted';
      items.push({
        id: `leave-${leave.leave_id}`,
        type: 'Leave Request',
        message: `${leave.faculty_id} — leave ${statusLabel} (${leave.days?.join(', ')})`,
        time: leave.reason || '',
        icon: leave.status === 'APPROVED' ? 'leave' : 'info',
      });
    });

    // Add substitution activities
    subRequests.forEach(sub => {
      const statusLabel = sub.status === 'ACCEPTED' ? 'accepted' : sub.status === 'DECLINED' ? 'declined' : 'pending';
      items.push({
        id: `sub-${sub.request_id}`,
        type: 'Substitution',
        message: `${sub.affected_slot?.subject_code?.toUpperCase()} (${sub.affected_slot?.section_id?.toUpperCase()}) — ${sub.affected_slot?.day} P${(sub.affected_slot?.period || 0) + 1} • ${statusLabel}`,
        time: sub.sent_at ? new Date(sub.sent_at).toLocaleString() : '',
        icon: sub.status === 'ACCEPTED' ? 'sub' : 'info',
      });
    });

    return items.slice(0, 8); // Latest 8
  }, [leaves, subRequests]);

  const iconMap = {
    leave: CheckCircle,
    sub: UserCog,
    info: AlertCircle,
  };

  const colorMap = {
    leave: 'text-green-600 bg-green-50',
    sub: 'text-pink-600 bg-pink-50',
    info: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <span className="text-xs text-gray-400">{activities.length} items</span>
      </div>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No recent activity.</p>
        ) : (
          activities.map((item) => {
            const Icon = iconMap[item.icon];
            const colorClass = colorMap[item.icon];

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-all duration-200 bg-gray-50/30"
              >
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                      {item.type}
                    </h4>
                    <p className="text-sm text-gray-800 font-medium">{item.message}</p>
                    {item.time && (
                      <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
