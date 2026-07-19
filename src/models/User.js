import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'operator', 'user'],
      default: 'user',
    },
    avatar: {
      type: String,
      default: null,
    },

    // OTP Fields
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Vehicle Information
    licenseNumber: {
      type: String,
      default: null,
    },
    vehiclePlateNumber: {
      type: String,
      default: null,
      uppercase: true,
    },
    vehicleModel: {
      type: String,
      default: null,
    },
    rfidTag: {
      type: String,
      default: null,
    },

    // Stripe Customer
    stripeCustomerId: {
      type: String,
      default: null,
    },

    // Wallet Balance
    walletBalance: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index(
  { rfidTag: 1 },
  {
    unique: true,
    partialFilterExpression: { rfidTag: { $exists: true, $ne: null } },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
