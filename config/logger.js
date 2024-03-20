// config/logger.js
import winston from 'winston';

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

const logger = winston.createLogger({

    level: 'info',

    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD-MM-YYYY HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),

    transports: [

        new winston.transports.File({ filename: 'error.log', level: 'error' }),

        new winston.transports.File({ filename: 'combined.log' }),

        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
    ],

    exceptionHandlers: [
        new winston.transports.File({ filename: 'exceptions.log' })
    ],

    rejectionHandlers: [
        new winston.transports.File({ filename: 'rejections.log' })
    ],
});

export default logger;
