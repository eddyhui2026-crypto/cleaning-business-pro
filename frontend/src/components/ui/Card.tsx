import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isUp: boolean;
  };
}

export const Card = ({ title, value, subtext, icon, trend }: CardProps) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
        {icon && (
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            trend.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {trend.isUp ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-2 text-sm text-slate-400 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
};