FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose ports for NRL Server (3000) and Bank Node (3001)
EXPOSE 3000 3001

# Default command (can be overridden in docker-compose)
CMD ["npm", "start"]
