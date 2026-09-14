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

The server listens on port `3000` by default (`PORT` env var). Configuration is read at runtime — pass the variables from `.env.example` with `-e` or `--env-file`:

```bash
docker run -p 3000:3000 \
  -e AGENT_PROVIDER=openai-compatible \
  -e AGENT_BASE_URL=http://host.docker.internal:10100/v1 \
  bigbaedocs-v2
```

The image includes the rhwp wasm (`public/rhwp_bg.wasm` and `node_modules/@rhwp/core`), the HWPX templates under `src/templates/`, and `sharp` — all traced into `.next/standalone` at build time, so no extra mounts are needed.
