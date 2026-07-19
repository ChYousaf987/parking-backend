import mongoose from 'mongoose';

const parkingSpotSchema = new mongoose.Schema(
  {
    spotNumber: {
      type: String,
      required: true,
      trim: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance'],
      default: 'available',
    },
    spotType: {
      type: String,
      enum: ['standard', 'compact', 'accessible', 'evcharging'],
      default: 'standard',
    },
    floor: {
      type: Number,
      default: 0,
    },
    section: {
      type: String,
      default: 'A',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    occupiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
  },
  { timestamps: true }
);

export const ParkingSpot = mongoose.model('ParkingSpot', parkingSpotSchema);
