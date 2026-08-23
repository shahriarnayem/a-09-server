import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

const getTutorsCollection = () =>
  getDatabase().collection('tutors');

const textValue = (value) =>
  typeof value === 'string' ? value.trim() : '';

const hasAnyField = (object, fields) =>
  fields.some((field) =>
    Object.prototype.hasOwnProperty.call(
      object,
      field
    )
  );

const getFirstValue = (object, fields) => {
  for (const field of fields) {
    if (
      Object.prototype.hasOwnProperty.call(
        object,
        field
      )
    ) {
      return object[field];
    }
  }

  return undefined;
};

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidDate = (dateValue) => {
  if (!dateValue) return false;

  const date = new Date(`${dateValue}T00:00:00`);

  return !Number.isNaN(date.getTime());
};

const validTeachingModes = [
  'Online',
  'Offline',
  'Both',
];

const buildTutorFromRequest = (requestBody) => {
  const name = textValue(requestBody.name);
  const image = textValue(requestBody.image);

  const subject = textValue(
    requestBody.subject ||
      requestBody.category ||
      requestBody.language
  );

  const availableDays = textValue(
    requestBody.availableDays
  );

  const availableTimeSlot = textValue(
    requestBody.availableTimeSlot ||
      requestBody.availableTime
  );

  const hourlyFee = Number(
    requestBody.hourlyFee ??
      requestBody.price
  );

  const totalSlot = Number(
    requestBody.totalSlot ??
      requestBody.availableSlots
  );

  const sessionStartDate = textValue(
    requestBody.sessionStartDate
  );

  const institutionExperience = textValue(
    requestBody.institutionExperience ||
      requestBody.description
  );

  const location = textValue(
    requestBody.location
  );

  const teachingMode = textValue(
    requestBody.teachingMode
  );

  const review =
    requestBody.review === undefined
      ? 0
      : Number(requestBody.review);

  const errors = [];

  if (!name) {
    errors.push('Tutor name is required.');
  }

  if (!image) {
    errors.push('Tutor photo is required.');
  }

  if (!subject) {
    errors.push(
      'Please select a subject or category.'
    );
  }

  if (!availableDays) {
    errors.push('Available days are required.');
  }

  if (!availableTimeSlot) {
    errors.push(
      'Available time slot is required.'
    );
  }

  if (
    !Number.isFinite(hourlyFee) ||
    hourlyFee <= 0
  ) {
    errors.push(
      'Please enter a valid hourly fee.'
    );
  }

  if (
    !Number.isInteger(totalSlot) ||
    totalSlot < 0
  ) {
    errors.push(
      'Total slots must be a whole number.'
    );
  }

  if (!isValidDate(sessionStartDate)) {
    errors.push(
      'Please select a valid session start date.'
    );
  }

  if (!institutionExperience) {
    errors.push(
      'Institution and experience information is required.'
    );
  }

  if (!location) {
    errors.push('Location is required.');
  }

  if (
    !validTeachingModes.includes(
      teachingMode
    )
  ) {
    errors.push(
      'Please select a valid teaching mode.'
    );
  }

  if (
    !Number.isFinite(review) ||
    review < 0 ||
    review > 5
  ) {
    errors.push(
      'The rating must be between 0 and 5.'
    );
  }

  return {
    errors,
    tutor: {
      name,
      image,

      subject,
      category: subject,
      language: subject,

      availableDays,
      availableTimeSlot,

      hourlyFee,
      price: hourlyFee,

      totalSlot,
      availableSlots: totalSlot,

      sessionStartDate,

      institutionExperience,
      description: institutionExperience,

      location,
      teachingMode,
      review,
    },
  };
};

const buildTutorUpdates = (requestBody) => {
  const updates = {};
  const errors = [];

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'name'
    )
  ) {
    const name = textValue(requestBody.name);

    if (!name) {
      errors.push('Tutor name is required.');
    } else {
      updates.name = name;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'image'
    )
  ) {
    const image = textValue(requestBody.image);

    if (!image) {
      errors.push('Tutor photo is required.');
    } else {
      updates.image = image;
    }
  }

  if (
    hasAnyField(requestBody, [
      'subject',
      'category',
      'language',
    ])
  ) {
    const subject = textValue(
      getFirstValue(requestBody, [
        'subject',
        'category',
        'language',
      ])
    );

    if (!subject) {
      errors.push(
        'Please select a subject or category.'
      );
    } else {
      updates.subject = subject;
      updates.category = subject;
      updates.language = subject;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'availableDays'
    )
  ) {
    const availableDays = textValue(
      requestBody.availableDays
    );

    if (!availableDays) {
      errors.push(
        'Available days are required.'
      );
    } else {
      updates.availableDays = availableDays;
    }
  }

  if (
    hasAnyField(requestBody, [
      'availableTimeSlot',
      'availableTime',
    ])
  ) {
    const availableTimeSlot = textValue(
      getFirstValue(requestBody, [
        'availableTimeSlot',
        'availableTime',
      ])
    );

    if (!availableTimeSlot) {
      errors.push(
        'Available time slot is required.'
      );
    } else {
      updates.availableTimeSlot =
        availableTimeSlot;
    }
  }

  if (
    hasAnyField(requestBody, [
      'hourlyFee',
      'price',
    ])
  ) {
    const hourlyFee = Number(
      getFirstValue(requestBody, [
        'hourlyFee',
        'price',
      ])
    );

    if (
      !Number.isFinite(hourlyFee) ||
      hourlyFee <= 0
    ) {
      errors.push(
        'Please enter a valid hourly fee.'
      );
    } else {
      updates.hourlyFee = hourlyFee;
      updates.price = hourlyFee;
    }
  }

  if (
    hasAnyField(requestBody, [
      'totalSlot',
      'availableSlots',
    ])
  ) {
    const totalSlot = Number(
      getFirstValue(requestBody, [
        'totalSlot',
        'availableSlots',
      ])
    );

    if (
      !Number.isInteger(totalSlot) ||
      totalSlot < 0
    ) {
      errors.push(
        'Total slots must be a whole number.'
      );
    } else {
      updates.totalSlot = totalSlot;
      updates.availableSlots = totalSlot;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'sessionStartDate'
    )
  ) {
    const sessionStartDate = textValue(
      requestBody.sessionStartDate
    );

    if (!isValidDate(sessionStartDate)) {
      errors.push(
        'Please select a valid session start date.'
      );
    } else {
      updates.sessionStartDate =
        sessionStartDate;
    }
  }

  if (
    hasAnyField(requestBody, [
      'institutionExperience',
      'description',
    ])
  ) {
    const institutionExperience = textValue(
      getFirstValue(requestBody, [
        'institutionExperience',
        'description',
      ])
    );

    if (!institutionExperience) {
      errors.push(
        'Institution and experience information is required.'
      );
    } else {
      updates.institutionExperience =
        institutionExperience;
      updates.description =
        institutionExperience;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'location'
    )
  ) {
    const location = textValue(
      requestBody.location
    );

    if (!location) {
      errors.push('Location is required.');
    } else {
      updates.location = location;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'teachingMode'
    )
  ) {
    const teachingMode = textValue(
      requestBody.teachingMode
    );

    if (
      !validTeachingModes.includes(
        teachingMode
      )
    ) {
      errors.push(
        'Please select a valid teaching mode.'
      );
    } else {
      updates.teachingMode = teachingMode;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      requestBody,
      'review'
    )
  ) {
    const review = Number(requestBody.review);

    if (
      !Number.isFinite(review) ||
      review < 0 ||
      review > 5
    ) {
      errors.push(
        'The rating must be between 0 and 5.'
      );
    } else {
      updates.review = review;
    }
  }

  return {
    errors,
    updates,
  };
};

/*
|--------------------------------------------------------------------------
| Get all tutors
|--------------------------------------------------------------------------
*/

router.get('/', async (request, response) => {
  try {
    const tutorsCollection =
      getTutorsCollection();

    const search = textValue(
      request.query.search
    );

    const startDate = textValue(
      request.query.startDate
    );

    const endDate = textValue(
      request.query.endDate
    );

    const sort =
      request.query.sort === 'oldest'
        ? 'oldest'
        : 'latest';

    const requestedLimit = Number.parseInt(
      request.query.limit,
      10
    );

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : null;

    const filter = {};

    if (search) {
      filter.name = {
        $regex: escapeRegularExpression(search),
        $options: 'i',
      };
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const parsedStartDate = new Date(
          `${startDate}T00:00:00`
        );

        if (
          !Number.isNaN(
            parsedStartDate.getTime()
          )
        ) {
          filter.createdAt.$gte =
            parsedStartDate;
        }
      }

      if (endDate) {
        const parsedEndDate = new Date(
          `${endDate}T23:59:59.999`
        );

        if (
          !Number.isNaN(
            parsedEndDate.getTime()
          )
        ) {
          filter.createdAt.$lte =
            parsedEndDate;
        }
      }

      if (
        Object.keys(filter.createdAt).length ===
        0
      ) {
        delete filter.createdAt;
      }
    }

    const total =
      await tutorsCollection.countDocuments(
        filter
      );

    let tutorQuery = tutorsCollection
      .find(filter)
      .sort({
        createdAt: sort === 'oldest' ? 1 : -1,
      });

    if (limit) {
      tutorQuery = tutorQuery.limit(limit);
    }

    const tutors = await tutorQuery.toArray();

    return response.status(200).json({
      success: true,
      total,
      count: tutors.length,
      limit,
      sort,
      tutors,
    });
  } catch (error) {
    console.error(
      'Unable to load tutors:',
      error
    );

    return response.status(500).json({
      success: false,
      message:
        'The tutor profiles could not be loaded.',
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get one tutor
|--------------------------------------------------------------------------
*/

router.get(
  '/:id',
  async (request, response) => {
    const { id } = request.params;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message:
          'The selected tutor is not valid.',
      });
    }

    try {
      const tutor =
        await getTutorsCollection().findOne({
          _id: new ObjectId(id),
        });

      if (!tutor) {
        return response.status(404).json({
          success: false,
          message:
            'The tutor profile was not found.',
        });
      }

      return response.status(200).json({
        success: true,
        tutor,
      });
    } catch (error) {
      console.error(
        'Unable to load tutor:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be loaded.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Create tutor
|--------------------------------------------------------------------------
*/

router.post(
  '/',
  verifyToken,
  async (request, response) => {
    const { errors, tutor } =
      buildTutorFromRequest(
        request.body || {}
      );

    if (errors.length > 0) {
      return response.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    try {
      const currentTime = new Date();

      const newTutor = {
        ...tutor,
        email: request.auth.email,
        ownerUid: request.auth.uid,
        createdAt: currentTime,
        updatedAt: currentTime,
      };

      const result =
        await getTutorsCollection().insertOne(
          newTutor
        );

      return response.status(201).json({
        success: true,
        message:
          'The tutor profile has been added successfully.',
        tutor: {
          _id: result.insertedId,
          ...newTutor,
        },
      });
    } catch (error) {
      console.error(
        'Unable to create tutor:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be added.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Update owned tutor
|--------------------------------------------------------------------------
*/

router.patch(
  '/:id',
  verifyToken,
  async (request, response) => {
    const { id } = request.params;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message:
          'The selected tutor is not valid.',
      });
    }

    const tutorObjectId = new ObjectId(id);

    try {
      const tutorsCollection =
        getTutorsCollection();

      const existingTutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

      if (!existingTutor) {
        return response.status(404).json({
          success: false,
          message:
            'The tutor profile was not found.',
        });
      }

      if (
        existingTutor.ownerUid !==
        request.auth.uid
      ) {
        return response.status(403).json({
          success: false,
          message:
            'You can only update your own tutor profiles.',
        });
      }

      const { errors, updates } =
        buildTutorUpdates(
          request.body || {}
        );

      if (errors.length > 0) {
        return response.status(400).json({
          success: false,
          message: errors[0],
          errors,
        });
      }

      if (Object.keys(updates).length === 0) {
        return response.status(400).json({
          success: false,
          message:
            'Please provide information to update.',
        });
      }

      const updatedAt = new Date();

      await tutorsCollection.updateOne(
        {
          _id: tutorObjectId,
          ownerUid: request.auth.uid,
        },
        {
          $set: {
            ...updates,
            updatedAt,
          },
        }
      );

      const updatedTutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

      return response.status(200).json({
        success: true,
        message:
          'The tutor profile has been updated successfully.',
        tutor: updatedTutor,
      });
    } catch (error) {
      console.error(
        'Unable to update tutor:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be updated.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Delete owned tutor
|--------------------------------------------------------------------------
*/

router.delete(
  '/:id',
  verifyToken,
  async (request, response) => {
    const { id } = request.params;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message:
          'The selected tutor is not valid.',
      });
    }

    const tutorObjectId = new ObjectId(id);

    try {
      const tutorsCollection =
        getTutorsCollection();

      const existingTutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

      if (!existingTutor) {
        return response.status(404).json({
          success: false,
          message:
            'The tutor profile was not found.',
        });
      }

      if (
        existingTutor.ownerUid !==
        request.auth.uid
      ) {
        return response.status(403).json({
          success: false,
          message:
            'You can only delete your own tutor profiles.',
        });
      }

      await tutorsCollection.deleteOne({
        _id: tutorObjectId,
        ownerUid: request.auth.uid,
      });

      return response.status(200).json({
        success: true,
        message:
          'The tutor profile has been deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Unable to delete tutor:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be deleted.',
      });
    }
  }
);

export default router;