# syntax=docker/dockerfile:1.7

########### deps-prod: تبعيات الإنتاج فقط ###########
FROM node:20-alpine AS deps-prod
WORKDIR /app
# لو عندك باكجات native (اختياري):
RUN apk add --no-cache libc6-compat
COPY package*.json ./
# تثبيت تبعيات الإنتاج فقط ثم تنظيف كاش npm
RUN npm ci --omit=dev && npm cache clean --force

########### deps-dev: تبعيات التطوير (للبناء) ###########
FROM node:20-alpine AS deps-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

########### builder: يبني TypeScript إلى dist ###########
FROM node:20-alpine AS builder
WORKDIR /app
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
# ننسخ node_modules الخاصّة بالبناء
COPY --from=deps-dev /app/node_modules ./node_modules
# لو تستخدم Nest CLI:
RUN npm run build -- --webpack=false

########### runner: صورة التشغيل النهائية (صغيرة) ###########
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ننسخ node_modules الخاصّة بالإنتاج فقط
COPY --from=deps-prod /app/node_modules ./node_modules
# ننسخ مخرجات البناء
COPY --from=builder /app/dist ./dist
# (اختياري) لو يحتاج بعض الملفات مثل package.json لقراءة version:
COPY package*.json ./

# شغّل بتطبيق user غير root (أفضل أماناً)
RUN addgroup -S app && adduser -S app -G app
USER app

# نقطة الدخول
CMD ["node", "dist/main.js"]
