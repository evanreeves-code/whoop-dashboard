# Whoop Morning Dashboard

Personal morning dashboard powered by the Whoop API with AI briefs, weekly charts, and Apple Watch integration.

## Local development

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # runs on http://localhost:3000
```

Required env vars:
- `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` — from [developer.whoop.com](https://developer.whoop.com)
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

## Deploy to Fly.io (free, always-on)

Fly.io has a free allowance that covers this app at $0/month. Needs a credit card on file.

### 1. Install flyctl and log in
```bash
brew install flyctl
fly auth signup   # or fly auth login
```

### 2. Pick a unique app name and create a volume
```bash
# Edit fly.toml — change "whoop-dashboard" to something unique
fly apps create your-app-name
fly volumes create whoop_data --region ord --size 1
```

### 3. Set your secrets
```bash
fly secrets set \
  WHOOP_CLIENT_ID=xxx \
  WHOOP_CLIENT_SECRET=xxx \
  ANTHROPIC_API_KEY=xxx \
  APP_URL=https://your-app-name.fly.dev
```

### 4. Add your deployed URL as a Whoop redirect URI
In the Whoop developer portal, add `https://your-app-name.fly.dev/auth/callback` as an allowed redirect URI.

### 5. Deploy
```bash
fly deploy
```

Your dashboard will be live at `https://your-app-name.fly.dev`.

### Updates
```bash
fly deploy   # redeploy after code changes
```

## Apple Watch

Open the dashboard → Brief tab → Apple Watch Setup. The shortcut URL is auto-filled with your server's address — just copy and paste it into the iOS Shortcuts app.
