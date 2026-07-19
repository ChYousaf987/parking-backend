import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';
import {
  generateOTP,
  sendOTPEmail,
  verifyOTP,
} from '../services/otp.service.js';
import { stripeService } from '../services/stripe.service.js';

const generateToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d',
  });
};

export const authControllerV2 = {
  // Register with OTP
  registerWithOTP: async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        licenseNumber,
        vehiclePlateNumber,
        vehicleModel,
        rfidTag,
      } = req.body;

      // Validation: require only basic account info at registration
      if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({
          message:
            'First name, last name, email, phone and password are required',
        });
      }

      // Check existing user: only include vehiclePlateNumber if provided (avoid placeholder collisions)
      const orConditions = [{ email }, { phone }];
      if (
        vehiclePlateNumber &&
        vehiclePlateNumber.trim() !== '' &&
        vehiclePlateNumber !== 'PENDING'
      ) {
        orConditions.push({
          vehiclePlateNumber: vehiclePlateNumber.toUpperCase(),
        });
      }

      const existingUser = await User.findOne({ $or: orConditions });
      if (existingUser) {
        return res.status(400).json({
          message:
            'User with this email, phone, or plate number already exists',
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Build user object only with provided fields
      const userData = {
        firstName,
        lastName,
        email,
        phone,
        password,
        otp,
        otpExpiry,
        isEmailVerified: false,
      };

      if (licenseNumber && licenseNumber.trim() !== '')
        userData.licenseNumber = licenseNumber.trim();
      if (
        vehiclePlateNumber &&
        vehiclePlateNumber.trim() !== '' &&
        vehiclePlateNumber !== 'PENDING'
      )
        userData.vehiclePlateNumber = vehiclePlateNumber.toUpperCase();
      if (vehicleModel && vehicleModel.trim() !== '')
        userData.vehicleModel = vehicleModel.trim();
      if (rfidTag && rfidTag.trim() !== '') userData.rfidTag = rfidTag.trim();

      // Create user with OTP
      const user = new User(userData);
      await user.save();

      // Send OTP email (best-effort)
      try {
        await sendOTPEmail(email, otp, firstName);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }

      res.status(201).json({
        message: 'Registration initiated. OTP sent to email.',
        userId: user._id,
        email: user.email,
        ...(process.env.DEBUG_SHOW_OTP === 'true' ? { otp } : {}),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Verify OTP
  verifyOTP: async (req, res) => {
    try {
      const { userId, otp } = req.body;

      if (!userId || !otp) {
        return res
          .status(400)
          .json({ message: 'User ID and OTP are required' });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if OTP expired
      if (new Date() > user.otpExpiry) {
        return res
          .status(400)
          .json({ message: 'OTP has expired. Please request a new OTP.' });
      }

      // Verify OTP
      if (!verifyOTP(user.otp, otp)) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      // Create Stripe customer
      let stripeCustomerId = null;
      try {
        const stripeCustomer = await stripeService.createCustomer(
          user.email,
          `${user.firstName} ${user.lastName}`,
          user.phone
        );
        stripeCustomerId = stripeCustomer.id;
      } catch (stripeError) {
        console.error('Stripe customer creation failed:', stripeError);
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.otp = null;
      user.otpExpiry = null;
      if (stripeCustomerId) {
        user.stripeCustomerId = stripeCustomerId;
      }
      await user.save();

      const token = generateToken(user._id);

      res.status(200).json({
        message: 'Email verified successfully',
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          licenseNumber: user.licenseNumber,
          vehiclePlateNumber: user.vehiclePlateNumber,
          vehicleModel: user.vehicleModel,
        },
        token,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Resend OTP
  resendOTP: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();

      // Send OTP email
      try {
        await sendOTPEmail(email, otp, user.firstName);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }

      res.status(200).json({
        message: 'New OTP sent to email',
        userId: user._id,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required' });
      }

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({
          message: 'Email not verified. Please verify your email first.',
        });
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          licenseNumber: user.licenseNumber,
          vehiclePlateNumber: user.vehiclePlateNumber,
          vehicleModel: user.vehicleModel,
          walletBalance: user.walletBalance,
        },
        token,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user profile
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user?.id).select('-password -otp');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        phone,
        licenseNumber,
        vehicleModel,
        rfidTag,
      } = req.body;

      const user = await User.findByIdAndUpdate(
        req.user?.id,
        {
          firstName,
          lastName,
          phone,
          licenseNumber,
          vehicleModel,
          rfidTag,
        },
        { new: true }
      ).select('-password -otp');

      res.status(200).json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
