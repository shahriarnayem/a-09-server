import jwt from 'jsonwebtoken';
import jwtConfiguration from '../config/jwt.js';

function verifyToken(request, response, next) {
  const authorizationHeader =
    request.get('authorization');

  if (!authorizationHeader) {
    response.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    });

    return;
  }

  const authorizationParts =
    authorizationHeader.trim().split(/\s+/);

  const scheme = authorizationParts[0];
  const token = authorizationParts[1];

  if (
    authorizationParts.length !== 2 ||
    scheme.toLowerCase() !== 'bearer' ||
    !token
  ) {
    response.status(401).json({
      success: false,
      message: 'The authorization information is invalid.',
    });

    return;
  }

  try {
    const decodedToken = jwt.verify(
      token,
      jwtConfiguration.secret,
      {
        algorithms: [jwtConfiguration.algorithm],
        issuer: jwtConfiguration.issuer,
        audience: jwtConfiguration.audience,
      }
    );

    if (!decodedToken.sub || !decodedToken.email) {
      response.status(401).json({
        success: false,
        message: 'The account information is invalid.',
      });

      return;
    }

    request.auth = {
      uid: decodedToken.sub,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      response.status(401).json({
        success: false,
        message:
          'Your session has expired. Please log in again.',
      });

      return;
    }

    response.status(401).json({
      success: false,
      message:
        'Your session could not be verified. Please log in again.',
    });
  }
}

export default verifyToken;