// /models/WhatsappOficial.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WhatsappOficial = sequelize.define('WhatsappOficial', {
    companyid: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false
    },
    verify_token: DataTypes.STRING,
    auth_token_chatwoot: DataTypes.STRING,
    n8n_webhook_url: DataTypes.STRING,
    chatwoot_webhook_url: DataTypes.STRING,
    crm_webhook_url: DataTypes.STRING,
    typebot_webhook_url: DataTypes.STRING,
    rabbitmq_exchange: DataTypes.STRING,
    rabbitmq_queue: DataTypes.STRING,
    rabbitmq_routing_key: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
}, {
    tableName: 'whatsapp_oficial',
    timestamps: false,
});

export default WhatsappOficial;
