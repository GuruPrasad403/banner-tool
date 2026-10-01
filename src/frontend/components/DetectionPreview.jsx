import React from 'react';
import { Eye, Layers, CheckCircle2, AlertCircle, Play, Loader2 } from 'lucide-react';

export default function DetectionPreview({ detectionData, onValidateAndCapture, isRunning, captureError }) {
  if (!detectionData) return null;

  const { root, isi, isiDetection, fixedRegions } = detectionData;
  const candidates = isiDetection?.candidates || [];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-6">
      {captureError && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono">
          🚨 Screenshot Capture Error: {captureError}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-400" />
          3. Section Detection & DOM Diagnostic Overview
        </h2>

        <button
          type="button"
          onClick={onValidateAndCapture}
          disabled={isRunning}
          className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Capturing Frames & Validating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              Run Validation & Capture ISI Screenshots
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Root Element Diagnostic Card */}
        <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-sky-400 mb-1 flex items-center justify-between">
            <span>Root Banner Element</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
              Confidence {root.confidence}%
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-white mb-2">{root.selector}</div>
          <div className="text-[11px] text-gray-400 space-y-1 font-mono">
            <div>Dimensions: <span className="text-gray-200">{root.box?.width} × {root.box?.height} px</span></div>
            <div>Reason: <span className="text-gray-300">{root.reason}</span></div>
          </div>
        </div>

        {/* ISI Container Diagnostic Card */}
        <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-purple-400 mb-1 flex items-center justify-between">
            <span>Scrollable ISI Container</span>
            {isi?.isScrollable ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Scrollable
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Static / Short
              </span>
            )}
          </div>
          <div className="text-sm font-mono font-bold text-white mb-2">{isi?.selector || 'None'}</div>
          {isi ? (
            <div className="text-[11px] text-gray-400 space-y-1 font-mono">
              <div>ScrollHeight: <span className="text-purple-300 font-bold">{isi.scrollHeight} px</span></div>
              <div>ClientHeight: <span className="text-gray-200">{isi.clientHeight} px</span></div>
              <div>Max ScrollTop: <span className="text-sky-300">{isi.maxScrollTop} px</span></div>
            </div>
          ) : (
            <div className="text-xs text-rose-400">No scrollable container detected</div>
          )}
        </div>

        {/* Fixed Regions Card */}
        <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-400 mb-1">
            Fixed Sections ({fixedRegions?.length || 0} items)
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {fixedRegions && fixedRegions.length > 0 ? (
              fixedRegions.map((f, idx) => (
                <div key={idx} className="text-[11px] font-mono text-gray-300 flex justify-between bg-gray-900 px-2 py-1 rounded border border-gray-800">
                  <span className="text-emerald-300">{f.selector}</span>
                  <span className="text-gray-400">{f.box?.width}x{f.box?.height} @ Y:{f.box?.y}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500">No fixed sections configured</div>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Elements Diagnostic Accordion */}
      {candidates.length > 0 && (
        <div className="bg-gray-950/40 border border-gray-800/80 rounded-xl p-3">
          <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            Evaluated Heuristic Scrollable Candidate Elements:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {candidates.slice(0, 4).map((c, i) => (
              <div key={i} className="text-[11px] font-mono bg-gray-950 p-2 rounded border border-gray-800/60 flex justify-between items-center">
                <span className="text-gray-200 truncate max-w-[200px]">{c.selector}</span>
                <span className="text-xs font-bold text-sky-400">{c.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
