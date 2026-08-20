import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn =
  process.env.JWT_EXPIRES_IN || '1h';

if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET is missing from the environment variables.'
  );
}

if (jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must contain at least 32 characters.'
  );
}

const jwtConfiguration = {
  secret: jwtSecret,
  expiresIn: jwtExpiresIn,
  algorithm: 'HS256',
  issuer: 'mediqueue-api',
  audience: 'mediqueue-client',
};

export default jwtConfiguration;