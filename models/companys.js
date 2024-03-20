// models/companys.js
import { Sequelize, DataTypes } from 'sequelize'; // Importe Sequelize e DataTypes
import sequelize from '../config/database'; // Caminho correto para o arquivo de configuração do Sequelize

const companys = sequelize.define('companys', {
    // Defina os campos conforme a estrutura da sua tabela
    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Continue com os outros campos...
}, {
    // Opções adicionais
});

export default companys;
