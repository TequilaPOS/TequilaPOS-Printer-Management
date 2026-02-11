// ===========================================
// Error Handler Middleware
// ===========================================

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        user: req.user?.email
    });

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;
    
    // Known error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
    } else if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409; // Conflict
    }

    // Response
    const response = {
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };

    // Add validation errors if present
    if (err.errors) {
        response.errors = err.errors;
    }

    res.status(statusCode).json(response);
}

module.exports = errorHandler;
