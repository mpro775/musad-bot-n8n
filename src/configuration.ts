// src/configuration.ts
export default () => ({
  n8n: {
    openaiWebhookUrl: process.env.N8N_OPENAI_WEBHOOK_URL,
  },
  embeddingApiUrl: process.env.EMBEDDING_API_URL,
  // هنا متغيرات أخرى إن وجدت
});
