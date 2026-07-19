import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    parkingSpotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSpot',
      required: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
    },
    entryTime: {
      type: Date,
      required: true,
    },
    exitTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'pending'],
      default: 'pending',
    },
    duration: {
      type: Number, // in minutes
      default: null,
    },
    cost: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'digital_wallet', 'cash'],
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    operatorNotes: {
      type: String,
      default: '',
    },
    isReserved: {
      type: Boolean,
      default: false,
    },
    reservationTime: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Session = mongoose.model('Session', sessionSchema);
