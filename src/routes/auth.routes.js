import { Router } from 'express';
import jwt from 'jsonwebtoken';
import jwtConfiguration from '../config/jwt.js';
import verifyToken from '../middleware/verifyToken.js';

const authRouter = Router();

const emailPattern =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/token', (request, response, next) => {
  try {
    const email = String(
      request.body?.email || ''
    )
      .trim()
      .toLowerCase();

    const uid = String(
      request.body?.uid || ''
    ).trim();

    if (!email || !uid) {
      response.status(400).json({
        success: false,
        message:
          'Email and account identification are required.',
      });

      return;
    }

    if (!emailPattern.test(email)) {
      response.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });

      return;
    }

    if (uid.length > 128) {
      response.status(400).json({
        success: false,
        message:
          'The account identification is invalid.',
      });

      return;
    }

    const accessToken = jwt.sign(
      {
        email,
      },
      jwtConfiguration.secret,
      {
        algorithm: jwtConfiguration.algorithm,
        expiresIn: jwtConfiguration.expiresIn,
        issuer: jwtConfiguration.issuer,
        audience: jwtConfiguration.audience,
        subject: uid,
      }
    );

    response.status(200).json({
      success: true,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: jwtConfiguration.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get(
  '/verify',
  verifyToken,
  (request, response) => {
    response.status(200).json({
      success: true,
      message: 'Your account has been verified.',
      user: request.auth,
    });
  }
);

export default authRouter;