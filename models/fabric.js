const mongoose = require("mongoose");

const fabricsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fabricImageName: String,
    designBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignBook",
    },
    fabricUuid: String,
  },
  {
    timestamps: true,
  }
);

module.exports = Fabrics = mongoose.model("Fabrics", fabricsSchema);
