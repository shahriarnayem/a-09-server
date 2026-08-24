import { MongoClient } from 'mongodb';

const mongoStateKey = '__mediqueueMongoState';

const mongoState = globalThis[mongoStateKey] || {
  client: null,
  database: null,
  connectionPromise: null,
};

globalThis[mongoStateKey] = mongoState;

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getMongoConfiguration = () => {
  const uri = process.env.MONGODB_URI?.trim();

  const databaseName =
    process.env.MONGODB_DB_NAME?.trim() ||
    'mediqueue';

  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing from the environment variables.'
    );
  }

  return {
    uri,
    databaseName,
  };
};

const createMongoClient = (uri) =>
  new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    maxConnecting: 2,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 12000,
    serverSelectionTimeoutMS: 12000,
    connectTimeoutMS: 12000,
    socketTimeoutMS: 45000,
    retryReads: true,
    retryWrites: true,
  });

const openDatabaseConnection = async () => {
  const { uri, databaseName } =
    getMongoConfiguration();

  let lastConnectionError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const client = createMongoClient(uri);

    try {
      await client.connect();

      const database = client.db(databaseName);

      await database.command({ ping: 1 });

      return {
        client,
        database,
      };
    } catch (error) {
      lastConnectionError = error;

      await client.close().catch(() => {});

      if (attempt < 2) {
        await wait(400);
      }
    }
  }

  throw lastConnectionError;
};

const connectDatabase = async () => {
  if (mongoState.client && mongoState.database) {
    return mongoState.database;
  }

  if (!mongoState.connectionPromise) {
    mongoState.connectionPromise =
      openDatabaseConnection()
        .then(({ client, database }) => {
          mongoState.client = client;
          mongoState.database = database;

          return database;
        })
        .catch((error) => {
          mongoState.client = null;
          mongoState.database = null;

          throw error;
        })
        .finally(() => {
          mongoState.connectionPromise = null;
        });
  }

  return mongoState.connectionPromise;
};

const getDatabase = () => {
  if (!mongoState.database) {
    throw new Error(
      'The database connection has not been established.'
    );
  }

  return mongoState.database;
};

const closeDatabase = async () => {
  if (mongoState.connectionPromise) {
    await mongoState.connectionPromise.catch(() => {});
  }

  if (mongoState.client) {
    await mongoState.client.close();
  }

  mongoState.client = null;
  mongoState.database = null;
  mongoState.connectionPromise = null;
};

export {
  closeDatabase,
  connectDatabase,
  getDatabase,
};