import { Router } from 'express';
import { register, login, logout, requestResetPassword, resetPassword } from '../controllers/authController.js';
import { validateLoginInput, validateRegisterInput } from '../middleware/validationMiddleware.js';
import { checkFeatureEnabled } from '../middleware/featureSettingsMidddleware.js';
const router = Router();

router.post('/register',checkFeatureEnabled(['Register']), validateRegisterInput, register);
router.post('/login', validateLoginInput, login);
router.get('/logout', logout);
router.post('/request-reset-password', requestResetPassword);
router.post('/reset-password/:token', resetPassword);

export default router;