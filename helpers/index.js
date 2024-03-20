// helpers/index.js
import { logger } from '../config/logger.js';
import WhatsappOficial from '../models/WhatsappOficial.js';

async function getCompanyConfig(companyId) {
    try {
        const companyConfig = await WhatsappOficial.findByPk(companyId);
        if (!companyConfig) {
            throw new Error(`Empresa não encontrada com o ID: ${companyId}`);
        }
        return companyConfig.get({ plain: true });
    } catch (error) {
        logger.error("Erro ao buscar configurações da empresa:", { companyId, error: error.message });
        throw error;
    }
}

export { getCompanyConfig };
