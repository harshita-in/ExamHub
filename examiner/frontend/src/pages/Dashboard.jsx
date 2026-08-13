import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Clock, ShieldAlert, Award, Calendar, 
  FileText, ClipboardList, LogOut, ChevronRight, AlertTriangle 
} from 'lucide-react';
import { fetchWithAuth } from '../config/api.js';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' or 'create' (admin only)
  
  // Admin-specific states
  const [selectedExam, setSelectedExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  
  // Create exam states
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDuration, setExamDuration] = useState(30);
  const [maxWarnings, setMaxWarnings] = useState(5);
  const [questions, setQuestions] = useState([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }
  ]);

  const navigate = useNavigate();

  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (!cachedUser) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(cachedUser));
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/exams');
      if (response.ok) {
        const data = await response.json();
        setExams(data);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleStartExam = (examId) => {
    if (window.confirm("Warning: Starting this exam will lock your browser. Exiting fullscreen or changing tabs will count as cheating warnings. Do you wish to proceed?")) {
      navigate(`/exam/${examId}`);
    }
  };

  // Admin: Fetch submissions for selected exam
  const handleViewSubmissions = async (exam) => {
    setSelectedExam(exam);
    setSelectedSubmission(null);
    try {
      const response = await fetchWithAuth(`/submissions/exam/${exam.id}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  // Admin: Fetch specific candidate details & proctor logs
  const handleViewSubmissionDetails = async (subId) => {
    try {
      const response = await fetchWithAuth(`/submissions/${subId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSubmission(data);
      }
    } catch (error) {
      console.error('Error fetching submission details:', error);
    }
  };

  // Admin: Dynamic Question Builder handlers
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    
    // Validation
    if (questions.some(q => !q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d)) {
      alert('Please fill in all question texts and options.');
      return;
    }

    try {
      const response = await fetchWithAuth('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title: examTitle,
          description: examDesc,
          duration_minutes: parseInt(examDuration),
          max_warnings: parseInt(maxWarnings),
          questions
        })
      });

      if (response.ok) {
        alert('Exam created successfully!');
        // Reset states
        setExamTitle('');
        setExamDesc('');
        setExamDuration(30);
        setMaxWarnings(5);
        setQuestions([{ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }]);
        setActiveTab('exams');
        fetchExams();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to create exam.');
      }
    } catch (error) {
      console.error('Error creating exam:', error);
      alert('Network error. Failed to save exam.');
    }
  };

  if (!user) return null;

  return (
    <div>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-logo">
          <ShieldAlert size={24} style={{ color: 'var(--color-primary)' }} />
          ExamHub
        </div>
        <div className="nav-links">
          <div className="nav-user">
            <span style={{ fontWeight: 500 }}>{user.username}</span>
            <span className="user-badge">{user.role}</span>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="dashboard-container">
        <div className="welcome-section">
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '6px' }}>
              Welcome back, {user.username}!
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {user.role === 'admin' 
                ? 'Manage security logs, review submissions, and design exams.' 
                : 'Choose an active assessment below to start. Keep proctor rules in mind.'}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="tab-container">
          {user.role === 'admin' ? (
            <>
              <button 
                className={`tab-btn ${activeTab === 'exams' ? 'active' : ''}`}
                onClick={() => { setActiveTab('exams'); setSelectedExam(null); setSelectedSubmission(null); }}
              >
                Exams & Proctor Logs
              </button>
              <button 
                className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                Create New Exam
              </button>
            </>
          ) : (
            <>
              <button 
                className={`tab-btn ${activeTab === 'exams' ? 'active' : ''}`}
                onClick={() => setActiveTab('exams')}
              >
                Available Exams
              </button>
              <button 
                className={`tab-btn ${activeTab === 'marks' ? 'active' : ''}`}
                onClick={() => setActiveTab('marks')}
              >
                My Results & Marks
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: '40px' }}>Loading panel content...</div>
        ) : (
          <>
            {/* TAB 1: Exams List (For Student OR Admin monitoring) */}
            {activeTab === 'exams' && (
              <div>
                {!selectedExam ? (
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>
                      {user.role === 'admin' ? 'Select an Exam to view Proctored Results' : 'Available Exams'}
                    </h2>
                    {exams.length === 0 ? (
                      <div className="glass-panel text-center" style={{ padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p>No exams available in the system yet.</p>
                      </div>
                    ) : (
                      <div className="exams-grid">
                        {exams.map((exam) => (
                          <div key={exam.id} className="exam-card glass-panel">
                            <div className="exam-header">
                              <h3 className="exam-title-card">{exam.title}</h3>
                              <p className="exam-desc">{exam.description || 'No description provided.'}</p>
                            </div>
                            <div>
                              <div className="exam-meta">
                                <div className="meta-item">
                                  <Clock size={15} /> {exam.duration_minutes} mins
                                </div>
                                <div className="meta-item">
                                  <ShieldAlert size={15} style={{ color: 'var(--color-warning)' }} /> Max warnings: {exam.max_warnings}
                                </div>
                              </div>
                              
                              {user.role === 'student' ? (
                                exam.submission ? (
                                  <div style={{
                                    border: '1px solid var(--border-light)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    background: exam.submission.status === 'flagged_cheating' 
                                      ? 'rgba(239, 68, 68, 0.08)' 
                                      : 'rgba(16, 185, 129, 0.08)',
                                    borderColor: exam.submission.status === 'flagged_cheating'
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : 'rgba(16, 185, 129, 0.2)'
                                  }}>
                                    <div className="flex justify-between items-center mb-4">
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Attempt Completed</span>
                                      <span style={{
                                        color: exam.submission.status === 'flagged_cheating' ? 'var(--color-danger)' : 'var(--color-success)',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase'
                                      }}>
                                        {exam.submission.status === 'flagged_cheating' ? 'Disqualified' : 'Submitted'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between font-bold" style={{ fontSize: '1.1rem' }}>
                                      <span>Score: {exam.submission.score}</span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'normal' }}>
                                        {new Date(exam.submission.submitted_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleStartExam(exam.id)}>
                                    Start Exam <ChevronRight size={16} />
                                  </button>
                                )
                              ) : (
                                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => handleViewSubmissions(exam)}>
                                  Monitor Submissions ({exam.creator_name || 'System'})
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Admin Submissions list for selected exam
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <button className="btn btn-secondary" onClick={() => { setSelectedExam(null); setSelectedSubmission(null); }}>
                        ← Back to Exam List
                      </button>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                        Monitoring: {selectedExam.title}
                      </h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: selectedSubmission ? '1.2fr 1fr' : '1fr', gap: '30px' }}>
                      {/* Left Column: Submissions Table */}
                      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Student Attempt Records</h3>
                        {submissions.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No student has attempted this exam yet.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '12px 8px' }}>Student</th>
                                <th style={{ padding: '12px 8px' }}>Status</th>
                                <th style={{ padding: '12px 8px' }}>Warnings</th>
                                <th style={{ padding: '12px 8px' }}>Score</th>
                                <th style={{ padding: '12px 8px' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {submissions.map((sub) => (
                                <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '16px 8px' }}>
                                    <div style={{ fontWeight: 600 }}>{sub.username}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub.email}</div>
                                  </td>
                                  <td style={{ padding: '16px 8px' }}>
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      background: sub.status === 'flagged_cheating' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                      color: sub.status === 'flagged_cheating' ? 'var(--color-danger)' : 'var(--color-success)'
                                    }}>
                                      {sub.status === 'flagged_cheating' ? 'Flagged/Disq' : 'Completed'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '16px 8px' }}>
                                    <span style={{ 
                                      fontWeight: 700, 
                                      color: sub.warnings_count > 0 ? 'var(--color-warning)' : 'inherit' 
                                    }}>
                                      {sub.warnings_count} / {selectedExam.max_warnings}
                                    </span>
                                  </td>
                                  <td style={{ padding: '16px 8px', fontWeight: 'bold' }}>
                                    {sub.score} / {selectedExam.questions_count}
                                  </td>
                                  <td style={{ padding: '16px 8px' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                      onClick={() => handleViewSubmissionDetails(sub.id)}
                                    >
                                      Inspect Proctor Logs
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Right Column: Detailed Proctor Violation logs for a single candidate */}
                      {selectedSubmission && (
                        <div className="glass-panel" style={{ padding: '24px' }}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Proctoring Log Detail</h3>
                            <button 
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              onClick={() => setSelectedSubmission(null)}
                            >
                              ✕ Close
                            </button>
                          </div>

                          <div className="mb-4" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div className="flex justify-between items-center mb-2">
                              <strong>Candidate:</strong> {selectedSubmission.submission.student_name}
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <strong>Exam status:</strong>
                              <span style={{ 
                                color: selectedSubmission.submission.status === 'flagged_cheating' ? 'var(--color-danger)' : 'var(--color-success)',
                                fontWeight: 'bold'
                              }}>
                                {selectedSubmission.submission.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <strong>Recorded Warnings:</strong>
                              <span style={{ fontWeight: 'bold', color: 'var(--color-warning)' }}>
                                {selectedSubmission.submission.warnings_count}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <strong>Candidate Score:</strong>
                              <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                {selectedSubmission.submission.score} / {selectedSubmission.questions.length}
                              </span>
                            </div>
                          </div>

                          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                            Security Event Timeline
                          </h4>

                          {selectedSubmission.logs.length === 0 ? (
                            <p style={{ color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Award size={18} /> No cheating flags detected! Great integrity.
                            </p>
                          ) : (
                            <div className="log-list">
                              {selectedSubmission.logs.map((log) => (
                                <div key={log.id} className="log-item alert-log">
                                  <div className="log-meta">
                                    <span className="log-type" style={{ color: 'var(--color-danger)' }}>
                                      {log.violation_type.replace('_', ' ')}
                                    </span>
                                    <span>
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                                    {log.details || 'Warning issued due to focus loss.'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Student Marks & Performance History */}
            {activeTab === 'marks' && user.role === 'student' && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>My Performance Dashboard</h2>
                
                {/* Analytics Summary */}
                {(() => {
                  const attemptedExams = exams.filter(e => e.submission);
                  const totalAttempted = attemptedExams.length;
                  const disqualifications = attemptedExams.filter(e => e.submission.status === 'flagged_cheating').length;
                  const completedExams = attemptedExams.filter(e => e.submission.status === 'completed');
                  
                  // Average percentage calculation
                  let totalAccuracy = 0;
                  completedExams.forEach(e => {
                    const qCount = e.questions_count || 1;
                    totalAccuracy += (e.submission.score / qCount) * 100;
                  });
                  const avgAccuracy = totalAttempted > 0 && completedExams.length > 0
                    ? (totalAccuracy / completedExams.length).toFixed(1)
                    : 0;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Exams Attempted</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{totalAttempted}</span>
                      </div>
                      
                      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average Score Accuracy</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{avgAccuracy}%</span>
                      </div>

                      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Disqualifications</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: disqualifications > 0 ? 'var(--color-danger)' : 'var(--text-main)' }}>
                          {disqualifications}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Performance table */}
                <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Your Exam Grade Sheet</h3>
                  {exams.filter(e => e.submission).length === 0 ? (
                    <div className="text-center" style={{ padding: '40px 0', color: 'var(--text-muted)' }}>
                      <ClipboardList size={36} style={{ marginBottom: '10px', opacity: 0.5 }} />
                      <p>You have not taken any exams yet.</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '12px 8px' }}>Exam Title</th>
                          <th style={{ padding: '12px 8px' }}>Date Taken</th>
                          <th style={{ padding: '12px 8px' }}>Warnings</th>
                          <th style={{ padding: '12px 8px' }}>Score</th>
                          <th style={{ padding: '12px 8px' }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exams.filter(e => e.submission).map((e) => (
                          <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '16px 8px', fontWeight: 600 }}>
                              {e.title}
                            </td>
                            <td style={{ padding: '16px 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                              {new Date(e.submission.submitted_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '16px 8px', fontWeight: 700, color: e.submission.warnings_count > 0 ? 'var(--color-warning)' : 'inherit' }}>
                              {e.submission.warnings_count} / {e.max_warnings}
                            </td>
                            <td style={{ padding: '16px 8px', fontWeight: 'bold' }}>
                              {e.submission.status === 'flagged_cheating' ? '-' : `${e.submission.score} / ${e.questions_count}`}
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: e.submission.status === 'flagged_cheating' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(118, 159, 205, 0.15)',
                                color: e.submission.status === 'flagged_cheating' ? 'var(--color-danger)' : 'var(--color-primary)'
                              }}>
                                {e.submission.status === 'flagged_cheating' ? 'Disqualified (Cheating)' : 'Completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Create Exam Form (Admin only) */}
            {activeTab === 'create' && user.role === 'admin' && (
              <div className="glass-panel" style={{ padding: '40px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>
                  Design New Assessment
                </h2>
                <form onSubmit={handleCreateExam} className="admin-panel">
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Exam Title</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. JavaScript Core Evaluation"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Duration (Minutes)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        value={examDuration}
                        onChange={(e) => setExamDuration(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Warnings Allowed</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        max="10"
                        value={maxWarnings}
                        onChange={(e) => setMaxWarnings(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Exam Description / Short Instructions</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Specify topics covered or constraints..."
                      rows="3"
                      value={examDesc}
                      onChange={(e) => setExamDesc(e.target.value)}
                    />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '20px 0' }} />

                  <div className="flex justify-between items-center mb-4">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Questions Builder</h3>
                    <button type="button" className="btn btn-secondary" onClick={handleAddQuestion}>
                      <Plus size={16} /> Add Question
                    </button>
                  </div>

                  {questions.map((q, idx) => (
                    <div key={idx} className="question-builder-card glass-panel">
                      <button 
                        type="button" 
                        className="delete-q-btn" 
                        onClick={() => handleRemoveQuestion(idx)}
                        disabled={questions.length === 1}
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="form-group" style={{ paddingRight: '40px' }}>
                        <label className="form-label">Question {idx + 1}</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="What is the output of typeof null?"
                          value={q.question_text}
                          onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                          <label className="form-label">Option A</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Option A text"
                            value={q.option_a}
                            onChange={(e) => handleQuestionChange(idx, 'option_a', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Option B</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Option B text"
                            value={q.option_b}
                            onChange={(e) => handleQuestionChange(idx, 'option_b', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Option C</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Option C text"
                            value={q.option_c}
                            onChange={(e) => handleQuestionChange(idx, 'option_c', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Option D</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Option D text"
                            value={q.option_d}
                            onChange={(e) => handleQuestionChange(idx, 'option_d', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ maxWidth: '200px' }}>
                        <label className="form-label">Correct Option</label>
                        <select
                          className="form-select"
                          value={q.correct_option}
                          onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Publish Exam
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
