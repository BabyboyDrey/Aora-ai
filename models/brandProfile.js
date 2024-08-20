const mongoose = require("mongoose");

const brandProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  company_name: String,
  industry: String,
  products: [String],
  years_in_business: Number,
  countries_sold_to: [String],
  supplied_brands: [String],
  company_core_values: [String],
  target_market: String,
  unique_products: [String],
  target_market_range: [String],
  product_demographics: [String],
});

module.exports = Brandprofile = mongoose.model(
  "Brandprofile",
  brandProfileSchema
);
