const mongoose = require("mongoose");

const trendAnalysisSectionSchema = new mongoose.Schema({
  title: String,
  points: [String],
});

// psychographic: [String],
// beliefs: [String],
// fears: [String],
// interests: [String],
// shopping_behavior: [String],
// challenges: [String],
// goals: [String],

const personaSchema = new mongoose.Schema({
  name: String,
  background: [String],
  location: String,
  occupation: String,

  income: String,

  education: String,
  family: String,
  lifestyle: String,
  valuesAndBeliefs: [String],
  shoppingBehaviour: [String],
});

const pricingAnalysisSchema = new mongoose.Schema({
  targetMarketAndPriceSensitivity: {
    primaryAudience: String,
    priceSensitivity: String,
  },
  // marketResearch: {
  //   marketSize: Number,
  //   marketGrowthRate: Number,
  //   customerSegments: String,
  //   economicConditions: String,
  // },
  // competitorPricing: [
  //   {
  //     competitorName: String,
  //     pricePoints: [Number],
  //     pricingModel: String,
  //     discountingPractices: String,
  //   },
  // ],
  // costStructure: {
  //   costOfGoodsSold: Number,
  //   fixedCosts: Number,
  //   variableCosts: Number,
  //   breakEvenPoint: Number,
  // },
  // pricingObjectives: {
  //   profitabilityGoals: String,
  //   marketShareGoals: String,
  //   customerValuePerception: String,
  // },
  // pricingStrategies: [
  //   {
  //     strategyType: String,
  //     description: String,
  //   },
  // ],
  // priceSensitivityAnalysis: {
  //   elasticityOfDemand: Number,
  //   customerFeedback: String,
  //   abTestingResults: String,
  // },
  // legalEthicalConsiderations: {
  //   priceDiscrimination: Boolean,
  //   antitrustCompliance: Boolean,
  //   fairTradePractices: Boolean,
  // },
  // discountingPromotions: [
  //   {
  //     discountType: String,
  //     impactOnBrand: String,
  //     profitabilityImpact: Number,
  //   },
  // ],
  // pricingImplementation: {
  //   pricingCommunication: String,
  //   channelPricing: String,
  //   monitoringAdjustments: String,
  // },
  // salesProfitability: {
  //   salesForecasting: String,
  //   profitMargin: Number,
  //   revenueImpact: Number,
  // },
  // riskAnalysis: {
  //   marketRisks: String,
  //   customerRisks: String,
  //   operationalRisks: String,
  // },
});

const brandProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    company_name: String,
    industry: String,
    products: [String],
    years_in_business: Number,
    countries_sold_to: String,
    supplied_brands: String,
    company_core_values: [String],
    target_market: String,
    unique_products: [String],
    target_price_range: String,
    product_demographics: String,
    trend_analysis: {
      title: String,
      content: [trendAnalysisSectionSchema],
    },
    customer_personas: [personaSchema],
    selected_customer_persona: Object,
    pricing_analysis: pricingAnalysisSchema,
    massive_transformational_purpose: {
      what_do_your_brand_care_about_and_why: String,
      what_is_yuor_brand_purpose: String,
      what_does_the_world_need_from_your_industry_and_why: String,
      what_would_you_do_if_you_couldnt_fail_and_why: String,
      what_would_we_do_if_we_received_a_billion_dollars_today_and_why: String,
    },
    suggestions_for_mtp: {
      what_do_your_brand_care_about_and_why: String,
      what_is_yuor_brand_purpose: String,
      what_does_the_world_need_from_your_industry_and_why: String,
      what_would_you_do_if_you_couldnt_fail_and_why: String,
      what_would_we_do_if_we_received_a_billion_dollars_today_and_why: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Brandprofile = mongoose.model(
  "Brandprofile",
  brandProfileSchema
);
