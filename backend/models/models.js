const mongoose = require("mongoose");

const modelsSchema = new mongoose.Schema(
  {
    designBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignBook",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    model_uuid: [String],
    model_image_name: [String],
    background_image: String,
    pose_image: String,
    userModelPrompt: Object,
  },
  {
    timestamps: true,
  }
);

module.exports = Models = mongoose.model("Models", modelsSchema);
