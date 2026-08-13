import { query } from '../config/db.js';

export const startSubmission = async (req, res) => {
  const { exam_id } = req.body;
  const user_id = req.user.id;

  if (!exam_id) {
    return res.status(400).json({ error: 'Exam ID is required.' });
  }

  try {
    // 1. Check if already submitted or active
    const existing = await query.get(
      'SELECT * FROM submissions WHERE exam_id = ? AND user_id = ?',
      [exam_id, user_id]
    );

    if (existing) {
      if (existing.status === 'completed' || existing.status === 'flagged_cheating') {
        return res.status(400).json({ error: 'You have already submitted this exam.', submission: existing });
      }
      // If it exists and is 'active', let them resume it
      return res.json({
        message: 'Resuming active exam session.',
        submissionId: existing.id,
        warningsCount: existing.warnings_count
      });
    }

    // 2. Create new active submission
    const result = await query.run(
      "INSERT INTO submissions (exam_id, user_id, answers, score, warnings_count, status) VALUES (?, ?, '{}', 0, 0, 'active')",
      [exam_id, user_id]
    );

    return res.status(201).json({
      message: 'Exam session started.',
      submissionId: result.id,
      warningsCount: 0
    });
  } catch (error) {
    console.error('Error starting submission:', error);
    return res.status(500).json({ error: 'Failed to start exam session.' });
  }
};

export const logViolation = async (req, res) => {
  const { submission_id, violation_type, details } = req.body;
  const user_id = req.user.id;

  if (!submission_id || !violation_type) {
    return res.status(400).json({ error: 'Submission ID and violation type are required.' });
  }

  try {
    // Verify ownership and status
    const submission = await query.get(
      'SELECT s.*, e.max_warnings FROM submissions s JOIN exams e ON s.exam_id = e.id WHERE s.id = ? AND s.user_id = ?',
      [submission_id, user_id]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Active exam session not found.' });
    }

    if (submission.status !== 'active') {
      return res.status(400).json({ error: 'Exam is already submitted or closed.' });
    }

    // Log the event
    await query.run(
      'INSERT INTO proctor_logs (submission_id, violation_type, details) VALUES (?, ?, ?)',
      [submission_id, violation_type, details || '']
    );

    // Increment warnings
    const newWarningsCount = submission.warnings_count + 1;
    let newStatus = 'active';

    if (newWarningsCount >= submission.max_warnings) {
      // Disqualify and auto-submit
      newStatus = 'flagged_cheating';
      await query.run(
        'UPDATE submissions SET warnings_count = ?, status = ? WHERE id = ?',
        [newWarningsCount, newStatus, submission_id]
      );
      
      return res.json({
        message: 'Exceeded maximum warnings. Student is disqualified.',
        warningsCount: newWarningsCount,
        status: newStatus,
        disqualified: true
      });
    }

    await query.run(
      'UPDATE submissions SET warnings_count = ? WHERE id = ?',
      [newWarningsCount, submission_id]
    );

    return res.json({
      message: 'Violation recorded.',
      warningsCount: newWarningsCount,
      status: newStatus,
      disqualified: false
    });
  } catch (error) {
    console.error('Error logging violation:', error);
    return res.status(500).json({ error: 'Failed to record proctor warning.' });
  }
};

export const submitExam = async (req, res) => {
  const { submission_id, answers, is_flagged } = req.body;
  const user_id = req.user.id;

  if (!submission_id || !answers) {
    return res.status(400).json({ error: 'Submission ID and answers are required.' });
  }

  try {
    // 1. Fetch submission and exam questions
    const submission = await query.get(
      'SELECT * FROM submissions WHERE id = ? AND user_id = ?',
      [submission_id, user_id]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Exam submission not found.' });
    }

    if (submission.status === 'completed' || submission.status === 'flagged_cheating') {
      return res.status(400).json({ error: 'Exam has already been submitted.' });
    }

    const questions = await query.all(
      'SELECT id, correct_option FROM questions WHERE exam_id = ?',
      [submission.exam_id]
    );

    // 2. Grade responses
    let score = 0;
    questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (studentAnswer && studentAnswer.toUpperCase() === q.correct_option.toUpperCase()) {
        score++;
      }
    });

    const status = (is_flagged || submission.status === 'flagged_cheating') ? 'flagged_cheating' : 'completed';

    // 3. Update DB
    await query.run(
      'UPDATE submissions SET answers = ?, score = ?, status = ? WHERE id = ?',
      [JSON.stringify(answers), score, status, submission_id]
    );

    return res.json({
      message: 'Exam submitted successfully.',
      score,
      totalQuestions: questions.length,
      status
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    return res.status(500).json({ error: 'Failed to submit exam.' });
  }
};

export const getExamSubmissions = async (req, res) => {
  const { examId } = req.params;

  try {
    // Retrieve all submissions for this exam
    const submissions = await query.all(
      `SELECT s.*, u.username, u.email 
       FROM submissions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.exam_id = ?`,
      [examId]
    );

    // Attach detailed violation logs to each submission
    const enrichedSubmissions = [];
    for (const sub of submissions) {
      const logs = await query.all(
        'SELECT * FROM proctor_logs WHERE submission_id = ? ORDER BY timestamp DESC',
        [sub.id]
      );
      enrichedSubmissions.push({
        ...sub,
        answers: JSON.parse(sub.answers),
        logs
      });
    }

    return res.json(enrichedSubmissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ error: 'Failed to retrieve exam submissions.' });
  }
};

export const getSubmissionDetails = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  const user_role = req.user.role;

  try {
    const submission = await query.get(
      `SELECT s.*, e.title as exam_title, e.duration_minutes, u.username as student_name
       FROM submissions s
       JOIN exams e ON s.exam_id = e.id
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // Access control: Students can only view their own submission
    if (user_role === 'student' && submission.user_id !== user_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch questions and logs
    const questions = await query.all('SELECT * FROM questions WHERE exam_id = ?', [submission.exam_id]);
    const logs = await query.all('SELECT * FROM proctor_logs WHERE submission_id = ? ORDER BY timestamp ASC', [id]);

    return res.json({
      submission: {
        ...submission,
        answers: JSON.parse(submission.answers)
      },
      questions,
      logs
    });
  } catch (error) {
    console.error('Error fetching submission details:', error);
    return res.status(500).json({ error: 'Failed to fetch submission details.' });
  }
};
