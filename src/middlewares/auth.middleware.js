import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

    if (!token) {
      return res
        .status(401)
        .json({ message: 'Authorization token is required' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

export const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res
      .status(403)
      .json({ message: 'You do not have permission to access this resource' });
  }
  next();
};

export const operatorMiddleware = (req, res, next) => {
  if (req.user?.role !== 'operator' && req.user?.role !== 'admin') {
    return res
      .status(403)
      .json({ message: 'You do not have permission to access this resource' });
  }
  next();
};
