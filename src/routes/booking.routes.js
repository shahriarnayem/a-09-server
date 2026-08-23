import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

const getTutorsCollection = () =>
  getDatabase().collection('tutors');

const getBookingsCollection = () =>
  getDatabase().collection('bookings');

const createSessionToken = () =>
  `MQ-${randomBytes(5)
    .toString('hex')
    .toUpperCase()}`;

const getSlotField = (tutor) => {
  if (
    Object.prototype.hasOwnProperty.call(
      tutor,
      'totalSlot'
    )
  ) {
    return 'totalSlot';
  }

  return 'availableSlots';
};

const getSessionStartDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const normalizedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? `${dateValue}T00:00:00`
      : dateValue;

  const sessionDate = new Date(normalizedDate);

  if (Number.isNaN(sessionDate.getTime())) {
    return null;
  }

  return sessionDate;
};

/*
|--------------------------------------------------------------------------
| Create booking
|--------------------------------------------------------------------------
*/

router.post(
  '/',
  verifyToken,
  async (request, response) => {
    const {
      tutorId,
      studentName,
      phone,
    } = request.body || {};

    if (!tutorId || !ObjectId.isValid(tutorId)) {
      return response.status(400).json({
        success: false,
        message: 'The selected tutor is not valid.',
      });
    }

    if (
      typeof studentName !== 'string' ||
      !studentName.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: 'Please enter the student name.',
      });
    }

    if (
      typeof phone !== 'string' ||
      !phone.trim()
    ) {
      return response.status(400).json({
        success: false,
        message: 'Please enter a phone number.',
      });
    }

    const tutorObjectId = new ObjectId(tutorId);
    const tutorsCollection =
      getTutorsCollection();
    const bookingsCollection =
      getBookingsCollection();

    let slotWasReduced = false;
    let slotField = 'availableSlots';

    try {
      const tutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

      if (!tutor) {
        return response.status(404).json({
          success: false,
          message:
            'The tutor profile was not found.',
        });
      }

      const existingBooking =
        await bookingsCollection.findOne({
          tutorId: tutorObjectId,
          bookedByUid: request.auth.uid,
          status: 'booked',
        });

      if (existingBooking) {
        return response.status(409).json({
          success: false,
          message:
            'You have already booked a session with this tutor.',
        });
      }

      const sessionStartDate =
        getSessionStartDate(
          tutor.sessionStartDate
        );

      if (
        sessionStartDate &&
        Date.now() < sessionStartDate.getTime()
      ) {
        return response.status(409).json({
          success: false,
          message:
            'Booking is not available yet for this tutor',
        });
      }

      slotField = getSlotField(tutor);

      const currentSlots = Number(
        tutor[slotField]
      );

      if (
        !Number.isFinite(currentSlots) ||
        currentSlots <= 0
      ) {
        return response.status(409).json({
          success: false,
          message: 'No available slots left.',
        });
      }

      const currentTime = new Date();

      const slotUpdateResult =
        await tutorsCollection.updateOne(
          {
            _id: tutorObjectId,
            [slotField]: {
              $gt: 0,
            },
          },
          {
            $inc: {
              [slotField]: -1,
            },
            $set: {
              updatedAt: currentTime,
            },
          }
        );

      if (slotUpdateResult.modifiedCount !== 1) {
        return response.status(409).json({
          success: false,
          message:
            'This session is fully booked. You can’t join at the moment.',
        });
      }

      slotWasReduced = true;

      const booking = {
        tutorId: tutorObjectId,
        tutorName: tutor.name,
        tutorImage: tutor.image,
        subject:
          tutor.subject ||
          tutor.category ||
          tutor.language ||
          'General learning',
        hourlyFee: Number(
          tutor.hourlyFee ?? tutor.price ?? 0
        ),
        studentName: studentName.trim(),
        phone: phone.trim(),
        email: request.auth.email,
        bookedByUid: request.auth.uid,
        sessionStartDate:
          tutor.sessionStartDate || null,
        teachingMode:
          tutor.teachingMode || 'Online',
        sessionToken: createSessionToken(),
        status: 'booked',
        bookedAt: currentTime,
        updatedAt: currentTime,
      };

      try {
        const bookingResult =
          await bookingsCollection.insertOne(
            booking
          );

        const updatedTutor = {
          ...tutor,
          [slotField]: currentSlots - 1,
          updatedAt: currentTime,
        };

        return response.status(201).json({
          success: true,
          message:
            'Your session has been booked successfully.',
          booking: {
            _id: bookingResult.insertedId,
            ...booking,
          },
          tutor: updatedTutor,
        });
      } catch (bookingError) {
        try {
          await tutorsCollection.updateOne(
            {
              _id: tutorObjectId,
            },
            {
              $inc: {
                [slotField]: 1,
              },
              $set: {
                updatedAt: new Date(),
              },
            }
          );

          slotWasReduced = false;
        } catch (restoreError) {
          console.error(
            'Unable to restore tutor availability:',
            restoreError
          );
        }

        throw bookingError;
      }
    } catch (error) {
      if (slotWasReduced) {
        try {
          await tutorsCollection.updateOne(
            {
              _id: tutorObjectId,
            },
            {
              $inc: {
                [slotField]: 1,
              },
              $set: {
                updatedAt: new Date(),
              },
            }
          );
        } catch (restoreError) {
          console.error(
            'Unable to restore tutor availability:',
            restoreError
          );
        }
      }

      console.error(
        'Unable to create booking:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'Your session could not be booked.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Get logged-in user's bookings
|--------------------------------------------------------------------------
*/

router.get(
  '/',
  verifyToken,
  async (request, response) => {
    try {
      const bookings =
        await getBookingsCollection()
          .find({
            bookedByUid: request.auth.uid,
          })
          .sort({
            bookedAt: -1,
          })
          .toArray();

      return response.status(200).json({
        success: true,
        total: bookings.length,
        count: bookings.length,
        bookings,
      });
    } catch (error) {
      console.error(
        'Unable to load bookings:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'Your booked sessions could not be loaded.',
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Cancel booking and restore tutor slot
|--------------------------------------------------------------------------
*/

router.patch(
  '/:id/cancel',
  verifyToken,
  async (request, response) => {
    const { id } = request.params;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message: 'The selected booking is not valid.',
      });
    }

    const bookingObjectId = new ObjectId(id);
    const bookingsCollection =
      getBookingsCollection();
    const tutorsCollection =
      getTutorsCollection();

    let bookingWasCancelled = false;

    try {
      const booking =
        await bookingsCollection.findOne({
          _id: bookingObjectId,
          bookedByUid: request.auth.uid,
        });

      if (!booking) {
        return response.status(404).json({
          success: false,
          message:
            'The booked session was not found.',
        });
      }

      if (booking.status === 'cancelled') {
        return response.status(409).json({
          success: false,
          message:
            'This session has already been cancelled.',
        });
      }

      if (
        !booking.tutorId ||
        !ObjectId.isValid(
          String(booking.tutorId)
        )
      ) {
        return response.status(409).json({
          success: false,
          message:
            'The tutor information for this booking is invalid.',
        });
      }

      const tutorObjectId =
        booking.tutorId instanceof ObjectId
          ? booking.tutorId
          : new ObjectId(booking.tutorId);

      const tutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

      if (!tutor) {
        return response.status(404).json({
          success: false,
          message:
            'The tutor profile was not found.',
        });
      }

      const slotField = getSlotField(tutor);
      const currentTime = new Date();

      const cancelResult =
        await bookingsCollection.updateOne(
          {
            _id: bookingObjectId,
            bookedByUid: request.auth.uid,
            status: 'booked',
          },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: currentTime,
              updatedAt: currentTime,
            },
          }
        );

      if (cancelResult.modifiedCount !== 1) {
        return response.status(409).json({
          success: false,
          message:
            'This session could not be cancelled.',
        });
      }

      bookingWasCancelled = true;

      const restoreResult =
        await tutorsCollection.updateOne(
          {
            _id: tutorObjectId,
          },
          {
            $inc: {
              [slotField]: 1,
            },
            $set: {
              updatedAt: currentTime,
            },
          }
        );

      if (restoreResult.modifiedCount !== 1) {
        throw new Error(
          'The tutor slot could not be restored.'
        );
      }

      bookingWasCancelled = false;

      return response.status(200).json({
        success: true,
        message:
          'Your booked session has been cancelled.',
        booking: {
          ...booking,
          status: 'cancelled',
          cancelledAt: currentTime,
          updatedAt: currentTime,
        },
        tutor: {
          ...tutor,
          [slotField]:
            Number(tutor[slotField]) + 1,
          updatedAt: currentTime,
        },
      });
    } catch (error) {
      if (bookingWasCancelled) {
        try {
          await bookingsCollection.updateOne(
            {
              _id: bookingObjectId,
              bookedByUid: request.auth.uid,
              status: 'cancelled',
            },
            {
              $set: {
                status: 'booked',
                updatedAt: new Date(),
              },
            },
            {
              $unset: {
                cancelledAt: '',
              },
            }
          );
        } catch (restoreBookingError) {
          console.error(
            'Unable to restore booking status:',
            restoreBookingError
          );
        }
      }

      console.error(
        'Unable to cancel booking:',
        error
      );

      return response.status(500).json({
        success: false,
        message:
          'Your booked session could not be cancelled.',
      });
    }
  }
);

export default router;