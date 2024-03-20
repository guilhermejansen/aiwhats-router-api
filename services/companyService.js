// /services/companyService.js
import Empresa from '../models/companys.js';
import { logger } from '../config/logger.js';

// Serviço para buscar uma empresa pelo ID
async function findCompanyById(companyId) {
    try {
        const company = await Empresa.findByPk(companyId);
        if (!company) {
            logger.info(`Empresa não encontrada com o ID: ${companyId}`);
            return null;
        }
        return company;
    } catch (error) {
        logger.error(`Erro ao buscar empresa com o ID ${companyId}: ${error.message}`);
        throw error;
    }
}

// Serviço para criar uma nova empresa
async function createCompany(companyData) {
    try {
        const newCompany = await Empresa.create(companyData);
        return newCompany;
    } catch (error) {
        logger.error(`Erro ao criar empresa: ${error.message}`);
        throw error;
    }
}

// Serviço para atualizar uma empresa existente
async function updateCompany(companyId, updateData) {
    try {
        const company = await Empresa.findByPk(companyId);
        if (!company) {
            logger.info(`Empresa não encontrada com o ID: ${companyId}`);
            return null;
        }
        const updatedCompany = await company.update(updateData);
        return updatedCompany;
    } catch (error) {
        logger.error(`Erro ao atualizar empresa com o ID ${companyId}: ${error.message}`);
        throw error;
    }
}

export { findCompanyById, createCompany, updateCompany };
