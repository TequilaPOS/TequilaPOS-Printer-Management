// ===========================================
// User Management Routes (Admin only)
// ===========================================

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticateToken, requireRole, logAction } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole(['admin'])); // All routes require admin

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req, res, next) => {
    try {
        const users = await db.query(`
            SELECT id, email, name, role, is_active, last_login, created_at, updated_at,
                   page_quota, pages_printed
            FROM users
            ORDER BY name
        `);
        
        res.json({ users });
        
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/:id
 * Get user details
 */
router.get('/:id', async (req, res, next) => {
    try {
        const user = await db.queryOne(`
            SELECT id, email, name, role, is_active, last_login, created_at, updated_at,
                   page_quota, pages_printed
            FROM users WHERE id = ?
        `, [req.params.id]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's recent activity
        const recentActivity = await db.query(`
            SELECT category, message, created_at
            FROM system_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.params.id]);
        
        res.json({ ...user, recentActivity });
        
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users
 * Create new user
 */
router.post('/', async (req, res, next) => {
    try {
        const { email, password, name, role = 'viewer' } = req.body;
        
        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const validRoles = ['admin', 'operator', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Check for existing email
        const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) {
            return res.status(409).json({ error: 'Email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const userId = await db.insert(`
            INSERT INTO users (email, password, name, role)
            VALUES (?, ?, ?, ?)
        `, [email.toLowerCase(), hashedPassword, name, role]);
        
        await logAction('auth', 'User created', { userId, email, role }, req);
        
        res.status(201).json({
            id: userId,
            email: email.toLowerCase(),
            name,
            role,
            message: 'User created successfully'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { name, role, email, password, page_quota, pages_printed } = req.body;
        
        const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Don't allow modifying the last admin
        if (user.role === 'admin' && role !== 'admin') {
            const adminCount = await db.queryOne(
                "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1"
            );
            if (adminCount.count <= 1) {
                return res.status(400).json({ error: 'Cannot remove the last admin' });
            }
        }
        
        let updates = [];
        let params = [];
        
        if (name) {
            updates.push('name = ?');
            params.push(name);
        }
        
        if (role && ['admin', 'operator', 'viewer'].includes(role)) {
            updates.push('role = ?');
            params.push(role);
        }
        
        if (email) {
            // Check for duplicate
            const existing = await db.queryOne(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email.toLowerCase(), req.params.id]
            );
            if (existing) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            updates.push('email = ?');
            params.push(email.toLowerCase());
        }
        
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }
        
        // Quota management
        if (page_quota !== undefined) {
            updates.push('page_quota = ?');
            params.push(parseInt(page_quota) || -1);
        }
        
        if (pages_printed !== undefined) {
            updates.push('pages_printed = ?');
            params.push(parseInt(pages_printed) || 0);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        params.push(req.params.id);
        await db.update(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
        
        await logAction('auth', 'User updated', { userId: req.params.id }, req);
        
        res.json({ message: 'User updated successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', async (req, res, next) => {
    try {
        // Can't delete yourself
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Don't delete the last admin
        if (user.role === 'admin') {
            const adminCount = await db.queryOne(
                "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
            );
            if (adminCount.count <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin' });
            }
        }
        
        await db.update('DELETE FROM users WHERE id = ?', [req.params.id]);
        
        await logAction('auth', 'User deleted', { userId: req.params.id, email: user.email }, req);
        
        res.json({ message: 'User deleted successfully' });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/users/:id/toggle-active
 * Activate/deactivate user
 */
router.put('/:id/toggle-active', async (req, res, next) => {
    try {
        const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Can't deactivate yourself
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }
        
        // Don't deactivate the last active admin
        if (user.role === 'admin' && user.is_active) {
            const adminCount = await db.queryOne(
                "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1"
            );
            if (adminCount.count <= 1) {
                return res.status(400).json({ error: 'Cannot deactivate the last admin' });
            }
        }
        
        const newStatus = !user.is_active;
        await db.update('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        
        // If deactivating, invalidate their tokens
        if (!newStatus) {
            await db.update('DELETE FROM refresh_tokens WHERE user_id = ?', [req.params.id]);
        }
        
        await logAction('auth', `User ${newStatus ? 'activated' : 'deactivated'}`, { userId: req.params.id }, req);
        
        res.json({ 
            message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/users/:id/password
 * Change user password (admin only)
 */
router.put('/:id/password', async (req, res, next) => {
    try {
        const { password } = req.body;
        
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, req.params.id]);
        
        // Invalidate all their tokens so they need to re-login
        await db.update('DELETE FROM refresh_tokens WHERE user_id = ?', [req.params.id]);
        
        await logAction('auth', 'Password changed by admin', { userId: req.params.id, changedBy: req.user.id }, req);
        
        res.json({ message: 'Password changed successfully' });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
