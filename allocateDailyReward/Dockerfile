FROM node:lts-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

ENV NODE_ENV=development

RUN npm install --include=dev --include=optional --silent

COPY . .

RUN rm -rf dist

RUN npm run build

FROM node:lts-alpine

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

ENV NODE_ENV=production
RUN npm install --include=optional --production --silent

EXPOSE 3004
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
