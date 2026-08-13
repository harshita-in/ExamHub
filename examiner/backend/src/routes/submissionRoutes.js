import express from 'express';
import {
  startSubmission,
  logViolation,
  submitExam,
  getExamSubmissions,
  getSubmissionDetails
} from '../controllers/submissionController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/start', authenticateToken, startSubmission);
router.post('/violation', authenticateToken, logViolation);
router.post('/submit', authenticateToken, submitExam);
router.get('/exam/:examId', authenticateToken, requireAdmin, getExamSubmissions);
router.get('/:id', authenticateToken, getSubmissionDetails);

export default router;
