import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import winston from 'winston';
import amqp from 'amqplib';
import { getCompanyConfig } from './helpers/helpers';

dotenv.config();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function forwardToWebhook(companyId, body) {
    const companyConfig = await getCompanyConfig(companyId);
    const webhookUrl = companyConfig.URLWebhookPOST;
    // Lógica para encaminhar para o webhook...
}

const PORT = process.env.PORT || 5000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WEBHOOK_URLS = [
    process.env.N8N_WEBHOOK_URL,
    process.env.CHATWOOT_WEBHOOK_URL,
    process.env.CRM_WEBHOOK_URL
];
const AUTH_TOKEN_CHATWOOT = process.env.AUTH_TOKEN_CHATWOOT_WEBHOOK;

app.listen(PORT, () => logger.info("Webhook está ouvindo na porta " + PORT));

async function forwardToWebhook(webhookUrl, body) {
    try {
        const headers = { 'Content-Type': 'application/json' };

        if (webhookUrl === process.env.CHATWOOT_WEBHOOK_URL && AUTH_TOKEN_CHATWOOT) {
            headers['Authorization'] = `Bearer ${AUTH_TOKEN_CHATWOOT}`;
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
}

async function sendToRabbitMQ(payload) {
    let conn, channel;
    try {
        if (process.env.RABBITMQ_ENABLED !== 'true') {
            logger.info('RabbitMQ não está habilitado');
            return;
        }

        logger.info('Conectando ao RabbitMQ...');
        conn = await amqp.connect(process.env.RABBITMQ_URI);
        logger.info('Conexão com RabbitMQ estabelecida.');

        channel = await conn.createChannel();
        logger.info('Canal RabbitMQ criado.');

        const exchange = process.env.RABBITMQ_EXCHANGE;
        const queue = process.env.RABBITMQ_QUEUE;
        const routingKey = process.env.RABBITMQ_ROUTING_KEY || '';

        logger.info(`Declarando exchange '${exchange}' do tipo 'topic'...`);
        await channel.assertExchange(exchange, 'topic', { durable: true });

        logger.info(`Declarando fila '${queue}' do tipo 'quorum'...`);
        await channel.assertQueue(queue, {
            durable: true,
            arguments: {
                'x-queue-type': 'quorum',
            }
        });

        logger.info(`Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}'...`);
        await channel.bindQueue(queue, exchange, routingKey);

        channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
            deliveryMode: 1 
        });
        logger.info('Mensagem enviada para o RabbitMQ', { payload });

    } catch (error) {
        logger.error('Erro ao enviar para o RabbitMQ', { error: error.message });
    } finally {
        if (channel) {
            await channel.close();
            logger.info('Canal RabbitMQ fechado.');
        }
        if (conn) {
            await conn.close();
            logger.info('Conexão com RabbitMQ fechada.');
        }
    }
}

app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        logger.info("Webhook recebido:", { body });

        WEBHOOK_URLS.forEach(webhookUrl => {
            if (webhookUrl) {
                forwardToWebhook(webhookUrl, body);
            }
        });

        sendToRabbitMQ(body).then(() => {
            logger.info("Payload enviado para o RabbitMQ com sucesso.");
        }).catch((error) => {
            logger.error("Erro ao enviar payload para o RabbitMQ", { erro: error.message });
        });

        res.sendStatus(200);
    } catch (error) {
        logger.error("Erro no POST /webhook", { erro: error.message });
        res.sendStatus(500);
    }
});

app.get("/webhook", (req, res) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        logger.info("WEBHOOK_VERIFICADO");

        res.status(200).send(challenge);

        if (process.env.CHATWOOT_WEBHOOK_URL) {

            fetch(process.env.CHATWOOT_WEBHOOK_URL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AUTH_TOKEN_CHATWOOT}`
                },

                body: JSON.stringify({ "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge })
            })
            .then(chatwootResponse => chatwootResponse.json())
            .then(chatwootData => {
                logger.info("Verificação do Chatwoot encaminhada", { chatwootData });
            })
            .catch(error => {
                logger.error("Erro ao encaminhar a verificação para o Chatwoot", { erro: error.message });
            });
        }

    } else {
        logger.warn("Falha na verificação do webhook");
        res.sendStatus(403);
    }
});


app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.use((err, req, res, next) => {
    logger.error("Erro não tratado", { erro: err.message });
    res.status(500).send('Algo deu errado!');
});
