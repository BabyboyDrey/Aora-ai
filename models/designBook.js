const mongoose = require("mongoose");

const designBookSchema = new mongoose.Schema(
  {
    book_name: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    imagesSavedFromWebPack: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = DesignBook = mongoose.model("DesignBook", designBookSchema);
