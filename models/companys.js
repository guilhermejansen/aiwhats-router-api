// /models/companys.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Company = sequelize.define('Company', {
    nome: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    // Defina outros campos conforme necessário
}, {
    // Opções adicionais, se necessário
});

export default Company;
