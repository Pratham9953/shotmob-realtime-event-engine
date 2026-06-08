FROM node:22-bookworm-slim AS base
WORKDIR /app

# ffmpeg + python are required for yt-dlp based YouTube audio extraction.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip curl unzip ca-certificates \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && deno --version \
  && yt-dlp --version \
  && ffmpeg -version \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY public ./public

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]
