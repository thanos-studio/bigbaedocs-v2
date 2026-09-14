This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

### Docker

The single `Dockerfile` builds a production image with the Next.js [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) (enabled in `next.config.ts`):

```bash
docker build -t bigbaedocs-v2 .
docker run -p 3000:3000 bigbaedocs-v2
```

The server listens on port `3000` by default (`PORT` env var). Configuration is read at runtime, so one image serves every environment:

```bash
docker run -p 3000:3000 \
  -e AGENT_PROVIDER=openai-compatible \
  -e AGENT_BASE_URL=http://host.docker.internal:10100/v1 \
  bigbaedocs-v2
```

`host.docker.internal` resolves on Docker Desktop (macOS/Windows); on Linux, pass the host's address instead (e.g. `-e AGENT_BASE_URL=http://172.17.0.1:10100/v1`) or add `--add-host=host.docker.internal:host-gateway`.

With `--env-file`, note that Docker does not strip quotes: `AGENT_MODELS_JSON='[...]'` from a dotenv file keeps the outer `'` and the server rejects it at `/api/agent/models`. Either remove the outer quotes in the env file, or pass that one variable with `-e`.

The image carries everything the runtime reads: the rhwp wasm (`public/rhwp_bg.wasm`, plus `node_modules/@rhwp/core` for server-side HWPX generation), the templates under `src/templates/`, and `sharp` — copied explicitly by the `Dockerfile`, so no extra mounts are needed.
