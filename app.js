const express = require('express');
const app = express();
require('dotenv').config();

const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const uuid = require('uuid');

const { uploadImageSingle } = require('./src/middlewares/upload');
const db = require('./src/configs/db');

// Passport strategies
require('./src/configs/facebook');
require('./src/configs/google');

// Basic request logger for debugging on Railway
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Middleware setup
app.use(cors({
    origin: process.env.CLIENT,  // หรือชื่อโดเมน front-end ของคุณ
    credentials: true,                // ต้องตั้ง true เพื่อส่ง/รับ cookie
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session must be before passport.session()
// For cross-origin requests, we need secure: true and sameSite: 'none'
// Since backend URL uses HTTPS (devtunnels.ms), we should use secure cookies
const isSecure = process.env.SECURE_COOKIE !== 'false';  // Default to true unless explicitly set to false

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',  // Explicitly set session cookie name
    cookie: {
        secure: isSecure,  // true for HTTPS (required for sameSite: 'none')
        httpOnly: true,
        sameSite: isSecure ? 'none' : 'lax',  // 'none' for cross-origin with HTTPS, 'lax' for same-site
        maxAge: 24 * 60 * 60 * 1000,  // 24 hours
        domain: undefined,  // Let browser determine domain
        path: '/',  // Available for all paths
    },
}));

app.use(passport.initialize());
app.use(passport.session());

// ======================= ROUTES ========================

app.use("/images", express.static("./public/images"))

// Get all toilets in GeoJSON format
app.get("/toilet", (req, res) => {
    const query = `
        SELECT 
            toilet.*, 
            rate.rate, 
            location.latitude, location.longitude, 
            report.description AS report_description 
        FROM toilet 
        LEFT JOIN rate ON toilet.toilet_id = rate.toilet_id 
        LEFT JOIN location ON toilet.toilet_id = location.toilet_id 
        LEFT JOIN report ON toilet.toilet_id = report.toilet_id 
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).send({message: "Database error"});

        const features = results.map(row => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            },
            properties: {
                id: row.toilet_id,
                name: row.title,
                description: row.description,
                report: row.report_description || null,
                rate: row.rate,
                image: row.image,
            }
        }));

        res.json(features);
    });
});

// Get a single toilet by ID
app.get("/toilet/:id", (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT 
            toilet.*, 
            rate.rate, 
            location.latitude, location.longitude, 
            report.description AS report_description 
        FROM toilet 
        LEFT JOIN rate ON toilet.toilet_id = rate.toilet_id 
        LEFT JOIN location ON toilet.toilet_id = location.toilet_id 
        LEFT JOIN report ON toilet.toilet_id = report.toilet_id 
        WHERE toilet.toilet_id = ?
    `;

    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).send({message: "Database error"});
        res.json(result);
    });
});

// Create a report
app.post("/report", (req, res) => {
    const { toilet_id, description } = req.body;
    db.query("INSERT INTO report (report_id, toilet_id, description) VALUES (?, ?, ?)",
        [uuid.v4(), toilet_id, description],
        (err) => {
            if (err) return res.status(500).send({message: "Insert failed"});
            res.send({message: "create report success"});
        });
});

// Delete a report by toilet ID
app.put("/report", (req, res) => {
    const { toilet_id, description } = req.body;
    db.query("UPDATE report SET description = ? WHERE toilet_id = ?", [description, toilet_id], (err) => {
        if (err) return res.status(500).send({message: "Update failed"});
        res.send({message: "update report success"});
    });
});

// Delete a report by toilet ID
app.delete("/report/:id", (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM report WHERE toilet_id = ?", [id], (err) => {
        if (err) return res.status(500).send({message: "Delete failed"});
        res.send({message: "delete report success"});
    });
});

// Create a toilet with image upload
app.post("/toilet", uploadImageSingle, (req, res) => {
    const image = req.file;
    const { title, description, rate, latitude, longitude } = req.body;
    const user = req.user;  // ตรวจสอบว่าผู้ใช้ล็อกอินแล้วหรือยัง

    if (!user) {
        return res.status(401).json({ message: 'ไม่ได้รับอนุญาต' });
    }

    // ตรวจสอบว่ามีข้อมูลครบหรือไม่
    if (!title || !description || !rate || !latitude || !longitude) {
        return res.status(400).json({ message: 'ข้อมูลที่จำเป็นหายไป' });
    }

    // ตรวจสอบว่าอัพโหลดไฟล์หรือไม่
    if (!image) {
        return res.status(400).json({ message: 'การอัพโหลดไฟล์ล้มเหลว' });
    }

    const toilet_id = uuid.v4();

    db.query(
        "INSERT INTO toilet (toilet_id, user_id, title, description, image) VALUES (?, ?, ?, ?, ?)",
        [toilet_id, user.user_id, title, description, image.filename],
        (err) => {
            if (err) {
                console.error('ไม่สามารถแทรกข้อมูลห้องน้ำ:', err);
                return res.status(500).send("ไม่สามารถแทรกข้อมูลห้องน้ำ");
            }

            db.query("INSERT INTO rate (rate_id, toilet_id, rate) VALUES (?, ?, ?)", [uuid.v4(), toilet_id, rate]);
            db.query("INSERT INTO location (location_id, toilet_id, latitude, longitude) VALUES (?, ?, ?, ?)", [uuid.v4(), toilet_id, latitude, longitude]);

            return res.send("สร้างห้องน้ำสำเร็จ");
        }
    );
});


// Google Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        console.log('Google callback - User authenticated:', req.user);
        console.log('Google callback - Session ID:', req.sessionID);
        console.log('Google callback - Is authenticated:', req.isAuthenticated());
        
        // Ensure session is saved before redirecting
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ message: 'Session save failed' });
            }
            res.redirect(process.env.CLIENT);
        });
    }
);


// Facebook Auth Routes
app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['public_profile']}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        console.log('Facebook callback - User authenticated:', req.user);
        console.log('Facebook callback - Session ID:', req.sessionID);
        console.log('Facebook callback - Is authenticated:', req.isAuthenticated());
        
        // Ensure session is saved before redirecting
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ message: 'Session save failed' });
            }
            res.redirect(process.env.CLIENT);
        });
    }
);




// User Profile
app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json({
        user_id: req.user.user_id,
        name: req.user.name,
    });
});

app.get('/api/user', (req, res) => {
    // Debug logging
    console.log('Session ID:', req.sessionID);
    console.log('Is Authenticated:', req.isAuthenticated());
    console.log('User:', req.user);
    console.log('Session:', req.session);
    
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

app.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }

        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
});

app.get('/check-status', (req, res) => {
     res.status(200).json({ message: 'Status Ok' });
});

// Simple root route for health checks
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Backend running' });
});

// ======================= START SERVER ========================
const PORT = process.env.PORT;

console.log('PORT from Railway:', PORT);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
});
