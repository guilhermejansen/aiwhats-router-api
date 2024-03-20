// /routes/companyRoutes.js
import express from 'express';
import { getCompany, createCompany, updateCompany } from '../controllers/companyController.js';

const router = express.Router();

router.get('/:id', getCompany);
router.post('/', createCompany);
router.put('/:id', updateCompany);

// Adicione mais rotas conforme necessário

export default router;
