// ===========================================
// Authentication Middleware
// ===========================================

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await db.queryOne(
            'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        logger.error('Token verification failed:', error);
        return res.status(403).json({ error: 'Invalid token' });
    }
}

/**
 * Check if user has required role(s)
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            logger.warn(`Access denied for user ${req.user.email} - required roles: ${allowedRoles.join(', ')}`);
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: req.user.role
            });
        }
        
        next();
    };
}

/**
 * Optional authentication - doesn't fail if no token
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db.queryOne(
            'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );
        req.user = user && user.is_active ? user : null;
    } catch (error) {
        req.user = null;
    }
    
    next();
}

/**
 * Log user action to system_logs
 */
async function logAction(category, message, details = {}, req = null) {
    try {
        const userId = req?.user?.id || null;
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null;
        const userAgent = req?.headers?.['user-agent'] || null;
        const printerId = details.printerId || null;
        
        await db.insert(
            `INSERT INTO system_logs 
             (level, category, message, details, user_id, printer_id, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['info', category, message, JSON.stringify(details), userId, printerId, ipAddress, userAgent]
        );
    } catch (error) {
        logger.error('Failed to log action:', error);
    }
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth,
    logAction
};
