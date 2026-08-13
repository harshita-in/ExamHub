import React from 'react';
import { AlertOctagon, Maximize2, ShieldAlert } from 'lucide-react';

const ProctoringOverlay = ({ 
  isFullscreenRequired, 
  onEnterFullscreen, 
  warningsCount, 
  maxWarnings = 5,
  isDisqualified,
  onGoToDashboard 
}) => {
  if (isDisqualified) {
    return (
      <div className="proctor-alert-overlay warning-pulse">
        <div className="proctor-alert-card glass-panel text-center">
          <div className="flex items-center justify-center mb-4" style={{ color: 'var(--color-danger)' }}>
            <ShieldAlert size={64} className="pulse-warning" style={{ borderRadius: '50%' }} />
          </div>
          <h2 className="auth-title" style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>
            Exam Disqualified
          </h2>
          <p className="auth-subtitle mb-4">
            You have exceeded the maximum warning limit of <strong>{maxWarnings}</strong> violations. 
            Your session has been terminated and automatically submitted as flagged for cheating.
          </p>
          <div className="warning-count-badge danger">
            Warnings: {warningsCount} / {maxWarnings}
          </div>
          <div className="mt-4">
            <button className="btn btn-primary" onClick={onGoToDashboard}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isFullscreenRequired) {
    return (
      <div className={`proctor-alert-overlay ${warningsCount > 0 ? 'warning-pulse' : ''}`}>
        <div className="proctor-alert-card glass-panel text-center">
          <div className="flex items-center justify-center mb-4" style={{ color: 'var(--color-warning)' }}>
            <AlertOctagon size={64} style={{ animation: 'bounce 2s infinite' }} />
          </div>
          <h2 className="auth-title" style={{ color: 'var(--color-warning)', marginBottom: '12px' }}>
            Fullscreen Mode Required
          </h2>
          <p className="auth-subtitle mb-4">
            To prevent cheating, this exam must be taken in fullscreen mode. 
            Leaving fullscreen or switching tabs results in a penalty warning.
          </p>
          <div className="warning-count-badge">
            Warnings: {warningsCount} / {maxWarnings}
          </div>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '24px' }}>
            Exceeding {maxWarnings} warnings will auto-submit your exam and disqualify you.
          </p>
          <div>
            <button className="btn btn-primary" onClick={onEnterFullscreen}>
              <Maximize2 size={18} /> Enter Fullscreen Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ProctoringOverlay;
