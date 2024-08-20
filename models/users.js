const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const userSchema = new mongoose.Schema(
  {
    email_address: {
      type: String,
    },
    phone_number: {
      type: String,
    },
    full_name: {
      type: String,
    },
    password: {
      type: String,
    },
    facebookId: String,
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email_address: 1 });
userSchema.index({ phone_number: 1 });

userSchema.methods.getJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES,
  });
};

userSchema.pre("save", function (next) {
  this.updatedAt = Date();
  next();
});

module.exports = Users = mongoose.model("Users", userSchema);
