import express from 'express';
import morgan from 'morgan';
import promBundle from 'express-prom-bundle';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import amqp from 'amqplib';
import { getCompanyConfig } from './helpers/helpers';
import logger from './config/logger';

dotenv.config();

const app = express();

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

const metricsMiddleware = promBundle({includeMethod: true, includePath: true});
app.use(metricsMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function forwardToWebhook(companyConfig, body) {
    const webhookUrls = [
        companyConfig.n8n_webhook_url,
        companyConfig.chatwoot_webhook_url,
        companyConfig.typebot_webhook_url,
        companyConfig.crm_webhook_url
    ];

    webhookUrls.forEach(async (webhookUrl) => {
        if (!webhookUrl) return;
            try {
                const headers = { 'Content-Type': 'application/json' };

                if (webhookUrl === companyConfig.chatwoot_webhook_url && companyConfig.auth_token_chatwoot) {
                    headers['Authorization'] = `Bearer ${companyConfig.auth_token_chatwoot}`;
                }

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();
                logger.info("Resposta do encaminhamento do webhook", { webhookUrl, responseData });
            } catch (error) {
                logger.error("Erro ao encaminhar para o webhook", { erro: error.message, webhookUrl });
            }
    });
}

async function sendToRabbitMQ(companyConfig, body) {
    if (process.env.RABBITMQ_ENABLED !== 'true' || !companyConfig.rabbitmq_exchange) {
        logger.info('RabbitMQ não está habilitado ou a configuração da exchange não está definida.');
        return;
    }
    let conn, channel;
    try {

        logger.info('Conectando ao RabbitMQ...');
        conn = await amqp.connect(process.env.RABBITMQ_URI);
        logger.info('Conexão com RabbitMQ estabelecida.');

        channel = await conn.createChannel();
        logger.info('Canal RabbitMQ criado.');

        const exchange = companyConfig.rabbitmq_exchange;
        const queue = companyConfig.rabbitmq_queue;
        const routingKey = companyConfig.rabbitmq_routing_key || '';

        logger.info(`Declarando exchange '${exchange}' do tipo 'topic' para a empresa ${companyConfig.companyId}...`);
        await channel.assertExchange(exchange, 'topic', { durable: true });

        logger.info(`Declarando fila '${queue}' do tipo 'quorum' para a empresa ${companyConfig.companyId}...`);
        await channel.assertQueue(queue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });

        logger.info(`Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}' para a empresa ${companyConfig.companyId}...`);
        await channel.bindQueue(queue, exchange, routingKey);

        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), { deliveryMode: 1 });
        logger.info(`Mensagem enviada para o RabbitMQ para a empresa ${companyConfig.companyId}`, { body });

    } catch (error) {
        logger.error(`Erro ao enviar para o RabbitMQ para a empresa ${companyConfig.companyId}`, { error: error.message });
    } finally {
        if (channel) await channel.close();
        if (conn) await conn.close();
    }
}

app.post("/webhook/:companyId", async (req, res) => {
    try {
        const { companyId } = req.params;
        const companyConfig = await getCompanyConfig(companyId);
        const body = req.body;
        logger.info("Webhook recebido:", { body, companyId });

        await forwardToWebhook(companyConfig.URLWebhookPOST, body);
        logger.info("Enviado para o Webhook com sucesso.");

        await sendToRabbitMQ(companyConfig, body);
        logger.info(`Enviado para o RabbitMQ com sucesso. Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}'...`);
        res.sendStatus(200);
        
        } catch (error) {
        logger.error("Erro no POST /webhook/:companyId", { erro: error.message });
        res.sendStatus(500);
    }
});

app.get("/webhook/:companyId", async (req, res) => {
    const { companyId } = req.params;
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;

    try {
        const companyConfig = await getCompanyConfig(companyId);

    if (mode === "subscribe" && token === companyConfig.verify_token) {
            logger.info("WEBHOOK VERIFICADO para a empresa:", companyId);

            res.status(200).send(challenge);
        } else {
            logger.warn("Falha na verificação do webhook para a empresa:", companyId);
            res.sendStatus(403);
        }
    } catch (error) {
        logger.error("Erro na verificação do webhook para a empresa:", { companyId, error: error.message });
        res.sendStatus(500);
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.use((err, req, res, next) => {
    logger.error("Erro não tratado", { erro: err.message });
    res.status(500).send('Algo deu errado!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info("Webhook está ouvindo na porta " + PORT));
