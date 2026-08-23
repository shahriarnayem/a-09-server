import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

const getTutorsCollection = () =>
  getDatabase().collection('tutors');

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateObjectId = (id) =>
  ObjectId.isValid(id);

router.post('/', verifyToken, async (request, response) => {
  try {
    const {
      name,
      image,
      language,
      price,
      review,
      description,
      availableSlots,
    } = request.body;

    if (
      !name?.trim() ||
      !image?.trim() ||
      !language?.trim() ||
      !description?.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: 'Please complete all tutor information.',
      });
    }

    const numericPrice = Number(price);
    const numericReview = Number(review);
    const numericSlots = Number(availableSlots);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: 'Please provide a valid session price.',
      });
    }

    if (
      !Number.isFinite(numericReview) ||
      numericReview < 0 ||
      numericReview > 5
    ) {
      return response.status(400).json({
        success: false,
        message: 'The rating must be between 0 and 5.',
      });
    }

    if (
      !Number.isInteger(numericSlots) ||
      numericSlots < 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          'Available sessions must be a whole number.',
      });
    }

    const currentTime = new Date();

    const tutor = {
      name: name.trim(),
      image: image.trim(),
      language: language.trim(),
      price: numericPrice,
      review: numericReview,
      description: description.trim(),
      availableSlots: numericSlots,
      email: request.auth.email,
      ownerUid: request.auth.uid,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const result =
      await getTutorsCollection().insertOne(tutor);

    return response.status(201).json({
      success: true,
      message:
        'The tutor profile has been added successfully.',
      tutor: {
        _id: result.insertedId,
        ...tutor,
      },
    });
  } catch (error) {
    console.error('Unable to add tutor:', error);

    return response.status(500).json({
      success: false,
      message:
        'The tutor profile could not be added.',
    });
  }
});

router.get('/', async (request, response) => {
  try {
    const {
      search,
      language,
      minPrice,
      maxPrice,
      minReview,
      availableOnly,
      fromDate,
      toDate,
      sort = 'latest',
      limit,
    } = request.query;

    const query = {};

    if (search?.trim()) {
      query.name = {
        $regex: escapeRegex(search.trim()),
        $options: 'i',
      };
    }

    if (language?.trim()) {
      query.language = {
        $regex: `^${escapeRegex(
          language.trim()
        )}$`,
        $options: 'i',
      };
    }

    if (
      minPrice !== undefined ||
      maxPrice !== undefined
    ) {
      query.price = {};

      if (minPrice !== undefined) {
        const numericMinPrice = Number(minPrice);

        if (
          !Number.isFinite(numericMinPrice) ||
          numericMinPrice < 0
        ) {
          return response.status(400).json({
            success: false,
            message:
              'Minimum price must be a valid number.',
          });
        }

        query.price.$gte = numericMinPrice;
      }

      if (maxPrice !== undefined) {
        const numericMaxPrice = Number(maxPrice);

        if (
          !Number.isFinite(numericMaxPrice) ||
          numericMaxPrice < 0
        ) {
          return response.status(400).json({
            success: false,
            message:
              'Maximum price must be a valid number.',
          });
        }

        query.price.$lte = numericMaxPrice;
      }

      if (
        query.price.$gte !== undefined &&
        query.price.$lte !== undefined &&
        query.price.$gte > query.price.$lte
      ) {
        return response.status(400).json({
          success: false,
          message:
            'Minimum price cannot be greater than maximum price.',
        });
      }
    }

    if (minReview !== undefined) {
      const numericMinReview = Number(minReview);

      if (
        !Number.isFinite(numericMinReview) ||
        numericMinReview < 0 ||
        numericMinReview > 5
      ) {
        return response.status(400).json({
          success: false,
          message:
            'Minimum rating must be between 0 and 5.',
        });
      }

      query.review = {
        $gte: numericMinReview,
      };
    }

    if (availableOnly === 'true') {
      query.availableSlots = {
        $gt: 0,
      };
    }

    if (fromDate || toDate) {
      query.createdAt = {};

      if (fromDate) {
        const startDate = new Date(
          `${fromDate}T00:00:00.000Z`
        );

        if (Number.isNaN(startDate.getTime())) {
          return response.status(400).json({
            success: false,
            message:
              'Please provide a valid starting date.',
          });
        }

        query.createdAt.$gte = startDate;
      }

      if (toDate) {
        const endDate = new Date(
          `${toDate}T23:59:59.999Z`
        );

        if (Number.isNaN(endDate.getTime())) {
          return response.status(400).json({
            success: false,
            message:
              'Please provide a valid ending date.',
          });
        }

        query.createdAt.$lte = endDate;
      }

      if (
        query.createdAt.$gte &&
        query.createdAt.$lte &&
        query.createdAt.$gte >
          query.createdAt.$lte
      ) {
        return response.status(400).json({
          success: false,
          message:
            'Starting date cannot be after ending date.',
        });
      }
    }

    const sortingOptions = {
      latest: {
        createdAt: -1,
      },
      oldest: {
        createdAt: 1,
      },
      'price-low': {
        price: 1,
      },
      'price-high': {
        price: -1,
      },
      'rating-high': {
        review: -1,
      },
    };

    const selectedSort =
      sortingOptions[sort] || sortingOptions.latest;

    let selectedLimit = null;

    if (limit !== undefined) {
      const numericLimit = Number.parseInt(limit, 10);

      if (
        !Number.isInteger(numericLimit) ||
        numericLimit < 1
      ) {
        return response.status(400).json({
          success: false,
          message:
            'The result limit must be a positive number.',
        });
      }

      selectedLimit = Math.min(numericLimit, 50);
    }

    const tutorsCollection =
      getTutorsCollection();

    const total =
      await tutorsCollection.countDocuments(query);

    let tutorsCursor = tutorsCollection
      .find(query)
      .sort(selectedSort);

    if (selectedLimit) {
      tutorsCursor =
        tutorsCursor.limit(selectedLimit);
    }

    const tutors = await tutorsCursor.toArray();

    return response.status(200).json({
      success: true,
      total,
      count: tutors.length,
      limit: selectedLimit,
      sort:
        sortingOptions[sort] !== undefined
          ? sort
          : 'latest',
      tutors,
    });
  } catch (error) {
    console.error('Unable to load tutors:', error);

    return response.status(500).json({
      success: false,
      message:
        'The tutor profiles could not be loaded.',
    });
  }
});

router.get('/:id', async (request, response) => {
  try {
    const { id } = request.params;

    if (!validateObjectId(id)) {
      return response.status(400).json({
        success: false,
        message: 'The tutor ID is not valid.',
      });
    }

    const tutor =
      await getTutorsCollection().findOne({
        _id: new ObjectId(id),
      });

    if (!tutor) {
      return response.status(404).json({
        success: false,
        message: 'The tutor profile was not found.',
      });
    }

    return response.status(200).json({
      success: true,
      tutor,
    });
  } catch (error) {
    console.error('Unable to load tutor:', error);

    return response.status(500).json({
      success: false,
      message:
        'The tutor profile could not be loaded.',
    });
  }
});

router.patch(
  '/:id',
  verifyToken,
  async (request, response) => {
    try {
      const { id } = request.params;

      if (!validateObjectId(id)) {
        return response.status(400).json({
          success: false,
          message: 'The tutor ID is not valid.',
        });
      }

      const tutorId = new ObjectId(id);
      const tutorsCollection =
        getTutorsCollection();

      const existingTutor =
        await tutorsCollection.findOne({
          _id: tutorId,
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
            'You cannot update this tutor profile.',
        });
      }

      const updateData = {};
      const body = request.body || {};

      const stringFields = [
        'name',
        'image',
        'language',
        'description',
      ];

      for (const field of stringFields) {
        if (
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
        ) {
          if (
            typeof body[field] !== 'string' ||
            !body[field].trim()
          ) {
            return response.status(400).json({
              success: false,
              message: `${field} cannot be empty.`,
            });
          }

          updateData[field] = body[field].trim();
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          'price'
        )
      ) {
        const numericPrice = Number(body.price);

        if (
          !Number.isFinite(numericPrice) ||
          numericPrice <= 0
        ) {
          return response.status(400).json({
            success: false,
            message:
              'Please provide a valid session price.',
          });
        }

        updateData.price = numericPrice;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          'review'
        )
      ) {
        const numericReview = Number(body.review);

        if (
          !Number.isFinite(numericReview) ||
          numericReview < 0 ||
          numericReview > 5
        ) {
          return response.status(400).json({
            success: false,
            message:
              'The rating must be between 0 and 5.',
          });
        }

        updateData.review = numericReview;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          body,
          'availableSlots'
        )
      ) {
        const numericSlots = Number(
          body.availableSlots
        );

        if (
          !Number.isInteger(numericSlots) ||
          numericSlots < 0
        ) {
          return response.status(400).json({
            success: false,
            message:
              'Available sessions must be a whole number.',
          });
        }

        updateData.availableSlots =
          numericSlots;
      }

      if (Object.keys(updateData).length === 0) {
        return response.status(400).json({
          success: false,
          message:
            'Please provide at least one field to update.',
        });
      }

      updateData.updatedAt = new Date();

      await tutorsCollection.updateOne(
        {
          _id: tutorId,
          ownerUid: request.auth.uid,
        },
        {
          $set: updateData,
        }
      );

      const updatedTutor =
        await tutorsCollection.findOne({
          _id: tutorId,
        });

      return response.status(200).json({
        success: true,
        message:
          'The tutor profile has been updated successfully.',
        tutor: updatedTutor,
      });
    } catch (error) {
      console.error('Unable to update tutor:', error);

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be updated.',
      });
    }
  }
);

router.delete(
  '/:id',
  verifyToken,
  async (request, response) => {
    try {
      const { id } = request.params;

      if (!validateObjectId(id)) {
        return response.status(400).json({
          success: false,
          message: 'The tutor ID is not valid.',
        });
      }

      const tutorId = new ObjectId(id);
      const tutorsCollection =
        getTutorsCollection();

      const existingTutor =
        await tutorsCollection.findOne({
          _id: tutorId,
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
            'You cannot delete this tutor profile.',
        });
      }

      await tutorsCollection.deleteOne({
        _id: tutorId,
        ownerUid: request.auth.uid,
      });

      return response.status(200).json({
        success: true,
        message:
          'The tutor profile has been deleted successfully.',
        tutor: existingTutor,
      });
    } catch (error) {
      console.error('Unable to delete tutor:', error);

      return response.status(500).json({
        success: false,
        message:
          'The tutor profile could not be deleted.',
      });
    }
  }
);

export default router;