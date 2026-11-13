FROM node:22-alpine
RUN apk add --no-cache python3 make g++ ffmpeg tini
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /app/sessions /app/public/uploads
EXPOSE 8444
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
