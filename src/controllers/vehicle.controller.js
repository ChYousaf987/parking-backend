import { Vehicle } from '../models/Vehicle.js';

export const vehicleController = {
  // Add vehicle
  addVehicle: async (req, res) => {
    try {
      const {
        licensePlate,
        registrationNumber,
        vehicleType,
        brand,
        model,
        color,
        year,
        vin,
        registrationExpiry,
        isDefault,
      } = req.body;

      // The existing API documentation uses `registrationNumber`; accept it as
      // an alias for the database field, `licensePlate`.
      const plate = (licensePlate || registrationNumber)?.trim();
      const requiredFields = {
        licensePlate: plate,
        vehicleType,
        brand,
        model,
        color,
        year,
        registrationExpiry,
      };
      const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => value === undefined || value === null || value === '')
        .map(([field]) => field);

      if (missingFields.length > 0) {
        return res.status(400).json({
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      // Check if license plate already exists
      const normalizedPlate = plate.toUpperCase();
      const existingVehicle = await Vehicle.findOne({
        licensePlate: normalizedPlate,
      });
      if (existingVehicle) {
        return res
          .status(400)
          .json({ message: 'Vehicle with this license plate already exists' });
      }

      const vehicle = new Vehicle({
        userId: req.user._id,
        licensePlate: normalizedPlate,
        vehicleType,
        brand,
        model,
        color,
        year,
        vin,
        registrationExpiry,
        isDefault: isDefault || false,
      });

      await vehicle.save();

      res.status(201).json({
        message: 'Vehicle added successfully',
        vehicle,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user vehicles
  getUserVehicles: async (req, res) => {
    try {
      const { userId } = req.params;
      const vehicles = await Vehicle.find({ userId }).sort({ createdAt: -1 });

      res.status(200).json(vehicles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get vehicle by ID
  getVehicleById: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await Vehicle.findById(vehicleId);

      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update vehicle
  updateVehicle: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, req.body, {
        new: true,
      });

      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      res.status(200).json({
        message: 'Vehicle updated successfully',
        vehicle,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Delete vehicle
  deleteVehicle: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await Vehicle.findByIdAndDelete(vehicleId);

      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      res.status(200).json({
        message: 'Vehicle deleted successfully',
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Set default vehicle
  setDefaultVehicle: async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await Vehicle.findById(vehicleId);

      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Remove default from all user's vehicles
      await Vehicle.updateMany(
        { userId: vehicle.userId },
        { isDefault: false }
      );

      // Set this vehicle as default
      vehicle.isDefault = true;
      await vehicle.save();

      res.status(200).json({
        message: 'Default vehicle set successfully',
        vehicle,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
