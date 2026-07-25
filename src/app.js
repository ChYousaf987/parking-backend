import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// routes
import authRoutes from './routes/auth.routes.js';
import authV2Routes from './routes/authV2.routes.js';
import parkingRoutes from './routes/parking.routes.js';
import sessionRoutes from './routes/session.routes.js';
import sessionsV2Routes from './routes/sessionsV2.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();

/* =========================
   CORS CONFIG (FIXED)
========================= */

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://car-parking-lime.vercel.app',
  'https://noor-rista-admin.vercel.app',
  'https://noor-rista-dashboard.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/* =========================
   PREFLIGHT FIX (Node 22)
========================= */

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }
  next();
});

/* =========================
   MIDDLEWARES
========================= */

app.use(express.json({ limit: '16kb' }));
app.use(urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

/* =========================
   ROUTES
========================= */

// use routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/v2', authV2Routes);
app.use('/api/parking', parkingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions/v2', sessionsV2Routes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/dashboard', dashboardRoutes);

// test api
app.get('/', (req, res) => {
  res.json({
    message: 'Parking Management API is working successfully',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      parking: '/api/parking',
      sessions: '/api/sessions',
      vehicles: '/api/vehicles',
      dashboard: '/api/dashboard',
    },
  });
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message,
  });
});

export { app };
