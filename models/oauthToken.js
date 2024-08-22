const mongoose = require("mongoose");

const oauthTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  accessToken: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  expiresAt: {
    type: Date,
  },
  provider: {
    type: String,
  },
});

const OAuthToken = mongoose.model("OAuthToken", oauthTokenSchema);

module.exports = OAuthToken;
