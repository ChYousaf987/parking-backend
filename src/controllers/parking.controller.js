import { ParkingLocation } from '../models/ParkingLocation.js';
import { ParkingSpot } from '../models/ParkingSpot.js';

export const parkingController = {
  // Create parking location
  createLocation: async (req, res) => {
    try {
      const {
        name,
        address,
        city,
        latitude,
        longitude,
        totalSpots,
        hourlyRate,
        dailyRate,
        monthlyRate,
        amenities,
        operatingHours,
        description,
      } = req.body;

      const location = new ParkingLocation({
        name,
        address,
        city,
        latitude,
        longitude,
        totalSpots,
        hourlyRate,
        dailyRate,
        monthlyRate,
        amenities: amenities || [],
        operatingHours,
        description,
      });

      await location.save();

      // Create parking spots for this location
      const spots = [];
      for (let i = 1; i <= totalSpots; i++) {
        const section = String.fromCharCode(65 + Math.floor((i - 1) / 50)); // A, B, C...
        const spotNumber = `${section}${i % 50 || 50}`;
        spots.push({
          spotNumber,
          locationId: location._id,
          section,
          floor: Math.floor((i - 1) / 50),
        });
      }

      await ParkingSpot.insertMany(spots);

      res.status(201).json({
        message: 'Parking location created successfully',
        location,
      });
    } catch (error) {
      const status = error.name === 'ValidationError' ? 400 : 500;
      res.status(status).json({ message: error.message });
    }
  },

  // Get all locations
  getAllLocations: async (req, res) => {
    try {
      const locations = await ParkingLocation.find();
      res.status(200).json(locations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get single location
  getLocationById: async (req, res) => {
    try {
      const { id } = req.params;
      const location = await ParkingLocation.findById(id);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }
      res.status(200).json(location);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update location
  updateLocation: async (req, res) => {
    try {
      const { id } = req.params;
      const location = await ParkingLocation.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      res.status(200).json({
        message: 'Location updated successfully',
        location,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Delete location
  deleteLocation: async (req, res) => {
    try {
      const { id } = req.params;
      await ParkingLocation.findByIdAndDelete(id);
      await ParkingSpot.deleteMany({ locationId: id });

      res.status(200).json({ message: 'Location deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get parking spots for a location
  getLocationSpots: async (req, res) => {
    try {
      const { locationId } = req.params;
      const spots = await ParkingSpot.find({ locationId });
      res.status(200).json(spots);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update spot status
  updateSpotStatus: async (req, res) => {
    try {
      const { spotId } = req.params;
      const { status } = req.body;

      const spot = await ParkingSpot.findByIdAndUpdate(
        spotId,
        { status, lastUpdated: new Date() },
        { new: true }
      );

      if (!spot) {
        return res.status(404).json({ message: 'Spot not found' });
      }

      // Update location occupancy
      const location = await ParkingLocation.findById(spot.locationId);
      const occupiedCount = await ParkingSpot.countDocuments({
        locationId: spot.locationId,
        status: 'occupied',
      });

      location.currentOccupancy = occupiedCount;
      await location.save();

      res.status(200).json({
        message: 'Spot status updated',
        spot,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
