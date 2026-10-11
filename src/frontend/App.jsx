import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsOverview from './components/StatsOverview';
import UploadPanel from './components/UploadPanel';
import ConfigProfilesPanel from './components/ConfigProfilesPanel';
import DetectionPreview from './components/DetectionPreview';
import ScreenshotGallery from './components/ScreenshotGallery';
import ValidationReportView from './components/ValidationReportView';

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('mobile-small');
  const [activeJob, setActiveJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalJobs: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    totalScreenshots: 0
  });

  const [config, setConfig] = useState({
    expectedWidth: 300,
    expectedHeight: 250,
    deviceScaleFactor: 2,
    overlap: 10,
    rootSelector: '#banner',
    fixedSelectors: ['#header', '#body-copy'],
    isiSelector: '#isi-container'
  });

  const [urls, setUrls] = useState(null);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
    fetchJobsHistory();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    }
  };

  const fetchJobsHistory = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.jobs) {
        const jobs = data.jobs;
        setStats({
          totalJobs: jobs.length,
          passed: jobs.filter(j => j.validationStatus === 'passed').length,
          failed: jobs.filter(j => j.validationStatus === 'failed').length,
          warnings: jobs.filter(j => j.validationStatus === 'passed_with_warnings').length,
          totalScreenshots: jobs.reduce((acc, j) => acc + (j.screenshotsCount || 0), 0)
        });
      }
    } catch (err) {
      console.error('Failed to fetch jobs history:', err);
    }
  };

  const handleSelectProfile = (p) => {
    setSelectedProfileId(p.id);
    if (p.width && p.height) {
      setConfig((prev) => ({
        ...prev,
        expectedWidth: p.width,
        expectedHeight: p.height,
        rootSelector: p.rootSelector || prev.rootSelector,
        fixedSelectors: p.fixedSelectors || prev.fixedSelectors,
        isiSelector: p.isiSelector || prev.isiSelector
      }));
    }
  };

  const handleJobCreated = async (job) => {
    setActiveJob(job);
    setIsProcessing(true);

    try {
      // Trigger validation and section detection for created job
      const res = await fetch(`/api/jobs/${job.jobId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await res.json();
      if (data.success) {
        setActiveJob((prev) => ({
          ...prev,
          detectionData: data.detectionData,
          validationReport: data.validationReport
        }));

        if (data.detectionData) {
          setConfig((prev) => ({
            ...prev,
            rootSelector: data.detectionData.root?.selector || prev.rootSelector,
            isiSelector: data.detectionData.isi?.selector || prev.isiSelector
          }));
        }
      }
    } catch (err) {
      console.error('Error validating job:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const [captureError, setCaptureError] = useState(null);

  const handleValidateAndCapture = async () => {
    if (!activeJob) return;
    setIsProcessing(true);
    setCaptureError(null);

    try {
      const res = await fetch(`/api/jobs/${activeJob.jobId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveJob((prev) => ({
          ...prev,
          scrollResult: data.scrollResult,
          validationReport: data.report
        }));

        // Fetch URLs for screenshot gallery & exports
        const shotsRes = await fetch(`/api/jobs/${activeJob.jobId}/screenshots`);
        const shotsData = await shotsRes.json();
        setUrls(shotsData);

        fetchJobsHistory();
      } else {
        setCaptureError(data.error || 'Failed to capture screenshots.');
      }
    } catch (err) {
      console.error('Error during screenshot capture:', err);
      setCaptureError(err.message || 'Error executing screenshot capture process.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Metrics Overview */}
        <StatsOverview stats={stats} />

        {/* 1. Upload Panel */}
        <UploadPanel onJobCreated={handleJobCreated} isProcessing={isProcessing} />

        {/* 2. Configuration & Profiles */}
        <ConfigProfilesPanel
          profiles={profiles}
          selectedProfile={selectedProfileId}
          config={config}
          onChangeConfig={(newCfg) => setConfig((prev) => ({ ...prev, ...newCfg }))}
          onSelectProfile={handleSelectProfile}
        />

        {/* 3. Section Detection Preview */}
        {activeJob && activeJob.detectionData && (
          <DetectionPreview
            detectionData={activeJob.detectionData}
            onValidateAndCapture={handleValidateAndCapture}
            isRunning={isProcessing}
            captureError={captureError}
          />
        )}

        {/* 4. Generated Screenshot Gallery */}
        {activeJob && activeJob.scrollResult && (
          <ScreenshotGallery
            scrollResult={activeJob.scrollResult}
            jobId={activeJob.jobId}
            urls={urls}
          />
        )}

        {/* 5. Validation Rules Inspector */}
        {activeJob && activeJob.validationReport && (
          <ValidationReportView
            report={activeJob.validationReport}
            jobId={activeJob.jobId}
            jsonReportUrl={urls?.jsonReportUrl}
          />
        )}
      </main>

      <footer className="border-t border-gray-800 bg-gray-950 py-4 text-center text-xs text-gray-500 font-mono">
        XYZ Banner Validator & Screenshot Generator — Node.js, Express, Puppeteer, React & Tailwind CSS
      </footer>
    </div>
  );
}
