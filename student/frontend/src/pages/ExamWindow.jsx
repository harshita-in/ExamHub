import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ShieldAlert, Award, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { fetchWithAuth } from '../config/api.js';
import ProctoringOverlay from '../components/ProctoringOverlay.jsx';

const ExamWindow = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  // Proctoring States
  const [submissionId, setSubmissionId] = useState(null);
  const [warningsCount, setWarningsCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [error, setError] = useState('');

  const submissionIdRef = useRef(null);
  const isDisqualifiedRef = useRef(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerRef = useRef(null);

  // Guard flag to prevent double violations logs in React 18 strict mode
  const logCooldown = useRef(false);

  useEffect(() => {
    // 1. Initial Load: Start Exam Session & Fetch details
    initExamSession();

    // 2. Setup Anti-Cheating Event Listeners
    setupProctorListeners();

    return () => {
      cleanupProctorListeners();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initExamSession = async () => {
    try {
      // Create or resume backend submission session
      const startRes = await fetchWithAuth('/submissions/start', {
        method: 'POST',
        body: JSON.stringify({ exam_id: id })
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        throw new Error(startData.error || 'Failed to start exam session.');
      }

      setSubmissionId(startData.submissionId);
      submissionIdRef.current = startData.submissionId;
      setWarningsCount(startData.warningsCount);

      // Load exam details (questions correct answers are filtered out by server for students)
      const detailsRes = await fetchWithAuth(`/exams/${id}`);
      const detailsData = await detailsRes.json();

      if (!detailsRes.ok) {
        throw new Error(detailsData.error || 'Failed to fetch exam details.');
      }

      setExam(detailsData.exam);
      setQuestions(detailsData.questions);

      // Initialize Timer (Check if resuming, but for simplicity set fresh duration)
      setTimeLeft(detailsData.exam.duration_minutes * 60);
      startTimer();

      // Check if warnings already exceeded on restore
      if (startData.warningsCount >= detailsData.exam.max_warnings) {
        setIsDisqualified(true);
        isDisqualifiedRef.current = true;
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Timer engine
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const playWarningSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (delay, frequency, duration) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sawtooth'; // Sharp, piercing alarm sound
        oscillator.frequency.value = frequency;
        
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime + delay);
        oscillator.stop(audioCtx.currentTime + delay + duration);
      };
      
      // High-pitched warning double beep
      playBeep(0, 880, 0.15); // A5 note
      playBeep(0.2, 880, 0.25);
    } catch (err) {
      console.error('AudioContext error playing sound:', err);
    }
  };

  // Proctor Violation Logger
  const triggerViolation = async (type, details) => {
    if (!submissionIdRef.current || isDisqualifiedRef.current) return;

    // Concurrency control to prevent duplicated trigger logs within millisecond intervals
    if (logCooldown.current) return;
    logCooldown.current = true;
    setTimeout(() => { logCooldown.current = false; }, 1000);

    // Play synthesized alarm sound
    playWarningSound();

    try {
      const response = await fetchWithAuth('/submissions/violation', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionIdRef.current,
          violation_type: type,
          details
        })
      });

      if (response.ok) {
        const data = await response.json();
        setWarningsCount(data.warningsCount);

        if (data.disqualified) {
          setIsDisqualified(true);
          isDisqualifiedRef.current = true;
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    } catch (err) {
      console.error('Failed to log proctoring violation:', err);
    }
  };

  // Setup security event listeners
  const setupProctorListeners = () => {
    // 1. Fullscreen change listener
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // 2. Tab switch / visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Window focus loss listener (Disabled to prevent OS-level notifications from triggering false warnings)
    // window.addEventListener('blur', handleWindowBlur);

    // 4. Block copy, cut, paste, & context menu
    document.addEventListener('contextmenu', blockDefaultEvent);
    document.addEventListener('copy', blockDefaultEvent);
    document.addEventListener('cut', blockDefaultEvent);
    document.addEventListener('paste', blockDefaultEvent);

    // 5. Block Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyDown);
  };

  const cleanupProctorListeners = () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    // window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('contextmenu', blockDefaultEvent);
    document.removeEventListener('copy', blockDefaultEvent);
    document.removeEventListener('cut', blockDefaultEvent);
    document.removeEventListener('paste', blockDefaultEvent);
    document.removeEventListener('keydown', handleKeyDown);
  };

  const blockDefaultEvent = (e) => {
    e.preventDefault();
  };

  // Fullscreen Handler
  const handleFullscreenChange = () => {
    const isFull = !!document.fullscreenElement;
    setIsFullscreen(isFull);

    if (!isFull && !isDisqualifiedRef.current) {
      triggerViolation('exit_fullscreen', 'Student exited fullscreen mode.');
    }
  };

  const enterFullscreen = () => {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Failed to enter fullscreen mode:', err);
      });
    }
  };

  // Visibility (Tab Change) Handler
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && !isDisqualifiedRef.current) {
      triggerViolation('tab_switch', 'Student switched tabs or minimized browser.');
    }
  };

  // Focus blur Handler (Disabled to prevent background system popups/notifications from penalizing the candidate)
  /*
  const handleWindowBlur = () => {
    if (!isDisqualified) {
      triggerViolation('window_blur', 'Window lost focus. (Switched to another application or monitor)');
    }
  };
  */

  // Block forbidden keyboard keys
  const handleKeyDown = (e) => {
    // Block: F12, PrintScreen, Alt, Ctrl
    const forbiddenKeys = ['F12', 'PrintScreen', 'Alt'];
    
    // Block copy paste keys (Ctrl+C, Ctrl+V, Ctrl+X) and save (Ctrl+S), print (Ctrl+P), DevTools (Ctrl+Shift+I)
    if (e.ctrlKey) {
      const char = e.key.toLowerCase();
      if (char === 'c' || char === 'v' || char === 'x' || char === 's' || char === 'p' || char === 'u') {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation('keyboard_shortcut', `Blocked key combination: Ctrl + ${char.toUpperCase()}`);
        return false;
      }
    }

    if (e.shiftKey && e.ctrlKey) {
      const char = e.key.toLowerCase();
      if (char === 'i' || char === 'j' || char === 'c') {
        e.preventDefault();
        e.stopPropagation();
        triggerViolation('keyboard_shortcut', `Blocked DevTools combination: Ctrl + Shift + ${char.toUpperCase()}`);
        return false;
      }
    }

    if (forbiddenKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      triggerViolation('keyboard_shortcut', `Blocked standard functional key: ${e.key}`);
      return false;
    }
  };

  // Selection Answer Handler
  const handleSelectOption = (questionId, option) => {
    setAnswers({
      ...answers,
      [questionId]: option
    });
  };

  // Submit Logic
  const handleExamSubmit = async (isTimeUp = false, flagged = false) => {
    if (!submissionId) return;

    if (!isTimeUp && !flagged) {
      const confirmSubmit = window.confirm("Are you sure you want to submit your exam? You cannot modify your answers afterward.");
      if (!confirmSubmit) return;
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }

    try {
      const response = await fetchWithAuth('/submissions/submit', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          answers,
          is_flagged: flagged
        })
      });

      if (response.ok) {
        alert(isTimeUp ? 'Time is up! Exam submitted successfully.' : 'Exam submitted successfully.');
        navigate('/dashboard');
      } else {
        alert('Failed to submit exam. Contact Admin.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Network error submitting. Redirecting to dashboard.');
      navigate('/dashboard');
    }
  };

  const handleAutoSubmit = () => {
    handleExamSubmit(true, false);
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return <div className="text-center" style={{ padding: '80px 20px' }}>Initializing secure exam window...</div>;
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel text-center">
          <h2 style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>Initialization Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary mt-4" onClick={handleGoToDashboard}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const isQuestionAnswered = (qId) => !!answers[qId];

  return (
    <div className="exam-layout" style={{ userSelect: 'none' }}>
      {/* Absolute overlay warnings */}
      <ProctoringOverlay 
        isFullscreenRequired={!isFullscreen && !isDisqualified}
        onEnterFullscreen={enterFullscreen}
        warningsCount={warningsCount}
        maxWarnings={exam?.max_warnings}
        isDisqualified={isDisqualified}
        onGoToDashboard={handleGoToDashboard}
      />

      {/* Main Exam Work Area */}
      <section className="exam-main">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
            <div>
              <span className="user-badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-accent)', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                Exam Session Active
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '8px' }}>{exam?.title}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="warning-count-badge" style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem' }}>
                <ShieldAlert size={14} /> Warnings: {warningsCount} / {exam?.max_warnings}
              </div>
            </div>
          </div>

          {/* Question Box */}
          {currentQuestion && (
            <div className="question-box">
              <div className="flex items-center justify-between mb-4">
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                  Question {currentIdx + 1} of {questions.length}
                </span>
              </div>
              <p className="question-text">{currentQuestion.question_text}</p>
              
              <div className="options-list">
                {['a', 'b', 'c', 'd'].map((optKey) => {
                  const optionLabel = optKey.toUpperCase();
                  const optionText = currentQuestion[`option_${optKey}`];
                  const isSelected = answers[currentQuestion.id] === optionLabel;

                  return (
                    <div 
                      key={optKey} 
                      className={`option-wrapper ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectOption(currentQuestion.id, optionLabel)}
                    >
                      <div className="option-indicator">{optionLabel}</div>
                      <span className="option-text">{optionText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '40px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
            disabled={currentIdx === 0}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIdx === questions.length - 1}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Exam Information Sidebar */}
      <aside className="exam-sidebar">
        <div>
          {/* Clock Timer */}
          <div className="glass-panel text-center" style={{ padding: '20px', marginBottom: '30px' }}>
            <div className="flex items-center justify-center gap-2 mb-2" style={{ color: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
              <Clock size={20} className={timeLeft < 60 ? 'pulse-warning' : ''} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, uppercase: 'true' }}>Time Remaining</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: timeLeft < 60 ? 'var(--color-danger)' : 'var(--text-main)' }}>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Navigation Matrix */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-muted)' }}>
              Question Grid
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {questions.map((q, idx) => {
                const isSelected = idx === currentIdx;
                const isAnswered = isQuestionAnswered(q.id);

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                      background: isAnswered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: isAnswered ? 'var(--color-success)' : 'var(--text-main)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit Panel */}
        <div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleExamSubmit(false, false)}>
            <Check size={18} /> Submit Assessment
          </button>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Submit early only if you have finished all questions.
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ExamWindow;
