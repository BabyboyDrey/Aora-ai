const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const expressSession = require("express-session");
const Users = require("../models/users"); // Assuming your User model is here
require("dotenv").config();

const ID = "1048252620278389";
const SECRET = "3ab164c1912a7cac2628b818b1b53d0c";

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
        // Extract user details from profile
        const { id, emails, name } = profile;
        const email = emails && emails.length > 0 ? emails[0].value : null;

        // Check if user already exists
        let user = await Users.findOne({ facebookId: id });

        if (!user && email) {
          // If user doesn't exist, check if there's a user with the same email
          user = await Users.findOne({ email_address: email });

          if (!user) {
            // If the user doesn't exist, create a new user
            user = await Users.create({
              facebookId: id,
              email_address: email,
              full_name: `${name.givenName} ${name.familyName}`,
            });
          } else {
            // Link the existing user to their Facebook account
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
  callback(null, user.id); // Store only the user ID in the session
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
