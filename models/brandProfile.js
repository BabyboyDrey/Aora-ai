const mongoose = require("mongoose");

const trendAnalysisSectionSchema = new mongoose.Schema({
  title: String,
  points: [String],
});

const personaSchema = new mongoose.Schema({
  name: String,
  background: [String],
  location: String,
  occupation: String,
  psychographic: [String],
  beliefs: [String],
  fears: [String],
  interests: [String],
  shopping_behavior: [String],
  challenges: [String],
  goals: [String],
});

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
  target_price_range: [String],
  product_demographics: [String],
  trend_analysis: {
    title: String,
    content: [trendAnalysisSectionSchema],
  },
  customer_personas: [personaSchema],
});

module.exports = Brandprofile = mongoose.model(
  "Brandprofile",
  brandProfileSchema
);
