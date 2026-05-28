"use client";
import React from 'react';
import { Clock, User as UserIcon, ChevronLeft, ChevronRight, Zap, CheckCircle2, MapPin } from 'lucide-react';

interface ClassItem {
  subject: string;
  faculty: string;
  section: string;
  time: string;
  is_substituted: boolean;
  original_faculty: string;
  periodIndex: number;
  room?: string;
  batch?: string;
}

interface Props {
  classes: ClassItem[];
  loading?: boolean;
}

export function TodaysTimetable({ classes, loading }: Props) {
  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('timetable-container');
    if (container) {
      const scrollAmount = 350;
      const current = container.scrollLeft;
      container.scrollTo({
        left: direction === 'left' ? current - scrollAmount : current + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Get current time in IST
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

  const getStatus = (timeStr: string) => {
    const parts = timeStr.split('-');
    if (parts.length !== 2) return 'upcoming';

    const parseTime = (t: string) => {
      const [h, m] = t.trim().split(':').map(Number);
      const hour = h < 8 ? h + 12 : h; // 1:40 → 13:40
      return hour * 60 + (m || 0);
    };

    const startMin = parseTime(parts[0]);
    const endMin = parseTime(parts[1]);

    if (currentMinutes >= endMin) return 'completed';
    if (currentMinutes >= startMin && currentMinutes < endMin) return 'current';
    return 'upcoming';
  };

  const allCompleted = classes.length > 0 && classes.every(c => getStatus(c.time) === 'completed');
  const currentClass = classes.find(c => getStatus(c.time) === 'current');
  const nextClass = classes.find(c => getStatus(c.time) === 'upcoming');
  const completedCount = classes.filter(c => getStatus(c.time) === 'completed').length;

  if (loading) {
    return (
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Schedule</h2>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-shrink-0 w-80 bg-white rounded-xl p-5 border border-gray-200 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-3"></div>
              <div className="h-4 bg-gray-100 rounded w-20 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded w-28"></div>
                <div className="h-3 bg-gray-100 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {allCompleted ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All {classes.length} classes completed for today
              </span>
            ) : currentClass ? (
              <span className="text-blue-600">
                Now: <strong>{currentClass.subject}</strong> • {completedCount}/{classes.length} completed
              </span>
            ) : nextClass ? (
              <span>
                Next: <strong>{nextClass.subject}</strong> at {nextClass.time} • {completedCount}/{classes.length} completed
              </span>
            ) : (
              `${classes.length} class${classes.length !== 1 ? 'es' : ''} today`
            )}
          </p>
        </div>
        {classes.length > 3 && (
          <div className="flex items-center gap-2">
            <button onClick={() => scroll('left')} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => scroll('right')} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
          <p className="text-gray-500 text-sm">No classes scheduled for today.</p>
        </div>
      ) : (
        <div
          id="timetable-container"
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {classes.map((item, idx) => {
            const status = getStatus(item.time);

            return (
              <div
                key={idx}
                className={`flex-shrink-0 w-80 bg-white rounded-xl p-5 border shadow-sm hover:shadow-md transition-all duration-200 ${item.is_substituted
                    ? 'border-orange-300 bg-orange-50/50'
                    : status === 'current'
                      ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100'
                      : 'border-gray-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{item.subject}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Sec {item.section}
                      </span>
                      {item.batch && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full border border-indigo-200">
                          Batch {item.batch}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {status === 'current' && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Live
                      </span>
                    )}
                    {status === 'completed' && (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                    {status === 'upcoming' && (
                      <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded">
                        Upcoming
                      </span>
                    )}
                    {item.is_substituted && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
                        Substitute
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{item.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <UserIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.faculty}</span>
                  </div>
                  {item.is_substituted && item.original_faculty && (
                    <div className="flex items-center gap-2 text-xs text-orange-600">
                      <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="italic">Original: {item.original_faculty}</span>
                    </div>
                  )}
                  {item.room && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{item.room}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
