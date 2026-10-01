import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Image as ImageIcon, Briefcase } from 'lucide-react';

export default function StatsOverview({ stats }) {
  const cards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs || 0,
      icon: Briefcase,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20'
    },
    {
      title: 'Passed Validations',
      value: stats.passed || 0,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    {
      title: 'Failed Validations',
      value: stats.failed || 0,
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20'
    },
    {
      title: 'Warnings / Issues',
      value: stats.warnings || 0,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20'
    },
    {
      title: 'Screenshots Generated',
      value: stats.totalScreenshots || 0,
      icon: ImageIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className={`p-4 rounded-xl border bg-gray-900/60 ${c.bg} backdrop-blur-sm transition-all hover:scale-[1.02]`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">{c.title}</span>
              <Icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{c.value}</div>
          </div>
        );
      })}
    </div>
  );
}
