import React from 'react';
import { Sliders } from 'lucide-react';

export default function ConfigProfilesPanel({ profiles, selectedProfile, config, onChangeConfig, onSelectProfile }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-sky-400" />
          2. Banner Profile & Dimension Configuration
        </h2>
      </div>

      {/* Preset Profiles Selector */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-400 mb-2">Preset Profile</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {profiles.map((p) => {
            const isSelected = selectedProfile === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProfile(p)}
                className={`px-3 py-2 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow'
                    : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="text-xs font-bold text-white">{p.name}</div>
                <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                  {p.width && p.height ? `${p.width} × ${p.height} px` : 'Custom'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimension & Selector Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Expected Width (CSS px)</label>
          <input
            type="number"
            value={config.expectedWidth}
            onChange={(e) => onChangeConfig({ expectedWidth: Number(e.target.value) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Expected Height (CSS px)</label>
          <input
            type="number"
            value={config.expectedHeight}
            onChange={(e) => onChangeConfig({ expectedHeight: Number(e.target.value) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Device Scale Factor (Retina HD)</label>
          <select
            value={config.deviceScaleFactor}
            onChange={(e) => onChangeConfig({ deviceScaleFactor: Number(e.target.value) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          >
            <option value={1}>1x (Standard 72DPI)</option>
            <option value={2}>2x (Retina Crisp HD)</option>
            <option value={3}>3x (Ultra HD)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Scroll Overlap (px)</label>
          <input
            type="number"
            value={config.overlap}
            onChange={(e) => onChangeConfig({ overlap: Number(e.target.value) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Animation Delay (ms)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={config.animationDelay ?? 2000}
            onChange={(e) => onChangeConfig({ animationDelay: Number(e.target.value) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Selectors Configuration */}
      <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Root Banner Selector</label>
          <input
            type="text"
            value={config.rootSelector || ''}
            placeholder="Auto-detect or #banner"
            onChange={(e) => onChangeConfig({ rootSelector: e.target.value })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Fixed Section Selectors (comma sep)</label>
          <input
            type="text"
            value={Array.isArray(config.fixedSelectors) ? config.fixedSelectors.join(',') : config.fixedSelectors || ''}
            placeholder="#header, #body-copy"
            onChange={(e) => onChangeConfig({ fixedSelectors: e.target.value.split(',').map(s => s.trim()) })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Nested Scrollable ISI Selector</label>
          <input
            type="text"
            value={config.isiSelector || ''}
            placeholder="Auto-detect or #isi-container"
            onChange={(e) => onChangeConfig({ isiSelector: e.target.value })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-purple-300 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>
    </div>
  );
}
