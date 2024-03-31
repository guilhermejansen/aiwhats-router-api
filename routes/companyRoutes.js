// /routes/companyRoutes.js
import express from 'express';
import { getCompany, createCompany, updateCompany } from '../controllers/companyController.js';

const router = express.Router();

router.get('/:id', getCompany);
router.post('/', createCompany);
router.put('/:id', updateCompany);

export default router;
