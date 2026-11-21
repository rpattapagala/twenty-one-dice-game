
FROM node:24-alpine
LABEL authors="chocolate"
WORKDIR /app
COPY package.json server.cjs game.cjs ./
COPY index.html styles.css dice.js menu.js online.js player.js ./
COPY images/ ./images/
EXPOSE 3000
CMD ["node", "server.cjs"]
