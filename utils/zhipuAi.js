// zhipuai.js
const axios = require("axios");

class ZhipuAI {
  constructor(apiKey) {
    this.apiKey = process.env.ZHIPU_APP_KEY;
    this.baseUrl = "https://open.bigmodel.cn/api/paas/v4"; // Base URL for the API
  }

  async chatCompletions(model, messages, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: model,
          messages: messages,
          ...options,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error calling Zhipu AI API:", error);
      throw error;
    }
  }
}

module.exports = ZhipuAI;
