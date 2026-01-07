const db = require('./src/configs/db.js');

function CreateDatabase(callback) {
    db.query('CREATE DATABASE IF NOT EXISTS toilet', (err) => {
        if (err) {
            console.log("❌ Failed to create database:", err);
            return callback(err);
        }
        console.log("✅ Database 'toilet' created or already exists");
        callback(null);
    });
}

function CreateTables() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS user (
            user_id VARCHAR(255) NOT NULL PRIMARY KEY,
            auth_id VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            platform VARCHAR(255) NOT NULL
        )`,

        `CREATE TABLE IF NOT EXISTS toilet (
            toilet_id VARCHAR(255) NOT NULL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description VARCHAR(255) NOT NULL,
            image VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES user(user_id)
        )`,

        `CREATE TABLE IF NOT EXISTS rate (
            rate_id VARCHAR(255) NOT NULL PRIMARY KEY,
            toilet_id VARCHAR(255) NOT NULL,
            rate INT NOT NULL DEFAULT 0,
            FOREIGN KEY (toilet_id) REFERENCES toilet(toilet_id)
        )`,

        `CREATE TABLE IF NOT EXISTS location (
            location_id VARCHAR(255) NOT NULL PRIMARY KEY,
            toilet_id VARCHAR(255) NOT NULL,
            latitude DOUBLE NOT NULL,
            longitude DOUBLE NOT NULL,
            FOREIGN KEY (toilet_id) REFERENCES toilet(toilet_id)
        )`,

        `CREATE TABLE IF NOT EXISTS report (
            report_id VARCHAR(255) NOT NULL PRIMARY KEY,
            toilet_id VARCHAR(255) NOT NULL,
            description VARCHAR(255),
            FOREIGN KEY (toilet_id) REFERENCES toilet(toilet_id)
        )`
    ];

    let completed = 0;

    queries.forEach((query, index) => {
        db.query(query, (err) => {
            if (err) {
                console.log(`❌ Failed to create table [${index + 1}]:`, err);
            } else {
                console.log(`✅ Table [${index + 1}] created successfully`);
            }

            completed++;

            // Stop process after all queries are done
            if (completed === queries.length) {
                console.log("✅ All tables created. Exiting...");
                process.exit(0);
            }
        });
    });
}

// Run
CreateDatabase((err) => {
    if (!err) CreateTables();
});
