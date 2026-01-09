const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',  // รองรับทั้ง DB_PASSWORD และ DB_PASS
    database: process.env.DB_NAME || 'toilet',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ทดสอบการเชื่อมต่อ
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('📋 Trying to connect with:', {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            hasPassword: !!(process.env.DB_PASSWORD || process.env.DB_PASS)
        });
    } else {
        console.log('✅ Database connected successfully');
        connection.release();
    }
});

module.exports = pool;