import express from 'express';
import { parkingController } from '../controllers/parking.controller.js';
import {
  authMiddleware,
  operatorMiddleware,
} from '../middlewares/auth.middleware.js';

const router = express.Router();

// Location routes
router.post(
  '/locations',
  authMiddleware,
  operatorMiddleware,
  parkingController.createLocation
);
router.get('/locations', parkingController.getAllLocations);
router.get('/locations/:id', parkingController.getLocationById);
router.put(
  '/locations/:id',
  authMiddleware,
  operatorMiddleware,
  parkingController.updateLocation
);
router.delete(
  '/locations/:id',
  authMiddleware,
  operatorMiddleware,
  parkingController.deleteLocation
);

// Spot routes
router.get('/locations/:locationId/spots', parkingController.getLocationSpots);
router.patch(
  '/spots/:spotId/status',
  authMiddleware,
  operatorMiddleware,
  parkingController.updateSpotStatus
);

export default router;
