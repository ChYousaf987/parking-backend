import { Session } from '../models/Session.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { ParkingLocation } from '../models/ParkingLocation.js';
import { User } from '../models/User.js';
import {
  generateEntryQRCode,
  generateExitQRCode,
  generateGateQRCode,
  parseQRCode,
} from '../services/qrcode.service.js';
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
      const { locationId } = req.body;

      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      const gateQR = await generateGateQRCode(locationId, location.name);

      res.status(200).json({
        message: 'Gate QR code generated',
        qr: gateQR,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Start parking session by scanning gate QR
  startSessionFromGateQR: async (req, res) => {
    try {
      const { userId, vehicleId, qrData } = req.body;

      if (!userId || !vehicleId || !qrData) {
        return res
          .status(400)
          .json({ message: 'userId, vehicleId and qrData are required' });
      }

      const parsed = parseQRCode(qrData);
      if (!parsed || parsed.type !== 'gate' || !parsed.locationId) {
        return res.status(400).json({ message: 'Invalid gate QR code' });
      }

      const locationId = parsed.locationId;
      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      const spot = await ParkingSpot.findOne({
        locationId,
        status: 'available',
      });

      if (!spot) {
        return res
          .status(400)
          .json({ message: 'No free parking spots available' });
      }

      spot.status = 'occupied';
      spot.lastUpdated = new Date();
      spot.occupiedBy = null;
      await spot.save();

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
        allocatedSpot: spot,
        exitQR,
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
      const { sessionId, paymentMethodId } = req.body;

      const session = await Session.findById(sessionId).populate('userId');
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const exitTime = new Date();
      const durationMinutes = Math.ceil(
        (exitTime - session.entryTime) / (1000 * 60)
      );

      // Get location for pricing
      const location = await ParkingLocation.findById(session.locationId);
      const hourlyRate = location?.hourlyRate || 50;
      const totalCost = (durationMinutes / 60) * hourlyRate;

      // Create Stripe payment intent
      let paymentIntentId = null;
      try {
        const user = await User.findById(session.userId);
        if (user?.stripeCustomerId) {
          const paymentIntent = await stripeService.createPaymentIntent(
            user.stripeCustomerId,
            totalCost,
            session._id.toString(),
            `Parking Session - Slot ${session.parkingSpotId}`
          );
          paymentIntentId = paymentIntent.id;
        }
      } catch (paymentError) {
        console.error('Payment intent creation failed:', paymentError);
      }

      // Update session
      session.exitTime = exitTime;
      session.duration = durationMinutes;
      session.cost = totalCost;
      session.status = 'completed';
      session.paymentStatus = paymentIntentId ? 'pending' : 'failed';

      await session.save();

      // Update spot to available
      await ParkingSpot.findByIdAndUpdate(session.parkingSpotId, {
        status: 'available',
        lastUpdated: new Date(),
        occupiedBy: null,
      });

      // Update location occupancy
      const occupiedCount = await ParkingSpot.countDocuments({
        locationId: session.locationId,
        status: 'occupied',
      });

      await ParkingLocation.findByIdAndUpdate(session.locationId, {
        currentOccupancy: occupiedCount,
      });

      res.status(200).json({
        message: 'Parking session ended',
        session,
        paymentIntentId,
        cost: totalCost,
        duration: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
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

      // Confirm with Stripe
      try {
        const paymentIntent = await stripeService.confirmPayment(
          paymentIntentId,
          paymentMethodId
        );

        if (paymentIntent.status === 'succeeded') {
          session.paymentStatus = 'completed';
          session.paymentMethod = 'card';
          await session.save();

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
