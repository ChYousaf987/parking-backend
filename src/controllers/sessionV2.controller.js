import { Session } from '../models/Session.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { ParkingLocation } from '../models/ParkingLocation.js';
import { User } from '../models/User.js';
import {
  generateEntryQRCode,
  generateExitQRCode,
  generateGateQRCode,
  parseQRCode,
  parseAndVerifyGateQRCode,
} from '../services/qrcode.service.js';
import { Vehicle } from '../models/Vehicle.js';
import { stripeService } from '../services/stripe.service.js';

export const sessionControllerV2 = {
  // Generate Entry QR Code
  generateEntryQR: async (req, res) => {
    try {
      const { parkingSpotId, locationId } = req.body;

      // Get parking spot details
      const spot = await ParkingSpot.findById(parkingSpotId);
      if (!spot) {
        return res.status(404).json({ message: 'Parking spot not found' });
      }

      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      // Generate Entry QR Code
      const entryQR = await generateEntryQRCode(
        parkingSpotId,
        spot.spotNumber,
        spot.floor,
        location.name
      );

      res.status(200).json({
        message: 'Entry QR code generated',
        qr: entryQR,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Generate static Gate QR for entrance
  generateGateQR: async (req, res) => {
    try {
      const { locationId, gateType = 'entry' } = req.body;

      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      const gateQR = await generateGateQRCode(
        locationId,
        location.name,
        gateType
      );

      res.status(200).json({
        message: `${gateType} gate QR code generated`,
        qr: gateQR,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Start parking session by scanning gate QR
  startSessionFromGateQR: async (req, res) => {
    try {
      const { vehicleId, qrData } = req.body;
      const userId = req.user._id;

      if (!vehicleId || !qrData) {
        return res
          .status(400)
          .json({ message: 'vehicleId and qrData are required' });
      }

      let parsed;
      try {
        parsed = parseAndVerifyGateQRCode(qrData);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      if (parsed.gateType !== 'entry') {
        return res.status(400).json({ message: 'Invalid gate QR code' });
      }

      const vehicle = await Vehicle.findOne({ _id: vehicleId, userId });
      if (!vehicle) {
        return res
          .status(403)
          .json({ message: 'This vehicle does not belong to you' });
      }

      const existingSession = await Session.findOne({
        userId,
        status: 'active',
      });
      if (existingSession) {
        return res
          .status(409)
          .json({ message: 'You already have an active parking session' });
      }

      const locationId = parsed.locationId;
      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      // Atomic allocation prevents two scans from receiving the same slot.
      const spot = await ParkingSpot.findOneAndUpdate(
        { locationId, status: 'available' },
        { status: 'occupied', lastUpdated: new Date() },
        { new: true, sort: { floor: 1, section: 1, spotNumber: 1 } }
      );

      if (!spot) {
        return res
          .status(400)
          .json({ message: 'No free parking spots available' });
      }

      const session = new Session({
        userId,
        vehicleId,
        parkingSpotId: spot._id,
        locationId,
        entryTime: new Date(),
        status: 'active',
        paymentStatus: 'pending',
      });

      await session.save();
      await ParkingSpot.findByIdAndUpdate(spot._id, {
        occupiedBy: session._id,
      });

      const exitQR = await generateExitQRCode(
        session._id,
        spot.spotNumber,
        spot.floor,
        location.name
      );

      const occupiedCount = await ParkingSpot.countDocuments({
        locationId,
        status: 'occupied',
      });

      await ParkingLocation.findByIdAndUpdate(locationId, {
        currentOccupancy: occupiedCount,
      });

      res.status(201).json({
        message: 'Parking session started via gate scan',
        session,
        allocatedSpot: {
          id: spot._id,
          number: spot.spotNumber,
          floor: spot.floor,
          section: spot.section,
        },
        exitQR,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // The exit gate QR only identifies the gate. The logged-in user's active
  // session supplies the vehicle, entry time and assigned parking slot.
  scanExitGateQR: async (req, res) => {
    try {
      const { qrData } = req.body;
      if (!qrData)
        return res.status(400).json({ message: 'qrData is required' });

      let parsed;
      try {
        parsed = parseAndVerifyGateQRCode(qrData);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      if (parsed.gateType !== 'exit') {
        return res
          .status(400)
          .json({ message: 'Please scan the exit gate QR code' });
      }

      const session = await Session.findOne({
        userId: req.user._id,
        status: 'active',
      })
        .populate('parkingSpotId', 'spotNumber floor section')
        .populate('locationId', 'name hourlyRate');
      if (!session) {
        return res
          .status(404)
          .json({ message: 'No active parking session found' });
      }
      if (session.locationId._id.toString() !== parsed.locationId) {
        return res
          .status(400)
          .json({ message: 'This exit gate is for another parking location' });
      }

      const exitTime = new Date();
      const durationMinutes = Math.max(
        1,
        Math.ceil((exitTime - session.entryTime) / 60000)
      );
      const hourlyRate = session.locationId.hourlyRate;
      const cost = Math.ceil((durationMinutes / 60) * hourlyRate);

      session.exitTime = exitTime;
      session.duration = durationMinutes;
      session.cost = cost;
      await session.save();

      return res.status(200).json({
        message: 'Parking bill calculated',
        sessionId: session._id,
        parkingSpot: session.parkingSpotId,
        invoice: {
          location: session.locationId.name,
          entryTime: session.entryTime,
          exitTime,
          durationMinutes,
          hourlyRate,
          amount: cost,
          currency: 'PKR',
          paymentStatus: 'pending',
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Start parking session (scan entry QR)
  startSessionWithQR: async (req, res) => {
    try {
      const { userId, vehicleId, parkingSpotId, locationId, qrData } = req.body;

      // Validate parking spot availability
      const spot = await ParkingSpot.findById(parkingSpotId);
      if (!spot || spot.status !== 'available') {
        return res
          .status(400)
          .json({ message: 'Parking spot is not available' });
      }

      // Update spot status
      spot.status = 'occupied';
      spot.lastUpdated = new Date();
      await spot.save();

      // Create session
      const session = new Session({
        userId,
        vehicleId,
        parkingSpotId,
        locationId,
        entryTime: new Date(),
        status: 'active',
        paymentStatus: 'pending',
      });

      await session.save();

      // Generate exit QR code
      const exitQR = await generateExitQRCode(
        session._id,
        spot.spotNumber,
        spot.floor,
        'Parking Location'
      );

      // Update location occupancy
      const occupiedCount = await ParkingSpot.countDocuments({
        locationId,
        status: 'occupied',
      });

      await ParkingLocation.findByIdAndUpdate(locationId, {
        currentOccupancy: occupiedCount,
      });

      res.status(201).json({
        message: 'Parking session started',
        session,
        exitQR,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // End parking session (scan exit QR)
  endSessionWithQR: async (req, res) => {
    try {
      const { sessionId } = req.body;

      const session = await Session.findById(sessionId).populate('userId');
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      if (session.userId._id.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: 'This parking session does not belong to you' });
      }
      if (session.status !== 'active') {
        return res
          .status(400)
          .json({ message: 'This parking session is already closed' });
      }

      const exitTime = session.exitTime || new Date();
      const durationMinutes =
        session.duration ??
        Math.max(1, Math.ceil((exitTime - session.entryTime) / (1000 * 60)));

      const location = await ParkingLocation.findById(session.locationId);
      const hourlyRate = location?.hourlyRate || 50;
      const totalCost =
        session.cost ?? Math.ceil((durationMinutes / 60) * hourlyRate);

      let paymentIntentId = null;
      let clientSecret = null;
      let paymentIntentError = null;
      let paymentIntent = null;
      try {
        const userId = session.userId?._id || session.userId;
        const user = await User.findById(userId);
        if (user) {
          if (!user.stripeCustomerId) {
            try {
              const stripeCustomer = await stripeService.createCustomer(
                user.email,
                `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
                  user.email,
                user.phone
              );
              user.stripeCustomerId = stripeCustomer.id;
              await user.save();
            } catch (stripeCustomerError) {
              console.error(
                'Stripe customer creation failed:',
                stripeCustomerError
              );
              paymentIntentError = stripeCustomerError.message;
            }
          }

          if (user.stripeCustomerId) {
            paymentIntent = await stripeService.createPaymentIntent(
              user.stripeCustomerId,
              totalCost,
              session._id.toString(),
              `Parking Session - Slot ${session.parkingSpotId}`
            );
            paymentIntentId = paymentIntent.id;
            clientSecret = paymentIntent.client_secret;
          }
        }
      } catch (paymentError) {
        console.error('Payment intent creation failed:', paymentError);
        paymentIntentError = paymentError.message;
      }

      session.exitTime = exitTime;
      session.duration = durationMinutes;
      session.cost = totalCost;
      // Keep the slot occupied until payment succeeds. It is released by
      // confirmPayment after Stripe confirms the charge.
      session.status = 'active';
      session.paymentStatus = paymentIntentId ? 'pending' : 'failed';
      session.paymentIntentId = paymentIntentId;

      await session.save();

      res.status(200).json({
        message: 'Parking session ended',
        session,
        paymentIntentId,
        clientSecret,
        cost: totalCost,
        currency: 'PKR',
        duration: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
        paymentIntentError,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Confirm payment
  confirmPayment: async (req, res) => {
    try {
      const { sessionId, paymentIntentId, paymentMethodId } = req.body;

      // Get session
      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      if (session.userId.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: 'This parking session does not belong to you' });
      }
      if (
        !session.paymentIntentId ||
        session.paymentIntentId !== paymentIntentId
      ) {
        return res
          .status(400)
          .json({ message: 'Payment intent does not match this session' });
      }

      try {
        let paymentIntent;
        if (paymentMethodId) {
          paymentIntent = await stripeService.confirmPayment(
            paymentIntentId,
            paymentMethodId
          );
        } else {
          paymentIntent = await stripeService.getPaymentStatus(paymentIntentId);
        }

        if (paymentIntent.status === 'succeeded') {
          session.paymentStatus = 'completed';
          session.paymentMethod = 'card';
          session.status = 'completed';
          await session.save();

          await ParkingSpot.findByIdAndUpdate(session.parkingSpotId, {
            status: 'available',
            occupiedBy: null,
            lastUpdated: new Date(),
          });
          const occupiedCount = await ParkingSpot.countDocuments({
            locationId: session.locationId,
            status: 'occupied',
          });
          await ParkingLocation.findByIdAndUpdate(session.locationId, {
            currentOccupancy: occupiedCount,
          });

          res.status(200).json({
            message: 'Payment successful',
            session,
          });
        } else {
          res.status(400).json({
            message: 'Payment failed',
            status: paymentIntent.status,
          });
        }
      } catch (stripeError) {
        session.paymentStatus = 'failed';
        await session.save();

        res.status(400).json({
          message: 'Payment processing failed',
          error: stripeError.message,
        });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get available slots
  getAvailableSlots: async (req, res) => {
    try {
      const { locationId } = req.params;

      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      const availableSpots = await ParkingSpot.find({
        locationId,
        status: 'available',
      }).select('spotNumber floor section');

      const groupedByFloor = availableSpots.reduce((acc, spot) => {
        if (!acc[spot.floor]) {
          acc[spot.floor] = [];
        }
        acc[spot.floor].push({
          id: spot._id,
          spotNumber: spot.spotNumber,
          section: spot.section,
        });
        return acc;
      }, {});

      res.status(200).json({
        location: {
          id: location._id,
          name: location.name,
          totalSpots: location.totalSpots,
          occupiedSpots: location.currentOccupancy,
          availableSpots: availableSpots.length,
        },
        floors: groupedByFloor,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Delete all active sessions for every user and free their spots
  deleteAllActiveSessions: async (req, res) => {
    try {
      const activeSessions = await Session.find({ status: 'active' }).select(
        '_id parkingSpotId locationId userId'
      );

      if (activeSessions.length === 0) {
        return res.status(200).json({
          message: 'No active sessions found',
          deletedCount: 0,
          freedSpots: 0,
        });
      }

      const sessionIds = activeSessions.map(s => s._id);
      const spotIds = [
        ...new Set(
          activeSessions.map(s => s.parkingSpotId?.toString()).filter(Boolean)
        ),
      ];
      const locationIds = [
        ...new Set(
          activeSessions.map(s => s.locationId?.toString()).filter(Boolean)
        ),
      ];

      if (spotIds.length > 0) {
        await ParkingSpot.updateMany(
          { _id: { $in: spotIds } },
          {
            $set: {
              status: 'available',
              occupiedBy: null,
              lastUpdated: new Date(),
            },
          }
        );
      }

      const deleteResult = await Session.deleteMany({
        _id: { $in: sessionIds },
      });

      for (const locationId of locationIds) {
        const occupiedCount = await ParkingSpot.countDocuments({
          locationId,
          status: 'occupied',
        });
        await ParkingLocation.findByIdAndUpdate(locationId, {
          currentOccupancy: occupiedCount,
        });
      }

      res.status(200).json({
        message: 'All active sessions deleted',
        deletedCount: deleteResult.deletedCount,
        freedSpots: spotIds.length,
        affectedLocations: locationIds.length,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get parking history
  getParkingHistory: async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 10, skip = 0 } = req.query;

      const sessions = await Session.find({ userId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('parkingSpotId', 'spotNumber floor')
        .populate('locationId', 'name');

      const total = await Session.countDocuments({ userId });

      res.status(200).json({
        sessions,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get session details
  getSessionDetails: async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('userId', 'firstName lastName email phone')
        .populate('vehicleId', 'licensePlate vehicleType model')
        .populate('parkingSpotId', 'spotNumber floor section')
        .populate('locationId', 'name address');

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.status(200).json(session);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
