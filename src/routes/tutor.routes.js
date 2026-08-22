import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const tutorRouter = Router();

const cleanText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const parseDate = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = endOfDay
    ? 'T23:59:59.999Z'
    : 'T00:00:00.000Z';

  const parsedDate = new Date(`${value}${time}`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
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

const buildTutorQuery = (queryParameters) => {
  const conditions = [];
  const errors = [];

  const search = cleanText(queryParameters.search);
  const language = cleanText(queryParameters.language);
  const minPriceText = cleanText(
    queryParameters.minPrice
  );
  const maxPriceText = cleanText(
    queryParameters.maxPrice
  );
  const minReviewText = cleanText(
    queryParameters.minReview
  );
  const availableOnlyText = cleanText(
    queryParameters.availableOnly
  ).toLowerCase();
  const fromDateText = cleanText(
    queryParameters.fromDate
  );
  const toDateText = cleanText(
    queryParameters.toDate
  );
  const limitText = cleanText(queryParameters.limit);
  const sortText =
    cleanText(queryParameters.sort).toLowerCase() ||
    'latest';

  if (search) {
    const safeSearch =
      escapeRegularExpression(search);

    const searchCondition = {
      $regex: safeSearch,
      $options: 'i',
    };

    conditions.push({
      $or: [
        { name: searchCondition },
        { language: searchCondition },
        { description: searchCondition },
      ],
    });
  }

  if (language) {
    conditions.push({
      language: {
        $regex: `^${escapeRegularExpression(
          language
        )}$`,
        $options: 'i',
      },
    });
  }

  const priceCondition = {};

  if (minPriceText) {
    const minPrice = Number(minPriceText);

    if (
      !Number.isFinite(minPrice) ||
      minPrice < 0
    ) {
      errors.push(
        'The minimum price must be a valid positive number.'
      );
    } else {
      priceCondition.$gte = minPrice;
    }
  }

  if (maxPriceText) {
    const maxPrice = Number(maxPriceText);

    if (
      !Number.isFinite(maxPrice) ||
      maxPrice < 0
    ) {
      errors.push(
        'The maximum price must be a valid positive number.'
      );
    } else {
      priceCondition.$lte = maxPrice;
    }
  }

  if (
    priceCondition.$gte !== undefined &&
    priceCondition.$lte !== undefined &&
    priceCondition.$gte > priceCondition.$lte
  ) {
    errors.push(
      'The minimum price cannot be greater than the maximum price.'
    );
  }

  if (Object.keys(priceCondition).length > 0) {
    conditions.push({
      price: priceCondition,
    });
  }

  if (minReviewText) {
    const minReview = Number(minReviewText);

    if (
      !Number.isFinite(minReview) ||
      minReview < 0 ||
      minReview > 5
    ) {
      errors.push(
        'The minimum review score must be between 0 and 5.'
      );
    } else {
      conditions.push({
        review: {
          $gte: minReview,
        },
      });
    }
  }

  if (availableOnlyText) {
    if (
      availableOnlyText !== 'true' &&
      availableOnlyText !== 'false'
    ) {
      errors.push(
        'Available only must be either true or false.'
      );
    } else if (availableOnlyText === 'true') {
      conditions.push({
        availableSlots: {
          $gt: 0,
        },
      });
    }
  }

  const createdAtCondition = {};
  let fromDate = null;
  let toDate = null;

  if (fromDateText) {
    fromDate = parseDate(fromDateText);

    if (!fromDate) {
      errors.push(
        'The starting date must use the YYYY-MM-DD format.'
      );
    } else {
      createdAtCondition.$gte = fromDate;
    }
  }

  if (toDateText) {
    toDate = parseDate(toDateText, true);

    if (!toDate) {
      errors.push(
        'The ending date must use the YYYY-MM-DD format.'
      );
    } else {
      createdAtCondition.$lte = toDate;
    }
  }

  if (
    fromDate &&
    toDate &&
    fromDate.getTime() > toDate.getTime()
  ) {
    errors.push(
      'The starting date cannot be later than the ending date.'
    );
  }

  if (
    Object.keys(createdAtCondition).length > 0
  ) {
    conditions.push({
      createdAt: createdAtCondition,
    });
  }

  let resultLimit = null;

  if (limitText) {
    const parsedLimit = Number(limitText);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      errors.push(
        'The result limit must be between 1 and 50.'
      );
    } else {
      resultLimit = parsedLimit;
    }
  }

  const sortingOptions = {
    latest: {
      createdAt: -1,
      _id: -1,
    },
    oldest: {
      createdAt: 1,
      _id: 1,
    },
    'price-low': {
      price: 1,
      createdAt: -1,
    },
    'price-high': {
      price: -1,
      createdAt: -1,
    },
    'rating-high': {
      review: -1,
      createdAt: -1,
    },
  };

  if (!sortingOptions[sortText]) {
    errors.push(
      'The selected sorting option is invalid.'
    );
  }

  let databaseQuery = {};

  if (conditions.length === 1) {
    databaseQuery = conditions[0];
  }

  if (conditions.length > 1) {
    databaseQuery = {
      $and: conditions,
    };
  }

  return {
    databaseQuery,
    errors,
    resultLimit,
    sortName: sortText,
    sortQuery:
      sortingOptions[sortText] ||
      sortingOptions.latest,
  };
};

tutorRouter.get('/', async (request, response, next) => {
  try {
    const {
      databaseQuery,
      errors,
      resultLimit,
      sortName,
      sortQuery,
    } = buildTutorQuery(request.query);

    if (errors.length > 0) {
      response.status(400).json({
        success: false,
        message:
          'Some search options are invalid.',
        errors,
      });

      return;
    }

    const tutorsCollection =
      getDatabase().collection('tutors');

    let tutorsCursor = tutorsCollection
      .find(databaseQuery)
      .sort(sortQuery);

    if (resultLimit) {
      tutorsCursor = tutorsCursor.limit(resultLimit);
    }

    const [total, tutors] = await Promise.all([
      tutorsCollection.countDocuments(
        databaseQuery
      ),
      tutorsCursor.toArray(),
    ]);

    response.status(200).json({
      success: true,
      total,
      count: tutors.length,
      limit: resultLimit,
      sort: sortName,
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