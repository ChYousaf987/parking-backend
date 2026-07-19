import { Session } from '../models/Session.js';
import { ParkingLocation } from '../models/ParkingLocation.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { User } from '../models/User.js';

export const dashboardController = {
  // Get dashboard overview stats
  getDashboardStats: async (req, res) => {
    try {
      const stats = {};

      // Parking Locations Stats
      const locations = await ParkingLocation.find();
      const totalLocations = locations.length;

      let totalSpots = 0;
      let totalOccupied = 0;
      let totalReserved = 0;

      for (const location of locations) {
        totalSpots += location.totalSpots;
        totalOccupied += location.currentOccupancy;
        totalReserved += location.reservedSpots;
      }

      const totalAvailable = totalSpots - totalOccupied - totalReserved;
      const occupancyPercentage =
        totalSpots > 0 ? ((totalOccupied / totalSpots) * 100).toFixed(2) : 0;

      // Session Stats
      const activeSessions = await Session.countDocuments({
        status: 'active',
      });
      const completedSessions = await Session.countDocuments({
        status: 'completed',
      });
      const pendingSessions = await Session.countDocuments({
        status: 'pending',
      });

      // Revenue calculation
      const completedSessionsData = await Session.find({
        status: 'completed',
      });
      const totalRevenue = completedSessionsData.reduce(
        (sum, session) => sum + session.cost,
        0
      );

      // Traffic by vehicle type
      const trafficByType = await Session.aggregate([
        {
          $match: { status: 'completed' },
        },
        {
          $lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle',
          },
        },
        {
          $unwind: '$vehicle',
        },
        {
          $group: {
            _id: '$vehicle.vehicleType',
            count: { $sum: 1 },
          },
        },
      ]);

      // Top locations by occupancy
      const topLocations = locations
        .sort((a, b) => b.currentOccupancy - a.currentOccupancy)
        .slice(0, 5)
        .map(loc => ({
          name: loc.name,
          occupancy: loc.currentOccupancy,
          total: loc.totalSpots,
          percentage: ((loc.currentOccupancy / loc.totalSpots) * 100).toFixed(
            2
          ),
        }));

      stats.overview = {
        totalLocations,
        totalSpots,
        occupiedSpots: totalOccupied,
        reservedSpots: totalReserved,
        availableSpots: totalAvailable,
        occupancyPercentage,
      };

      stats.sessions = {
        active: activeSessions,
        completed: completedSessions,
        pending: pendingSessions,
        total: activeSessions + completedSessions + pendingSessions,
      };

      stats.revenue = {
        total: totalRevenue.toFixed(2),
        average:
          completedSessions > 0
            ? (totalRevenue / completedSessions).toFixed(2)
            : 0,
      };

      stats.trafficByType = trafficByType;
      stats.topLocations = topLocations;

      res.status(200).json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get sessions for dashboard
  getDashboardSessions: async (req, res) => {
    try {
      const sessions = await Session.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'firstName lastName')
        .populate('vehicleId', 'licensePlate vehicleType')
        .populate('locationId', 'name')
        .populate('parkingSpotId', 'spotNumber');

      const formattedSessions = sessions.map(session => ({
        id: session._id,
        name: `${session.userId?.firstName} ${session.userId?.lastName}`,
        plate: session.vehicleId?.licensePlate,
        carType: session.vehicleId?.vehicleType?.toUpperCase(),
        location: session.locationId?.name,
        spotNumber: session.parkingSpotId?.spotNumber,
        entryTime: session.entryTime,
        duration: session.duration
          ? `${Math.floor(session.duration / 60)}h, ${session.duration % 60}m`
          : 'ongoing',
        status: session.status,
        cost: session.cost,
      }));

      res.status(200).json(formattedSessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get daily revenue
  getDailyRevenue: async (req, res) => {
    try {
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const revenue = await Session.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: last30Days },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            dailyRevenue: { $sum: '$cost' },
            sessionsCount: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      res.status(200).json(revenue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get analytics
  getAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const query = { status: 'completed' };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const sessions = await Session.find(query);

      const analytics = {
        totalSessions: sessions.length,
        totalRevenue: sessions.reduce((sum, s) => sum + s.cost, 0).toFixed(2),
        averageSessionDuration:
          sessions.length > 0
            ? (
                sessions.reduce((sum, s) => sum + s.duration, 0) /
                sessions.length
              ).toFixed(2)
            : 0,
        averageCost:
          sessions.length > 0
            ? (
                sessions.reduce((sum, s) => sum + s.cost, 0) / sessions.length
              ).toFixed(2)
            : 0,
        byPaymentMethod: await Session.aggregate([
          {
            $match: query,
          },
          {
            $group: {
              _id: '$paymentMethod',
              count: { $sum: 1 },
            },
          },
        ]),
      };

      res.status(200).json(analytics);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
