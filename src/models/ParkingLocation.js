import mongoose from 'mongoose';

const parkingLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    totalSpots: {
      type: Number,
      required: true,
      min: 1,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedSpots: {
      type: Number,
      default: 0,
      min: 0,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    dailyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    amenities: [String],
    operatingHours: {
      open: String, // HH:MM format
      close: String, // HH:MM format
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export const ParkingLocation = mongoose.model(
  'ParkingLocation',
  parkingLocationSchema
);
