import React from 'react';
import { ShieldCheck, Camera, Layers, FileCode2 } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              XYZ Banner Validator
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">v1.0 Pro</span>
            </h1>
            <p className="text-xs text-gray-400">Automated Dimension Validation & Nested ISI Screenshot Generator</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-6 text-xs text-gray-400 font-mono">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Frame Accurate</span>
            <span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-sky-400" /> Nested Scroll</span>
            <span className="flex items-center gap-1.5"><FileCode2 className="w-4 h-4 text-purple-400" /> ES Modules</span>
          </div>
        </div>
      </div>
    </header>
  );
}
