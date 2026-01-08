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

// Middleware setup
app.use(cors({
    origin: process.env.CLIENT,  // หรือชื่อโดเมน front-end ของคุณ
    credentials: true,                // ต้องตั้ง true เพื่อส่ง/รับ cookie
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session must be before passport.session()
app.use(session({
    secret: process.env.SECRET || 'your-default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,       // ใน dev ให้ false (ถ้า https ใน production ต้อง true)
        httpOnly: true,
        sameSite: 'lax'
    },
}));

app.use(require('express-session')({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
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
        res.redirect(process.env.CLIENT);
    }
);


// Facebook Auth Routes
app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['public_profile']}));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect(process.env.CLIENT);

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

// ======================= START SERVER ========================
app.listen(5000, () => {
    console.log("Server started at http://localhost:5000");
});
