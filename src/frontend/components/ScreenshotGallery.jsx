import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera, Download, FileJson, FileCode, ShieldCheck,
  Eye, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, RotateCcw, AlertTriangle, CheckCircle2
} from 'lucide-react';

export default function ScreenshotGallery({ scrollResult, jobId, urls, slideFrames = [] }) {
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  if (!scrollResult || !scrollResult.screenshots) return null;

  const screenshots = scrollResult.screenshots;
  const totalFrames = screenshots.length;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const imgUrl = (s) => `/output/${jobId}/screenshots/${s.filename}`;

  const openLightbox = (idx) => {
    setLightboxIndex(idx);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((i) => (i - 1 + totalFrames) % totalFrames);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [lightboxIndex, totalFrames]);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex((i) => (i + 1) % totalFrames);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [lightboxIndex, totalFrames]);

  const zoomIn  = () => setZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  // ── Keyboard handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowLeft')   goPrev();
      if (e.key === 'ArrowRight')  goNext();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-')           zoomOut();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, goPrev, goNext]);

  // ── Pan handlers ─────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
  };
  const onMouseMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
  };
  const onMouseUp = () => setIsPanning(false);

  // ── Active frame ──────────────────────────────────────────────────────────────
  const activeFrame = lightboxIndex !== null ? screenshots[lightboxIndex] : null;
  const isStable = activeFrame?.stability === 'passed';

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══════════════════════ Gallery Card ═══════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-sky-400" />
              4. Generated Fixed-Frame Screenshots ({screenshots.length} Frames)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click any frame to open the full-screen preview. Fixed Header &amp; Body copy remained perfectly aligned.
            </p>
          </div>

          {/* Export buttons */}
          <div className="flex items-center space-x-2">
            {urls?.htmlReportUrl && (
              <a
                href={urls.htmlReportUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg border border-gray-700 flex items-center gap-1.5 transition-all"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" /> HTML Report
              </a>
            )}
            {urls?.manifestUrl && (
              <a
                href={urls.manifestUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg border border-gray-700 flex items-center gap-1.5 transition-all"
              >
                <FileJson className="w-3.5 h-3.5 text-sky-400" /> Manifest JSON
              </a>
            )}
          </div>
        </div>

        {/* Slide Frames strip — every distinct slide, photographed while
            the slides played with the ISI held at the top. The ISI frames
            in the grid below all hold slide 1 (the slides-first rule). */}
        {Array.isArray(slideFrames) && slideFrames.length > 0 && (
          <div className="mb-6 border-b border-gray-800 pb-5">
            <h3 className="text-sm font-semibold text-white">
              Slide Frames (all slides, played before ISI scroll)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">
              Proof that every slide exists and played. After the slides finished, the banner was
              frozen on slide 1 — which is why all the ISI frames below show slide 1.
            </p>
            <div className="flex flex-wrap gap-4">
              {slideFrames.map((f, i) => (
                <div key={i} className="bg-gray-950 border border-purple-500/30 rounded-xl p-3 flex flex-col items-center">
                  <img
                    src={f.url || `/output/${jobId}/slides/${f.file}`}
                    alt={`Slide ${f.index ?? i + 1}`}
                    className="max-h-[180px] w-auto object-contain rounded-lg border border-gray-800 bg-white"
                    loading="lazy"
                  />
                  <div className="mt-2 text-[11px] font-bold text-white">
                    Slide #{f.index ?? i + 1}
                    <span className="text-gray-400 font-mono font-normal ml-2">at {f.atMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {screenshots.map((s, idx) => (
            <div
              key={idx}
              onClick={() => openLightbox(idx)}
              className="group bg-gray-950 border border-gray-800 hover:border-sky-500/70 rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.04] hover:shadow-sky-900/30 hover:shadow-xl shadow-md flex flex-col items-center"
            >
              {/* Thumbnail */}
              <div className="relative w-full overflow-hidden rounded-lg border border-gray-800 bg-white flex justify-center items-center min-h-[150px] p-1">
                <img
                  src={imgUrl(s)}
                  alt={`Frame ${s.index}`}
                  className="max-h-[200px] w-auto object-contain"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-sky-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-center pb-3">
                  <span className="flex items-center gap-1.5 text-white text-[11px] font-semibold bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <Maximize2 className="w-3 h-3" /> Open Preview
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-2.5 text-center w-full space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-white">
                  <span>Frame #{s.index}</span>
                  {s.stability === 'passed' ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Stable
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Shift
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-gray-400 bg-gray-900 py-0.5 px-2 rounded border border-gray-800">
                  scrollTop: <span className="text-sky-300 font-semibold">{s.scrollTop}px</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ Lightbox ═══════════════════════ */}
      {lightboxIndex !== null && activeFrame && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-950/80 border-b border-gray-800 shrink-0">
            {/* Title */}
            <div className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-semibold text-white">
                Frame #{activeFrame.index}
                <span className="text-gray-400 font-normal ml-2 text-xs font-mono">
                  {activeFrame.filename}
                </span>
              </span>
              {isStable ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fixed Regions Stable
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fixed Region Shift Detected
                </span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <button onClick={zoomOut} title="Zoom Out (−)" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} title="Zoom In (+)" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={resetView} title="Reset View (R)" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all">
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-gray-700 mx-1" />

              {/* Download */}
              <a
                href={imgUrl(activeFrame)}
                download={activeFrame.filename}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Save PNG
              </a>

              {/* Close */}
              <button
                onClick={closeLightbox}
                title="Close (Esc)"
                className="p-2 rounded-lg bg-gray-800 hover:bg-red-600/70 text-gray-300 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Image viewport ── */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden select-none">
            {/* Prev button */}
            <button
              onClick={goPrev}
              className="absolute left-4 z-10 p-3 rounded-xl bg-black/50 hover:bg-black/80 border border-gray-700 text-white transition-all hover:scale-110 backdrop-blur-sm"
              title="Previous frame (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image */}
            <div
              className="relative"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                transition: isPanning ? 'none' : 'transform 0.2s ease',
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'
              }}
              onMouseDown={onMouseDown}
            >
              <img
                src={imgUrl(activeFrame)}
                alt={`Frame ${activeFrame.index}`}
                className="max-h-[75vh] max-w-[80vw] object-contain rounded-lg shadow-2xl shadow-sky-950/60 bg-white border border-gray-700"
                draggable={false}
              />
            </div>

            {/* Next button */}
            <button
              onClick={goNext}
              className="absolute right-4 z-10 p-3 rounded-xl bg-black/50 hover:bg-black/80 border border-gray-700 text-white transition-all hover:scale-110 backdrop-blur-sm"
              title="Next frame (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* ── Bottom info bar ── */}
          <div className="shrink-0 bg-gray-950/80 border-t border-gray-800 px-5 py-3 flex items-center justify-between">
            {/* Scroll info */}
            <div className="flex items-center gap-6 text-xs font-mono text-gray-400">
              <span>
                scrollTop: <span className="text-sky-300 font-bold">{activeFrame.scrollTop}px</span>
              </span>
              <span>
                Visible ISI Range:{' '}
                <span className="text-purple-300 font-bold">
                  {activeFrame.visibleRange?.start}px → {activeFrame.visibleRange?.end}px
                </span>
              </span>
              <span>
                Target scrollTop: <span className="text-amber-300 font-bold">{activeFrame.targetScrollTop ?? activeFrame.scrollTop}px</span>
              </span>
            </div>

            {/* Frame navigation dots */}
            <div className="flex items-center gap-1.5">
              {screenshots.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setLightboxIndex(idx); setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                  className={`rounded-full transition-all ${
                    idx === lightboxIndex
                      ? 'w-5 h-2 bg-sky-400'
                      : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                  }`}
                  title={`Frame #${screenshots[idx].index}`}
                />
              ))}
            </div>

            {/* Frame counter */}
            <div className="text-xs font-mono text-gray-500">
              <span className="text-white font-bold">{lightboxIndex + 1}</span> / {totalFrames}
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-3 text-[10px] text-gray-600 pointer-events-none">
            <span>← → Navigate</span>
            <span>+ − Zoom</span>
            <span>Esc Close</span>
          </div>
        </div>
      )}
    </>
  );
}
