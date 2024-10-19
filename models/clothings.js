const mongoose = require("mongoose");

const clothingsSchema = new mongoose.Schema(
  {
    clothing_image_name: [String],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clothing_image_uuid: [String],
    designBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignBook",
    },
    input_image: String,
    style_image: String,
  },
  {
    timestamps: true,
  }
);

module.exports = Clothing = mongoose.model("Clothing", clothingsSchema);
