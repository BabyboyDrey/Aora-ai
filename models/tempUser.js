const mongoose = require("mongoose");

const tempUserSchema = new mongoose.Schema(
  {
    email_address: {
      type: String,
    },
    phone_number: {
      type: String,
    },
    full_name: String,
    password: String,
    verificationCode: Number,
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

tempUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TempUser = mongoose.model("TempUser", tempUserSchema);

module.exports = TempUser;
