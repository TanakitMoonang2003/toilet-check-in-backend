const passport = require('passport')
const google = require('passport-google-oauth20').Strategy
const uuid = require('uuid')
const db = require('./db')
require('dotenv').config()

passport.use(new google({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL, 
}, (accessToken, refreshToken, profile, done) => {
    try {
        db.query('SELECT * FROM user WHERE auth_id = ?', [profile.id], async (err, results) => {
          if (err) {
            return done(err);
          }
    
          let user = results[0];
    
          if (!user) {
            // ถ้ายังไม่มี user นี้ใน DB ก็ทำการสร้างใหม่
            userId = uuid.v4()
            db.query('INSERT INTO user (user_id, auth_id, name, platform) VALUES (?, ?, ?, "google")', 
            [userId, profile.id, profile.displayName], (err, results) => {
              if (err) return done(err);
              user = {
                user_id: userId,
                auth_id: profile.id,
                name: profile.displayName,
                platform: "google"
              };
              return done(null, user);
            });
          } else {
            // ถ้ามี user นี้แล้ว
            return done(null, user);
          }
        });
      } catch (err) {
        return done(err, null);
      }
}))

passport.serializeUser((user, done) => {
    done(null, user.user_id);
  });
  
passport.deserializeUser((id, done) => {
    db.query('SELECT * FROM user WHERE user_id = ?', [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});
  

module.exports = passport