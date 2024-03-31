import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import amqp from 'amqplib';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import promBundle from 'express-prom-bundle';
import redis from 'redis';


import sequelize from './config/database.js';
import { logger, setupMorgan } from './config/logger.js';
import WhatsappOficial from './models/WhatsappOficial.js';
import companyRoutes from './routes/companyRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server }, () => {
    logger.info('WebSocket server is running');
  });

app.use('/companys', companyRoutes);

setupMorgan(app);

sequelize.authenticate().then(() => {
    logger.info('Conexão com o banco de dados estabelecida com sucesso.');
}).catch(err => {
    logger.error('Não foi possível conectar ao banco de dados:', err);
});

const client = redis.createClient({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 15,
});

client.on('error', (err) => logger.error('Redis Client Error', err));
client.on('connect', () => logger.info('Connected to Redis'));
client.connect();

let rabbitMQConnection = null;
let rabbitMQChannel = null;

const metricsMiddleware = promBundle({includeMethod: true, includePath: true});
app.use(metricsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const messages = {};

wss.on('connection', (ws, req) => {
    const companyId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('companyId');
    const wsId = uuidv4();
    ws.id = wsId;

    if (!messages[companyId]) {
        messages[companyId] = [];
    }
    messages[companyId].push(ws);

    client.sAdd(`company:${companyId}:sockets`, wsId);

    ws.on('close', () => {
    
    const index = messages[companyId].indexOf(ws);
    if (index > -1) {
        messages[companyId].splice(index, 1);
    }

    client.sRem(`company:${companyId}:sockets`, wsId);
    
});

    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
});

const interval = setInterval(() => {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});

async function initializeRabbitMQ() {
    if (process.env.RABBITMQ_ENABLED === 'true' && !rabbitMQConnection) {
        try {
            rabbitMQConnection = await amqp.connect(process.env.RABBITMQ_URI);
            rabbitMQChannel = await rabbitMQConnection.createChannel();
            logger.info('Conexão com RabbitMQ estabelecida e canal criado.');
        } catch (error) {
            logger.error('Erro ao estabelecer conexão com RabbitMQ:', error);
        }
    }
}

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
    if (!rabbitMQConnection || !rabbitMQChannel) {
        logger.info('RabbitMQ não está Conectado ou a configuração da conexão não está definida.');
        return;
    }
    if (process.env.RABBITMQ_ENABLED !== 'true' || !companyConfig.rabbitmq_exchange) {
        logger.info('RabbitMQ não está habilitado ou a configuração da exchange não está definida.');
        return;
    }

    try {

        if (!companyConfig.rabbitmq_exchange || !companyConfig.rabbitmq_queue) {
            logger.error(`A configuração da exchange ou da fila não está definida para a empresa ${companyConfig.companyId}.`);
            return;
        }
        const exchange = companyConfig.rabbitmq_exchange;
        const queue = companyConfig.rabbitmq_queue;
        const routingKey = companyConfig.rabbitmq_routing_key || '';

        logger.info(`Declarando exchange '${exchange}' do tipo 'topic' para a empresa ${companyConfig.companyId}...`);
        await rabbitMQChannel.assertExchange(exchange, 'topic', { durable: true });

        logger.info(`Declarando fila '${queue}' do tipo 'quorum' para a empresa ${companyConfig.companyId}...`);
        await rabbitMQChannel.assertQueue(queue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });

        logger.info(`Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}' para a empresa ${companyConfig.companyId}...`);
        await rabbitMQChannel.bindQueue(queue, exchange, routingKey);

        rabbitMQChannel.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), { deliveryMode: 1 });
        logger.info(`Mensagem enviada para o RabbitMQ para a empresa ${companyConfig.companyId}`, { body });

    } catch (error) {
        logger.error(`Erro ao enviar para o RabbitMQ para a empresa ${companyConfig.companyId}`, { error: error.message });
    } finally {

    }
}

app.post("/webhook/:companyId/:conexaoId", async (req, res) => {
    try {
        const { companyId } = req.params;
        const companyConfig = await WhatsappOficial.findByPk(companyId);
        const body = req.body;
        logger.info("Webhook recebido:", { body, companyId });

        if (messages[companyId]) {
            messages[companyId].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(body));
                    logger.info(`Mensagem enviada para o WebSocket do companyId: ${companyId}`);
                }
            });
        }

        await sendToRabbitMQ(companyConfig, body);
        logger.info(`Enviado para o RabbitMQ com sucesso. Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}'...`);

        await forwardToWebhook(companyConfig.URLWebhookPOST, body);
        logger.info("Enviado para o Webhook com sucesso.");
      
        res.sendStatus(200);
        
        } catch (error) {
        logger.error("Erro no POST /webhook/:companyId/:conexaoId", { erro: error.message });
        res.sendStatus(500);
    }
});

app.get("/webhook/:companyId", async (req, res) => {
    const { companyId } = req.params;
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;

    try {
        const companyConfig = await WhatsappOficial.findByPk(companyId);

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
app.listen(PORT, async () => {
    logger.info("Webhook está ouvindo na porta " + PORT);
    await initializeRabbitMQ();
});
