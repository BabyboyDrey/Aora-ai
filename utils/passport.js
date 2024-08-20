const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const expressSession = require("express-session");
const Users = require("../models/users");
require("dotenv").config();

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:5002/api/v1/user/auth/facebook/callback",
      profileFields: ["id", "emails", "name"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Facebook profile:", profile);
        const { id, emails, name } = profile;
        const email = emails && emails.length > 0 ? emails[0].value : null;

        let user = await Users.findOne({ facebookId: id });

        if (!user && email) {
          user = await Users.findOne({ email_address: email });

          if (!user) {
            user = await Users.create({
              facebookId: id,
              email_address: email,
              full_name: `${name.givenName} ${name.familyName}`,
            });
          } else {
            user.facebookId = id;
            await user.save();
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, callback) => {
  callback(null, user.id);
});

passport.deserializeUser(async (id, callback) => {
  try {
    const user = await Users.findById(id);
    callback(null, user);
  } catch (error) {
    callback(error, null);
  }
});

module.exports = passport;
