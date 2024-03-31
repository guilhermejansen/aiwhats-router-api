// /models/companys.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Company = sequelize.define('Company', {
    nome: {
        type: DataTypes.STRING,
        allowNull: false,
    },

}, {

});

export default Company;
