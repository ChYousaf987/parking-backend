import { Session } from '../models/Session.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { ParkingLocation } from '../models/ParkingLocation.js';
import { Vehicle } from '../models/Vehicle.js';

export const sessionController = {
  // Start a parking session
  startSession: async (req, res) => {
    try {
      const { userId, vehicleId, parkingSpotId, locationId, isReserved } =
        req.body;

      // Update spot status to occupied
      const spot = await ParkingSpot.findByIdAndUpdate(
        parkingSpotId,
        { status: 'occupied', lastUpdated: new Date() },
        { new: true }
      );

      if (!spot) {
        return res.status(404).json({ message: 'Parking spot not found' });
      }

      const session = new Session({
        userId,
        vehicleId,
        parkingSpotId,
        locationId,
        entryTime: new Date(),
        status: 'active',
        isReserved: isReserved || false,
        paymentStatus: 'pending',
      });

      await session.save();

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
        session: await session.populate('userId vehicleId parkingSpotId'),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // End a parking session
  endSession: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { paymentMethod } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const exitTime = new Date();
      const durationMinutes = Math.ceil(
        (exitTime - session.entryTime) / (1000 * 60)
      );

      // Calculate cost based on parking location rates
      const location = await ParkingLocation.findById(session.locationId);
      const hourlyRate = location?.hourlyRate || 5;
      const cost = (durationMinutes / 60) * hourlyRate;

      session.exitTime = exitTime;
      session.duration = durationMinutes;
      session.cost = cost;
      session.status = 'completed';
      session.paymentStatus = 'completed';
      session.paymentMethod = paymentMethod || 'cash';

      await session.save();

      // Update spot status to available
      await ParkingSpot.findByIdAndUpdate(parkingSpotId, {
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
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get all sessions
  getAllSessions: async (req, res) => {
    try {
      const sessions = await Session.find()
        .populate('userId', 'firstName lastName email phone')
        .populate('vehicleId', 'licensePlate vehicleType brand model color')
        .populate('parkingSpotId', 'spotNumber floor section')
        .populate('locationId', 'name address');

      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get active sessions
  getActiveSessions: async (req, res) => {
    try {
      const sessions = await Session.find({ status: 'active' })
        .populate('userId', 'firstName lastName email phone')
        .populate('vehicleId', 'licensePlate vehicleType brand model color')
        .populate('parkingSpotId', 'spotNumber floor section')
        .populate('locationId', 'name address');

      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get sessions for a user
  getUserSessions: async (req, res) => {
    try {
      const { userId } = req.params;
      const sessions = await Session.find({ userId })
        .populate('vehicleId', 'licensePlate vehicleType brand model color')
        .populate('parkingSpotId', 'spotNumber floor section')
        .populate('locationId', 'name address');

      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get session by ID
  getSessionById: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await Session.findById(sessionId)
        .populate('userId')
        .populate('vehicleId')
        .populate('parkingSpotId')
        .populate('locationId');

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.status(200).json(session);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Reserve a parking spot
  reserveSpot: async (req, res) => {
    try {
      const { userId, parkingSpotId, locationId, duration } = req.body;

      const session = new Session({
        userId,
        parkingSpotId,
        locationId,
        entryTime: new Date(),
        status: 'pending',
        isReserved: true,
        reservationTime: new Date(),
      });

      await session.save();

      // Update spot status to reserved
      await ParkingSpot.findByIdAndUpdate(parkingSpotId, {
        status: 'reserved',
        lastUpdated: new Date(),
      });

      // Update reserved spots count
      const reservedCount = await ParkingSpot.countDocuments({
        locationId,
        status: 'reserved',
      });

      await ParkingLocation.findByIdAndUpdate(locationId, {
        reservedSpots: reservedCount,
      });

      res.status(201).json({
        message: 'Parking spot reserved',
        session,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // QR Code Entry: Find free slot and start session
  scanQRCodeEntry: async (req, res) => {
    try {
      const { userId, vehicleId, locationId } = req.body;

      // Validate inputs
      if (!userId || !vehicleId || !locationId) {
        return res.status(400).json({
          message: 'userId, vehicleId, and locationId are required',
        });
      }

      // Get location details
      const location = await ParkingLocation.findById(locationId);
      if (!location) {
        return res.status(404).json({ message: 'Parking location not found' });
      }

      // Find first available spot (preferring lower floors)
      const availableSpot = await ParkingSpot.findOne({
        locationId,
        status: 'available',
      }).sort({ floor: 1, section: 1, spotNumber: 1 });

      if (!availableSpot) {
        return res.status(400).json({
          message: 'No available parking spots at this location',
          location: {
            name: location.name,
            totalSpots: location.totalSpots,
            occupiedSpots: location.currentOccupancy,
            availableSpots:
              location.totalSpots -
              location.currentOccupancy -
              location.reservedSpots,
          },
        });
      }

      // Create parking session
      const session = new Session({
        userId,
        vehicleId,
        parkingSpotId: availableSpot._id,
        locationId,
        entryTime: new Date(),
        status: 'active',
        paymentStatus: 'pending',
      });

      await session.save();

      // Update spot status to occupied
      await ParkingSpot.findByIdAndUpdate(availableSpot._id, {
        status: 'occupied',
        occupiedBy: session._id,
        lastUpdated: new Date(),
      });

      // Update location occupancy
      const occupiedCount = await ParkingSpot.countDocuments({
        locationId,
        status: 'occupied',
      });

      await ParkingLocation.findByIdAndUpdate(locationId, {
        currentOccupancy: occupiedCount,
      });

      // Populate and return
      await session.populate([
        { path: 'userId', select: 'firstName lastName email phone' },
        { path: 'vehicleId', select: 'licensePlate vehicleType brand model' },
        { path: 'parkingSpotId', select: 'spotNumber floor section' },
        { path: 'locationId', select: 'name address hourlyRate' },
      ]);

      res.status(201).json({
        message: 'Entry QR scanned successfully',
        session,
        parkingSpot: {
          number: availableSpot.spotNumber,
          floor: availableSpot.floor,
          section: availableSpot.section,
          type: availableSpot.spotType,
        },
        alert: `Parking Assigned! Floor ${availableSpot.floor + 1}, Spot ${availableSpot.spotNumber}`,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // QR Code Exit: End session and calculate cost
  scanQRCodeExit: async (req, res) => {
    try {
      const { userId, paymentMethod } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      // Find active session for user
      const session = await Session.findOne({
        userId,
        status: 'active',
      });

      if (!session) {
        return res.status(404).json({
          message: 'No active parking session found for this user',
        });
      }

      // Calculate parking duration and cost
      const exitTime = new Date();
      const durationMinutes = Math.ceil(
        (exitTime - session.entryTime) / (1000 * 60)
      );

      // Get hourly rate from location
      const location = await ParkingLocation.findById(session.locationId);
      const hourlyRate = location?.hourlyRate || 50; // Default: 50 (or 3 riyal as per user requirement)

      // Cost calculation: (minutes / 60) * hourly rate
      const durationHours = durationMinutes / 60;
      const cost = Math.ceil(durationHours * hourlyRate); // Round up to nearest whole number

      // Update session with exit details
      session.exitTime = exitTime;
      session.duration = durationMinutes;
      session.cost = cost;
      session.status = 'completed';
      session.paymentStatus = 'pending'; // Pending until payment is confirmed
      session.paymentMethod = paymentMethod || 'wallet';

      await session.save();

      // Free up the parking spot
      await ParkingSpot.findByIdAndUpdate(session.parkingSpotId, {
        status: 'available',
        occupiedBy: null,
        lastUpdated: new Date(),
      });

      // Update location occupancy
      const occupiedCount = await ParkingSpot.countDocuments({
        locationId: session.locationId,
        status: 'occupied',
      });

      await ParkingLocation.findByIdAndUpdate(session.locationId, {
        currentOccupancy: occupiedCount,
      });

      // Populate and return
      await session.populate([
        { path: 'userId', select: 'firstName lastName email phone' },
        { path: 'vehicleId', select: 'licensePlate vehicleType brand model' },
        { path: 'parkingSpotId', select: 'spotNumber floor section' },
        { path: 'locationId', select: 'name address hourlyRate' },
      ]);

      res.status(200).json({
        message: 'Exit QR scanned successfully',
        session,
        invoice: {
          entryTime: session.entryTime.toLocaleString(),
          exitTime: exitTime.toLocaleString(),
          duration: {
            minutes: durationMinutes,
            hours: durationHours.toFixed(2),
          },
          rate: `${hourlyRate} per hour`,
          cost: `${cost} Riyal`,
          paymentStatus: 'Pending Payment',
          paymentMethod: paymentMethod || 'Wallet',
        },
        alert: `Thank you! Your parking cost is ${cost} Riyal. Duration: ${durationHours.toFixed(1)} hours`,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
