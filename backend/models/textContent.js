const mongoose = require("mongoose");

const textContentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  designBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DesignBook",
  },
  content: [
    {
      subject: String,
      body: String,
    },
  ],
});

module.exports = Textcontent = mongoose.model("Textcontent", textContentSchema);
