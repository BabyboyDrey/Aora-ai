const mongoose = require("mongoose");

const pricingSchema = new mongoose.Schema({
  name: String,
  price: Number,
  deliverables: [String],
  noOfDaysForDeliverable: Number,
  noOfRevisions: Number,
  priceServiceDescription: String,
});

const designServiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  serviceName: String,
  aboutService: String,
  image: String,
  standardPricing: { type: pricingSchema, required: true },
  premiumPricing: { type: pricingSchema, required: true },
  basicPricing: { type: pricingSchema, required: true },
});

designServiceSchema.index({
  serviceName: 1,
});

module.exports = Designservice = mongoose.model(
  "Designservice",
  designServiceSchema
);
