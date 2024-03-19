// models/companys.js
import { DataTypes } from 'sequelize';
import sequelize from '../database';

const Empresa = sequelize.define('Empresa', {
    // Defina os campos conforme a estrutura da sua tabela
    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Continue com os outros campos...
}, {
    // Opções adicionais
});

export default Empresa;
