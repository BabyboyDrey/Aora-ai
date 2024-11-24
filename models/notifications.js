const mongoose = require("mongoose");

const notificationsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    brief: String,
    briefModelType: String,
    idOfCausingActivity: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Notifications = mongoose.model(
  "Notifications",
  notificationsSchema
);
