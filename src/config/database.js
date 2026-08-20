import 'dotenv/config';
import {
  MongoClient,
  ServerApiVersion,
} from 'mongodb';

const mongoUri = process.env.MONGODB_URI;
const databaseName =
  process.env.MONGODB_DB_NAME || 'mediqueue';

if (!mongoUri) {
  throw new Error(
    'MONGODB_URI is missing from the environment variables.'
  );
}

const mongoClient = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database = null;
let connectionPromise = null;

const requiredCollectionNames = [
  'tutors',
  'bookings',
];

const createRequiredCollections = async (
  connectedDatabase
) => {
  const existingCollections =
    await connectedDatabase
      .listCollections({}, { nameOnly: true })
      .toArray();

  const existingCollectionNames = new Set(
    existingCollections.map(
      (collection) => collection.name
    )
  );

  for (const collectionName of requiredCollectionNames) {
    if (!existingCollectionNames.has(collectionName)) {
      await connectedDatabase.createCollection(
        collectionName
      );
    }
  }
};

const establishDatabaseConnection = async () => {
  await mongoClient.connect();

  await mongoClient
    .db('admin')
    .command({ ping: 1 });

  database = mongoClient.db(databaseName);

  await createRequiredCollections(database);

  return database;
};

export const connectDatabase = async () => {
  if (database) {
    return database;
  }

  if (!connectionPromise) {
    connectionPromise =
      establishDatabaseConnection().catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
};

export const getDatabase = () => {
  if (!database) {
    throw new Error(
      'The database connection has not been established.'
    );
  }

  return database;
};

export const getCollections = () => {
  const connectedDatabase = getDatabase();

  return {
    tutors: connectedDatabase.collection('tutors'),
    bookings: connectedDatabase.collection('bookings'),
  };
};

export const closeDatabase = async () => {
  await mongoClient.close();

  database = null;
  connectionPromise = null;
};