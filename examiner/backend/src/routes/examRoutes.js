import express from 'express';
import { createExam, getExams, getExamDetails } from '../controllers/examController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, requireAdmin, createExam);
router.get('/', authenticateToken, getExams);
router.get('/:id', authenticateToken, getExamDetails);

export default router;
