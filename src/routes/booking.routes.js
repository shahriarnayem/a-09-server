import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

const getTutorsCollection = () =>
  getDatabase().collection('tutors');

const getBookingsCollection = () =>
  getDatabase().collection('bookings');

router.post('/', verifyToken, async (request, response) => {
  const { tutorId } = request.body || {};

  if (!tutorId || !ObjectId.isValid(tutorId)) {
    return response.status(400).json({
      success: false,
      message: 'The selected tutor is not valid.',
    });
  }

  const tutorObjectId = new ObjectId(tutorId);
  const tutorsCollection = getTutorsCollection();
  const bookingsCollection =
    getBookingsCollection();

  let slotWasReduced = false;

  try {
    const tutor = await tutorsCollection.findOne({
      _id: tutorObjectId,
    });

    if (!tutor) {
      return response.status(404).json({
        success: false,
        message: 'The tutor profile was not found.',
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

    if (
      !Number.isFinite(Number(tutor.availableSlots)) ||
      Number(tutor.availableSlots) <= 0
    ) {
      return response.status(409).json({
        success: false,
        message:
          'This tutor does not have any available sessions.',
      });
    }

    const currentTime = new Date();

    const slotUpdateResult =
      await tutorsCollection.updateOne(
        {
          _id: tutorObjectId,
          availableSlots: {
            $gt: 0,
          },
        },
        {
          $inc: {
            availableSlots: -1,
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
          'This session is no longer available.',
      });
    }

    slotWasReduced = true;

    const booking = {
      tutorId: tutorObjectId,
      tutorName: tutor.name,
      tutorImage: tutor.image,
      language: tutor.language,
      price: Number(tutor.price),
      review: Number(tutor.review),
      bookedByUid: request.auth.uid,
      email: request.auth.email,
      status: 'booked',
      bookedAt: currentTime,
      updatedAt: currentTime,
    };

    try {
      const bookingResult =
        await bookingsCollection.insertOne(
          booking
        );

      const updatedTutor =
        await tutorsCollection.findOne({
          _id: tutorObjectId,
        });

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
      await tutorsCollection.updateOne(
        {
          _id: tutorObjectId,
        },
        {
          $inc: {
            availableSlots: 1,
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      );

      slotWasReduced = false;

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
              availableSlots: 1,
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

    console.error('Unable to create booking:', error);

    return response.status(500).json({
      success: false,
      message:
        'Your session could not be booked.',
    });
  }
});

export default router;