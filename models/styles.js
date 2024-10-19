const mongoose = require("mongoose");

const stylesSchema = new mongoose.Schema(
  {
    style_image_name: [String],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    style_image_uuid: [String],
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

module.exports = Styles = mongoose.model("Styles", stylesSchema);
