// helpers.js
import companys from './models/companys';

export async function getCompanyConfig(companyId) {
    try {
        const companyConfig = await companys.findByPk(companyId);
        return companyConfig;
    } catch (error) {
        console.error('Erro ao buscar configuração da companys:', error);
        throw error;
    }
}

// Você pode adicionar mais helpers conforme necessário
