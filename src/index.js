import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const app = express();

const port = Number(process.env.PORT) || 5000;

const allowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const corsError = new Error(
      'This website address is not allowed.'
    );

    corsError.status = 403;
    callback(corsError);
  },
  credentials: true,
};

app.disable('x-powered-by');

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

app.get('/', (request, response) => {
  response.status(200).json({
    success: true,
    message: 'Welcome to MediQueue.',
  });
});

app.get('/health', (request, response) => {
  response.status(200).json({
    success: true,
    status: 'available',
    time: new Date().toISOString(),
  });
});

app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: 'The requested resource was not found.',
  });
});

app.use((error, request, response, next) => {
  console.error(error);

  const statusCode = error.status || 500;

  response.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : error.message,
  });
});

const server = app.listen(port, () => {
  console.log(`MediQueue API: http://localhost:${port}`);
});

const shutdownServer = (signal) => {
  console.log(`${signal} received. Closing the application.`);

  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdownServer('SIGINT'));
process.on('SIGTERM', () => shutdownServer('SIGTERM'));

export default app;