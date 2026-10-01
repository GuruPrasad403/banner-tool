import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, FileJson } from 'lucide-react';

export default function ValidationReportView({ report, jobId, jsonReportUrl }) {
  if (!report) return null;

  const { overallStatus, summary, rules } = report;

  const statusConfig = {
    passed: { label: 'PASSED', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: CheckCircle2 },
    passed_with_warnings: { label: 'PASSED WITH WARNINGS', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', icon: AlertTriangle },
    failed: { label: 'VALIDATION FAILED', bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400', icon: XCircle }
  };

  const currentStatus = statusConfig[overallStatus] || statusConfig.failed;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          5. Validation Rule Engine Diagnostics
        </h2>

        {jsonReportUrl && (
          <a
            href={jsonReportUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg border border-gray-700 flex items-center gap-1.5 transition-all"
          >
            <FileJson className="w-3.5 h-3.5 text-sky-400" /> Full Report JSON
          </a>
        )}
      </div>

      {/* Overall Status Banner */}
      <div className={`p-4 rounded-xl border ${currentStatus.bg} flex items-center justify-between mb-5`}>
        <div className="flex items-center gap-3">
          <StatusIcon className="w-6 h-6" />
          <div>
            <div className="text-sm font-bold tracking-wider">{currentStatus.label}</div>
            <div className="text-xs opacity-80 mt-0.5">
              Ran {summary?.total || 0} rules ({summary?.passed || 0} passed, {summary?.failed || 0} failed, {summary?.warnings || 0} warnings)
            </div>
          </div>
        </div>
      </div>

      {/* Rules Diagnostic List */}
      <div className="space-y-2">
        {rules && rules.map((r, idx) => {
          const isPass = r.status === 'passed';
          const isFail = r.status === 'failed';
          const isWarn = r.status === 'warning';

          const badgeColor = isPass
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : (isFail ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300');

          return (
            <div
              key={idx}
              className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 flex items-start justify-between gap-4 font-mono text-xs"
            >
              <div className="flex items-start gap-2.5">
                {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                {isFail && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                {isWarn && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}

                <div>
                  <div className="font-bold text-gray-200">{r.ruleId}</div>
                  <div className="text-gray-400 font-sans mt-0.5 text-xs">{r.message}</div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold shrink-0 ${badgeColor}`}>
                {r.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
