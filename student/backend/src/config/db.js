import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file will be created in backend root
const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
      if (pragmaErr) console.error('Failed to enable foreign keys:', pragmaErr);
      initializeTables();
    });
  }
});

// Helper wrapper to run queries with promises
export const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

function initializeTables() {
  db.serialize(() => {
    // Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student'
      )
    `);

    // Exams Table
    db.run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL,
        max_warnings INTEGER NOT NULL DEFAULT 5,
        created_by INTEGER,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Questions Table
    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL,
        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
      )
    `);

    // Submissions Table
    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        answers TEXT DEFAULT '{}',
        score INTEGER DEFAULT 0,
        warnings_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Proctor Logs Table
    db.run(`
      CREATE TABLE IF NOT EXISTS proctor_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        violation_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )
    `, () => {
      // Callback after tables are created
      console.log('Database tables verified/initialized successfully.');
      seedDatabase();
    });
  });
}

async function seedDatabase() {
  try {
    const userCount = await query.get('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count > 0) {
      console.log('Database already contains data. Skipping default seed.');
      return;
    }

    console.log('Seeding default proctored users and exams...');

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('admin123', salt);
    const studentHash = await bcrypt.hash('student123', salt);

    // Insert Admin
    const adminResult = await query.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@examhub.com', adminHash, 'admin']
    );

    // Insert Student
    await query.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['student', 'student@examhub.com', studentHash, 'student']
    );

    // Insert Exam
    const examResult = await query.run(
      'INSERT INTO exams (title, description, duration_minutes, max_warnings, created_by) VALUES (?, ?, ?, ?, ?)',
      [
        'JavaScript & Browser Security Essentials',
        'An evaluation of basic JavaScript scope, runtime features, and key browser security events (such as visibilityState and focus events).',
        10,
        5,
        adminResult.id
      ]
    );

    const examId = examResult.id;

    // Insert Questions
    const sampleQuestions = [
      {
        question_text: 'Which HTML5 API is used in this project to detect if a candidate minimizes the browser or changes active tabs?',
        option_a: 'Fullscreen API',
        option_b: 'Page Visibility API',
        option_c: 'Clipboard API',
        option_d: 'Geolocation API',
        correct_option: 'B'
      },
      {
        question_text: 'What happens in our Proctoring Engine when a student exits fullscreen mode?',
        option_a: 'The test is graded as zero immediately.',
        option_b: 'A warning is registered on the server, and the screen is locked until fullscreen is restored.',
        option_c: 'The browser triggers a web camera alert.',
        option_d: 'The exam is paused without penalty.',
        correct_option: 'B'
      },
      {
        question_text: 'What event listener detects when focus shifts completely away from the browser window (e.g., clicking on another app)?',
        option_a: 'window.onblur',
        option_b: 'window.onfocus',
        option_c: 'document.onvisibilitychange',
        option_d: 'document.oncopy',
        correct_option: 'A'
      },
      {
        question_text: 'What is the default warning limit in this portal before candidate disqualification and auto-submission?',
        option_a: '3 warnings',
        option_b: '5 warnings',
        option_c: '7 warnings',
        option_d: '10 warnings',
        correct_option: 'B'
      },
      {
        question_text: 'Which character sequence represents the typeof operator evaluation of null in standard JavaScript?',
        option_a: '"null"',
        option_b: '"object"',
        option_c: '"undefined"',
        option_d: '"function"',
        correct_option: 'B'
      }
    ];

    for (const q of sampleQuestions) {
      await query.run(
        'INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [examId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option]
      );
    }

    console.log('Database seeded successfully.');
    console.log('Credentials:\n- Admin: admin@examhub.com (password: admin123)\n- Student: student@examhub.com (password: student123)');

  } catch (error) {
    console.error('Failed to seed database:', error);
  }
}

export default db;
