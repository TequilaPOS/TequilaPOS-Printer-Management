// ===========================================
// Authentication Routes
// ===========================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Username/email and password required' });
        }
        
        // Get user by email OR username (email field can contain either)
        const user = await db.queryOne(
            'SELECT * FROM users WHERE email = ? OR email = ?',
            [email.toLowerCase(), email]
        );
        
        if (!user) {
            await logAction('auth', 'Login failed - user not found', { email }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!user.is_active) {
            await logAction('auth', 'Login failed - account disabled', { email }, req);
            return res.status(403).json({ error: 'Account is disabled' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await logAction('auth', 'Login failed - invalid password', { email }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '7d' }
        );
        
        const refreshToken = uuidv4();
        // 30 days refresh token
        const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Save refresh token
        await db.insert(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, refreshToken, refreshExpiry]
        );
        
        // Update last login
        await db.update(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        await logAction('auth', 'Login successful', { email }, req);
        
        res.json({
            accessToken,
            refreshToken,
            expiresIn: 3600,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        
        // Find valid refresh token
        const tokenRecord = await db.queryOne(
            `SELECT rt.*, u.id as user_id, u.email, u.name, u.role, u.is_active
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token = ? AND rt.expires_at > NOW()`,
            [refreshToken]
        );
        
        if (!tokenRecord) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        
        if (!tokenRecord.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }
        
        // Generate new access token
        const accessToken = jwt.sign(
            { userId: tokenRecord.user_id, email: tokenRecord.email, role: tokenRecord.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.json({
            accessToken,
            expiresIn: 3600
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
router.post('/logout', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            await db.update(
                'DELETE FROM refresh_tokens WHERE token = ?',
                [refreshToken]
            );
        }
        
        res.json({ message: 'Logged out successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await db.queryOne(
            'SELECT id, email, name, role, is_active, last_login, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put('/password', authenticateToken, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        // Get current password hash
        const user = await db.queryOne(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await db.update(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        
        // Invalidate all refresh tokens for this user
        await db.update(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [req.user.id]
        );
        
        await logAction('auth', 'Password changed', {}, req);
        
        res.json({ message: 'Password changed successfully' });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
