import { query } from '../config/db.js';

export const createExam = async (req, res) => {
  const { title, description, duration_minutes, max_warnings, questions } = req.body;
  const created_by = req.user.id;

  if (!title || !duration_minutes || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title, duration, and at least one question are required.' });
  }

  const warningsLimit = max_warnings || 5;

  try {
    // 1. Insert Exam record
    const examResult = await query.run(
      'INSERT INTO exams (title, description, duration_minutes, max_warnings, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description, duration_minutes, warningsLimit, created_by]
    );
    const examId = examResult.id;

    // 2. Insert Questions
    for (const q of questions) {
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
        throw new Error('All question fields (text, option_a/b/c/d, correct_option) are required.');
      }
      await query.run(
        'INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [examId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option.toUpperCase()]
      );
    }

    return res.status(201).json({
      message: 'Exam and questions created successfully.',
      examId
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    return res.status(500).json({ error: error.message || 'Failed to create exam.' });
  }
};

export const getExams = async (req, res) => {
  try {
    // Fetch all exams with their creator username
    const exams = await query.all(`
      SELECT e.*, u.username as creator_name,
      (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as questions_count
      FROM exams e 
      LEFT JOIN users u ON e.created_by = u.id
    `);

    // For students, fetch if they have already submitted this exam
    let responseExams = [...exams];
    if (req.user.role === 'student') {
      const submissions = await query.all(
        'SELECT exam_id, score, status, submitted_at FROM submissions WHERE user_id = ?',
        [req.user.id]
      );
      
      const subMap = {};
      submissions.forEach(sub => {
        subMap[sub.exam_id] = sub;
      });

      responseExams = exams.map(exam => ({
        ...exam,
        submission: subMap[exam.id] || null
      }));
    }

    return res.json(responseExams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    return res.status(500).json({ error: 'Failed to fetch exams.' });
  }
};

export const getExamDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const exam = await query.get('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    let questions;
    if (req.user.role === 'admin') {
      // Admin sees correct answers
      questions = await query.all('SELECT * FROM questions WHERE exam_id = ?', [id]);
    } else {
      // Student does NOT see correct options (prevent client-side scraping)
      questions = await query.all(
        'SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d FROM questions WHERE exam_id = ?',
        [id]
      );
    }

    return res.json({
      exam,
      questions
    });
  } catch (error) {
    console.error('Error fetching exam details:', error);
    return res.status(500).json({ error: 'Failed to fetch exam details.' });
  }
};
