# Base stage
FROM oven/bun:1 as base
WORKDIR /usr/src/app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run prisma:generate

# Release stage
FROM base as release
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/prisma .
COPY --from=base /usr/src/app/node_modules .
COPY --from=base /usr/src/app/src .
COPY --from=base /usr/src/app/tsconfig.json .
ENV BUN=true
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "start:prod"]