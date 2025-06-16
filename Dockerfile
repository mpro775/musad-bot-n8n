FROM node:18-alpine

# تثبيت تبعيات Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libgcc \
    libstdc++ \
    dumb-init

WORKDIR /usr/src/app

# نسخ جميع الملفات الضرورية
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src/ src/
COPY test/ test/

# تثبيت التبعيات
RUN npm ci
RUN npx playwright install

# فحص الإعدادات
RUN echo "🔍 فحص ملفات التكوين:"
RUN cat tsconfig.json || echo "لا يوجد tsconfig.json"
RUN cat tsconfig.build.json || echo "لا يوجد tsconfig.build.json"
RUN cat nest-cli.json || echo "لا يوجد nest-cli.json"

# البناء
RUN npm run build -- --webpack=false

# أو: RUN npx tsc -p tsconfig.build.json

# تشخيص النتيجة
RUN echo "✅ محتويات dist:" && ls -l dist
RUN echo "🔎 البحث عن main.js:" && find . -name main.js

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]