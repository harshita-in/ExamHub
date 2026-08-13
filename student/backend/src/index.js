import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import examRoutes from './routes/examRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import db from './config/db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with default settings (allow all origins for simplicity in development)
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submissions', submissionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', message: 'ExamHub API is online and database connected.' });
});

app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Express server started on http://localhost:${PORT}`);
});
