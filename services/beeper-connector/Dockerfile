FROM node:18-bullseye

WORKDIR /app

# System deps for sqlite3 build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm i --omit=dev && npm i -D ts-node typescript && npm cache clean --force

ENV NODE_ENV=production

CMD ["npx", "ts-node", "src/index.ts"]


