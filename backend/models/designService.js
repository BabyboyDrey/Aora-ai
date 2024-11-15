const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  price: { type: Number, required: true },
  whatItEntails: { type: String, required: true },
  deliveryDay: { type: Number, required: true },
  revisions: { type: Number, required: true },
  perks: [{ type: String, required: true }],
});

const designServiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  serviceName: { type: String, required: true },
  serviceDescription: { type: String, required: true },
  serviceImage: { type: String },
  serviceCategory: { type: String, required: true },
  plans: {
    basicPlan: { type: planSchema, required: true },
    standardPlan: { type: planSchema, required: true },
    premiumPlan: { type: planSchema, required: true },
  },
});

designServiceSchema.index({
  serviceName: 1,
});

module.exports = Designservice = mongoose.model(
  "Designservice",
  designServiceSchema
);
