// ===========================================
// Printer Management System - Main Entry Point
// ===========================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { printerMonitor } = require('./services/printerMonitor');
const { startStatsAggregator } = require('./services/statsAggregator');

// Import routes
const authRoutes = require('./routes/auth.routes');
const printerRoutes = require('./routes/printer.routes');
const jobRoutes = require('./routes/job.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const userRoutes = require('./routes/user.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();
const server = http.createServer(app);

// Socket.io setup for real-time updates
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
    }
});

// Make io accessible to routes
app.set('io', io);

// ===========================================
// Middleware
// ===========================================

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - DISABLED for internal use
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 10000,
//     message: { error: 'Too many requests, please try again later' },
//     standardHeaders: true,
//     legacyHeaders: false
// });
// app.use('/api/', limiter);

// Stricter rate limit for auth endpoints - DISABLED
// const authLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: { error: 'Too many login attempts, please try again later' }
// });
// app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration,
            ip: req.ip
        });
    });
    next();
});

// ===========================================
// Routes
// ===========================================

// Import additional routes
const directPrintRoutes = require('./routes/directPrint.routes');
const printRoutes = require('./routes/print.routes');
const discoveryRoutes = require('./routes/discovery.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/direct-print', directPrintRoutes);
app.use('/api/print', printRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Health check (public)
app.get('/api/system/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Printer Management API',
        version: '1.0.0',
        docs: '/api/docs'
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

// ===========================================
// Socket.io Events
// ===========================================

io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe:printer', (printerId) => {
        socket.join(`printer:${printerId}`);
        logger.debug(`Client ${socket.id} subscribed to printer ${printerId}`);
    });

    socket.on('unsubscribe:printer', (printerId) => {
        socket.leave(`printer:${printerId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// ===========================================
// Start Server
// ===========================================

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Test database connection
        await db.testConnection();
        logger.info('✅ Database connection established');

        // Start background services
        printerMonitor.initialize(io);
        printerMonitor.start(60000);  // Poll every minute
        logger.info('✅ Printer monitor started');

        startStatsAggregator();
        logger.info('✅ Stats aggregator started');

        // Start HTTP server
        server.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received, shutting down gracefully...`);

    try {
        // Stop background intervals first so they don't use DB while closing.
        printerMonitor.stop();
    } catch (error) {
        logger.warn('Failed to stop printer monitor:', error);
    }

    try {
        io.close();
    } catch (error) {
        logger.debug('Socket.io close error (ignored):', error?.message || error);
    }

    // Close HTTP server (may hang if keep-alive connections exist; use a timeout).
    const closeServer = () => new Promise((resolve) => server.close(() => resolve()));
    const closeWithTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, ms))
    ]);

    await closeWithTimeout(closeServer(), 5000);
    logger.info('HTTP server close requested');

    try {
        // mysql2/promise pool.end() returns a Promise (no callback)
        await db.pool.end();
        logger.info('Database connections closed');
    } catch (error) {
        logger.warn('Error closing database pool (ignored):', error);
    }

    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
