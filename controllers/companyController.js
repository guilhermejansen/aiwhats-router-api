// /controllers/companyController.js
import Company from '../models/companys.js';
import { logger } from '../config/logger.js';

export async function getCompany(req, res) {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) {
            return res.status(404).send('Empresa não encontrada');
        }
        res.json(company);
    } catch (error) {
        logger.error('Erro ao buscar empresa: %s', error.message);
        res.status(500).send('Erro ao buscar empresa');
    }
}

async function createCompany(req, res) {
    // Lógica para criar uma nova empresa...
}

async function updateCompany(req, res) {
    // Lógica para atualizar uma empresa...
}

export { createCompany, updateCompany };
