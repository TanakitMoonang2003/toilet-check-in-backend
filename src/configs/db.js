const mysql = require('mysql2')
require('dotenv').config()

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'admin',
    database: process.env.DB_NAME ||'toilet'
})

module.exports = db