const passport = require('passport')
const facebook = require('passport-facebook').Strategy
const uuid = require('uuid')
const db = require('./db')
require('dotenv').config()

passport.use(new facebook({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,   
  profileFields: ['id', 'displayName'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
      db.query('SELECT * FROM user WHERE auth_id = ?', [profile.id], async (err, results) => {
          if (err) return done(err);

          let user = results[0];

          if (!user) {
              userId = uuid.v4()
              db.query('INSERT INTO user (user_id, auth_id, name, platform) VALUES (?, ?, ?, "facebook")',
              [userId, profile.id, profile.displayName], (err, results) => {
                  if (err) return done(err);
                  user = {
                      user_id: userId,
                      auth_id: profile.id,
                      name: profile.displayName,
                      platform: "facebook"
                  };
                  return done(null, user); 
              });
          } else {
              return done(null, user);
          }
      });
  } catch (err) {
      return done(err, null);
  }
}));


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
