import express from 'express';
import { vehicleController } from '../controllers/vehicle.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', authMiddleware, vehicleController.addVehicle);
router.get('/user/:userId', vehicleController.getUserVehicles);
router.get('/:vehicleId', vehicleController.getVehicleById);
router.put('/:vehicleId', authMiddleware, vehicleController.updateVehicle);
router.delete('/:vehicleId', authMiddleware, vehicleController.deleteVehicle);
router.patch(
  '/:vehicleId/default',
  authMiddleware,
  vehicleController.setDefaultVehicle
);

export default router;
