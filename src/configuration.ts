// src/configuration.ts
export default () => ({
  n8n: {
    openaiWebhookUrl: process.env.N8N_OPENAI_WEBHOOK_URL,
    baseUrl: process.env.N8N_BASE_URL,
    apiKey: process.env.N8N_API_KEY,
  },
  // هنا متغيرات أخرى إن وجدت
});
