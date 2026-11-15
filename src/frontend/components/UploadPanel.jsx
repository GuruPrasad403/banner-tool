import React, { useState } from 'react';
import { UploadCloud, FileCode, Archive, FolderSearch, ArrowRight, Loader2 } from 'lucide-react';

export default function UploadPanel({ onJobCreated, isProcessing }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'local'
  const [file, setFile] = useState(null);
  const [localPath, setLocalPath] = useState('./fixtures/sample-banner-300x250/index.html');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (activeTab === 'upload') {
        if (!file) {
          throw new Error('Please select an HTML or ZIP file to upload.');
        }
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/jobs', {
          method: 'POST',
          body: formData
        });
      } else {
        if (!localPath.trim()) {
          throw new Error('Please enter a valid local file path.');
        }
        res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localPath: localPath.trim() })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize banner validation job.');
      }

      onJobCreated(data.job);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-sky-400" />
          1. Upload or Select Banner Input
        </h2>
        
        <div className="flex space-x-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'upload' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            File Upload (HTML/ZIP)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'local' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Local Path / Fixtures
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-mono">
          🚨 {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {activeTab === 'upload' ? (
          <div className="border-2 border-dashed border-gray-800 hover:border-sky-500/50 transition-colors rounded-xl p-6 text-center cursor-pointer bg-gray-950/40 relative">
            <input
              type="file"
              accept=".html,.htm,.zip"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex justify-center gap-3 mb-2 text-gray-500">
              <FileCode className="w-8 h-8 text-sky-400" />
              <Archive className="w-8 h-8 text-purple-400" />
            </div>
            {file ? (
              <div className="text-sm font-medium text-sky-300">
                Selected: <span className="font-mono text-white">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-200">Drag & drop your HTML file or ZIP package here</p>
                <p className="text-xs text-gray-400 mt-1">Supports single .html or .zip containing HTML, CSS, JS & images</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-300">Local File Path or Workspace Fixture</label>
            <div className="relative">
              <FolderSearch className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="./fixtures/sample-banner-300x250/index.html"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocalPath('./fixtures/sample-banner-dynamic-300x250/index.html')}
                className="text-[11px] px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 rounded font-mono border border-indigo-800/60 font-semibold"
              >
                ★ Nexicor Dynamic (300x250)
              </button>
              <button
                type="button"
                onClick={() => setLocalPath('./fixtures/sample-banner-300x250/index.html')}
                className="text-[11px] px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-mono border border-gray-700"
              >
                Sample 300x250 Banner
              </button>
              <button
                type="button"
                onClick={() => setLocalPath('./fixtures/sample-banner-invalid/index.html')}
                className="text-[11px] px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-mono border border-gray-700"
              >
                Sample 305x250 Invalid Banner
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading || isProcessing}
            className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing Job...
              </>
            ) : (
              <>
                Initialize Job & Selectors
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
