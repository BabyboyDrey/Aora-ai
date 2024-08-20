const mongoose = require("mongoose");

const verificationCodeSchema = new mongoose.Schema(
  {
    email_address: {
      type: String,
    },
    phone_number: {
      type: String,
    },
    verificationCode: {
      type: Number,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationCodes = mongoose.model(
  "VerificationCodes",
  verificationCodeSchema
);

module.exports = VerificationCodes;
