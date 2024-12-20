const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const WechatStrategy = require("passport-wechat").Strategy;
const expressSession = require("express-session");
const OAuthToken = require("../models/oauthToken.js");
const Users = require("../models/users");
require("dotenv").config();

async function saveOAuthToken(
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  provider
) {
  await OAuthToken.deleteMany({ userId, provider });
  const token = new OAuthToken({
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    provider,
  });
  await token.save();
}

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:
        "https://aora-ai-5hb5.onrender.com/api/v1/user/auth/facebook/callback",
      profileFields: ["id", "emails", "name"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Facebook profile:", profile);
        const { id, emails, name, photos } = profile;
        const email = emails && emails.length > 0 ? emails[0].value : null;
        const picture = photos && photos.length > 0 ? photos[0].value : null;

        let user = await Users.findOne({ facebookId: id });

        if (!user && email) {
          user = await Users.findOne({ email_address: email });

          if (!user) {
            user = await Users.create({
              facebookId: id,
              email_address: email,
              avatar: picture,
              full_name: `${name.givenName} ${name.familyName}`,
            });
          } else {
            user.facebookId = id;
            await user.save();
          }
        }

        await saveOAuthToken(
          user._id,
          accessToken,
          refreshToken,
          new Date(Date.now() + 8 * 60 * 60 * 1000),
          "facebook"
        );

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.use(
  new WechatStrategy(
    {
      appID: process.env.WECHAT_APP_ID,
      appSecret: process.env.WECHAT_APP_SECRET,
      client: "web",
      callbackURL:
        "https://aora-ai-5hb5.onrender.com/api/v1/user/auth/wechat/callback",
      scope: "snsapi_userinfo",
      state: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("WeChat profile:", profile);
        const { openid, unionid, nickname, headimgurl } = profile;

        let user = await Users.findOne({ wechatId: unionid || openid });

        if (!user) {
          user = await Users.create({
            wechatId: unionid || openid,
            full_name: nickname,
            avatar: headimgurl,
          });
        }
        await saveOAuthToken(
          user._id,
          accessToken,
          refreshToken,
          new Date(Date.now() + 8 * 60 * 60 * 1000),
          "wechat"
        );
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
