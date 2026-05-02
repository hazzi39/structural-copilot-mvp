# RC Fatigue Tool

Standalone reinforced concrete fatigue calculator for Netlify deployment.

## Local Development

```bash
pnpm install
pnpm --dir apps/rc-fatigue dev
```

Open `http://localhost:3000` or set `PORT=3003` if you want to match the local preview used during development.

## Netlify

Set the Netlify base directory to:

```text
apps/rc-fatigue
```

Use the included `netlify.toml`, or set:

```text
Build command: pnpm build
Publish directory: .next
Node version: 20
```
