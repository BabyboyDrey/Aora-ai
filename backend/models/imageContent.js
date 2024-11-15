const mongoose = require("mongoose");

const imageContentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  imageName: String,
  designBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DesignBook",
  },
});

module.exports = Imagecontent = mongoose.model(
  "Imagecontent",
  imageContentSchema
);
