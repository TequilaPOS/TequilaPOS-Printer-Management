// ===========================================
// Database Configuration
// ===========================================

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'printer_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    charset: 'utf8mb4'
});

// Test connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return true;
    } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
    }
}

// Execute query with logging
async function query(sql, params = []) {
    const start = Date.now();
    try {
        const [results] = await pool.execute(sql, params);
        const duration = Date.now() - start;
        logger.debug(`Query executed in ${duration}ms: ${sql.substring(0, 100)}...`);
        return results;
    } catch (error) {
        logger.error('Query error:', { sql, params, error: error.message });
        throw error;
    }
}

// Get single row
async function queryOne(sql, params = []) {
    const results = await query(sql, params);
    return results[0] || null;
}

// Insert and return ID
async function insert(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result.insertId;
}

// Update and return affected rows
async function update(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result.affectedRows;
}

// Transaction wrapper
async function transaction(callback) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    pool,
    query,
    queryOne,
    insert,
    update,
    transaction,
    testConnection
};
