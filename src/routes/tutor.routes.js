import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const tutorRouter = Router();

const cleanText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const isValidImageUrl = (value) => {
  try {
    const parsedUrl = new URL(value);

    return (
      parsedUrl.protocol === 'http:' ||
      parsedUrl.protocol === 'https:'
    );
  } catch {
    return false;
  }
};

const serializeTutor = (tutor) => ({
  ...tutor,
  _id: tutor._id.toString(),
});

const validateTutor = (body = {}) => {
  const tutor = {
    name: cleanText(body.name),
    image: cleanText(body.image),
    language: cleanText(body.language),
    price: Number(body.price),
    review:
      body.review === undefined ||
      body.review === ''
        ? 0
        : Number(body.review),
    description: cleanText(body.description),
    availableSlots: Number(body.availableSlots),
  };

  const errors = [];

  if (
    tutor.name.length < 2 ||
    tutor.name.length > 100
  ) {
    errors.push(
      'The tutor name must contain between 2 and 100 characters.'
    );
  }

  if (!isValidImageUrl(tutor.image)) {
    errors.push(
      'Please provide a valid tutor image address.'
    );
  }

  if (
    tutor.language.length < 2 ||
    tutor.language.length > 80
  ) {
    errors.push(
      'The language must contain between 2 and 80 characters.'
    );
  }

  if (
    !Number.isFinite(tutor.price) ||
    tutor.price <= 0
  ) {
    errors.push(
      'The session price must be greater than zero.'
    );
  }

  if (
    !Number.isFinite(tutor.review) ||
    tutor.review < 0 ||
    tutor.review > 5
  ) {
    errors.push(
      'The review score must be between 0 and 5.'
    );
  }

  if (
    tutor.description.length < 20 ||
    tutor.description.length > 2000
  ) {
    errors.push(
      'The description must contain between 20 and 2000 characters.'
    );
  }

  if (
    !Number.isInteger(tutor.availableSlots) ||
    tutor.availableSlots < 1
  ) {
    errors.push(
      'At least one available session is required.'
    );
  }

  return {
    tutor,
    errors,
  };
};

tutorRouter.get('/', async (request, response, next) => {
  try {
    const tutorsCollection =
      getDatabase().collection('tutors');

    const tutors = await tutorsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    response.status(200).json({
      success: true,
      count: tutors.length,
      tutors: tutors.map(serializeTutor),
    });
  } catch (error) {
    next(error);
  }
});

tutorRouter.get(
  '/:id',
  async (request, response, next) => {
    try {
      const tutorId = request.params.id;

      if (!/^[a-f\d]{24}$/i.test(tutorId)) {
        response.status(400).json({
          success: false,
          message: 'The tutor identification is invalid.',
        });

        return;
      }

      const tutorsCollection =
        getDatabase().collection('tutors');

      const tutor = await tutorsCollection.findOne({
        _id: new ObjectId(tutorId),
      });

      if (!tutor) {
        response.status(404).json({
          success: false,
          message: 'The requested tutor was not found.',
        });

        return;
      }

      response.status(200).json({
        success: true,
        tutor: serializeTutor(tutor),
      });
    } catch (error) {
      next(error);
    }
  }
);

tutorRouter.post(
  '/',
  verifyToken,
  async (request, response, next) => {
    try {
      const { tutor, errors } = validateTutor(
        request.body
      );

      if (errors.length > 0) {
        response.status(400).json({
          success: false,
          message:
            'Please correct the tutor information.',
          errors,
        });

        return;
      }

      const currentTime = new Date();

      const tutorDocument = {
        ...tutor,
        email: request.auth.email,
        ownerUid: request.auth.uid,
        createdAt: currentTime,
        updatedAt: currentTime,
      };

      const tutorsCollection =
        getDatabase().collection('tutors');

      const result = await tutorsCollection.insertOne(
        tutorDocument
      );

      response.status(201).json({
        success: true,
        message:
          'The tutor profile has been added successfully.',
        tutor: {
          ...tutorDocument,
          _id: result.insertedId.toString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default tutorRouter;