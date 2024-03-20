// /config/database.js
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('setupautomatizado', 'postgres', 'GuiJansen2024DEV', {
    host: '5.78.93.54',
    dialect: 'postgres'
});

export default sequelize;
