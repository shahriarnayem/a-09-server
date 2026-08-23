import cors from 'cors';
import express from 'express';
import {
  closeDatabase,
  connectDatabase,
  getDatabase,
} from './config/database.js';
import authRouter from './routes/auth.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import tutorRouter from './routes/tutor.routes.js';

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

app.get(
  '/health',
  async (request, response, next) => {
    try {
      await getDatabase().command({ ping: 1 });

      response.status(200).json({
        success: true,
        status: 'available',
        database: 'connected',
        time: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

app.use('/api/auth', authRouter);
app.use('/api/tutors', tutorRouter);
app.use('/api/bookings', bookingRoutes);

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

let server = null;
let shuttingDown = false;

const startApplication = async () => {
  await connectDatabase();

  console.log('MongoDB connection established.');

  server = app.listen(port, () => {
    console.log(
      `MediQueue API: http://localhost:${port}`
    );
  });
};

const shutdownApplication = async (signal) => {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(
    `${signal} received. Closing the application.`
  );

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await closeDatabase();

    console.log('Application closed successfully.');
    process.exit(0);
  } catch (error) {
    console.error(
      'Unable to close cleanly:',
      error
    );

    process.exit(1);
  }
};

startApplication().catch((error) => {
  console.error(
    'Unable to start the application:',
    error
  );

  process.exit(1);
});

process.on('SIGINT', () =>
  shutdownApplication('SIGINT')
);

process.on('SIGTERM', () =>
  shutdownApplication('SIGTERM')
);

export default app;