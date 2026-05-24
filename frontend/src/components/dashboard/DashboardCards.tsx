"use client";
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardData {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'pink';
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  pink: 'bg-pink-50 text-pink-600',
};

interface Props {
  cards: CardData[];
  loading?: boolean;
}

export function DashboardCards({ cards, loading }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const colorClass = colorClasses[card.color];

        return (
          <div
            key={index}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${colorClass}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>

            <div>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-4 bg-gray-100 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-gray-900 mb-1">{card.value}</p>
                  <p className="text-sm font-medium text-gray-700 mb-1">{card.title}</p>
                  <p className="text-xs text-gray-500">{card.subtitle}</p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}