# Domain Monitor & Search Bot

Multi-service NestJS application with two standalone services:

- **Monitor** — Scheduled domain availability monitoring with Signal/VipTalk notifications
- **Search Bot** — Signal group bot that responds to `/search {keyword}` with Google results via SerpAPI

---

## Prerequisites

| Requirement             | Version                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| Node.js                 | 22+                                                                               |
| pnpm                    | 9+                                                                                |
| Docker & Docker Compose | Latest                                                                            |
| signal-cli-rest-api     | [bbernhard/signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) |
| SerpAPI account         | [serpapi.com](https://serpapi.com) (search bot only)                              |

---

## 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. Here's a breakdown of all variables:

### App

| Variable   | Description                                | Default       |
| ---------- | ------------------------------------------ | ------------- |
| `PORT`     | HTTP server port                           | `3000`        |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |

### Database

| Variable            | Description         | Default          |
| ------------------- | ------------------- | ---------------- |
| `DATABASE_HOST`     | PostgreSQL host     | `localhost`      |
| `DATABASE_PORT`     | PostgreSQL port     | `5432`           |
| `DATABASE_USER`     | PostgreSQL user     | `postgres`       |
| `DATABASE_PASSWORD` | PostgreSQL password | `postgres`       |
| `DATABASE_NAME`     | Database name       | `domain_monitor` |

### API Security

| Variable  | Description                              | Default |
| --------- | ---------------------------------------- | ------- |
| `API_KEY` | API key for the monitor webhook endpoint | —       |

### Signal Bot

| Variable          | Description                         | Example                 |
| ----------------- | ----------------------------------- | ----------------------- |
| `SIGNAL_API_URL`  | signal-cli REST API base URL        | `http://localhost:8080` |
| `SIGNAL_ACCOUNT`  | Your registered Signal phone number | `+841234567890`         |
| `SIGNAL_GROUP_ID` | Signal group ID to send messages to | `RtinXRAcpX/rgUJL...`   |

> **How to get your group ID:**
>
> ```bash
> curl http://localhost:8080/v1/groups/<your-number>
> ```
>
> Use the `id` field from the response.

### VipTalk Bot

| Variable            | Description              | Example                    |
| ------------------- | ------------------------ | -------------------------- |
| `VIPTALK_API_URL`   | VipTalk API base URL     | `https://api.viptalk.org`  |
| `VIPTALK_BOT_TOKEN` | Bot authentication token | —                          |
| `VIPTALK_ROOM_ID`   | Target room ID           | `!room:matrix.viptalk.org` |

### Bot Behavior

| Variable                | Description                         | Default  |
| ----------------------- | ----------------------------------- | -------- |
| `BOT_TIMEOUT_MS`        | HTTP request timeout (ms)           | `10000`  |
| `BOT_RETRY_ATTEMPTS`    | Number of retry attempts on failure | `3`      |
| `NOTIFICATION_PROVIDER` | `signal` or `viptalk`               | `signal` |

### SerpAPI (Search Bot)

| Variable                | Description                                    | Default      |
| ----------------------- | ---------------------------------------------- | ------------ |
| `SERPAPI_API_KEY`       | Your SerpAPI key **(required for search bot)** | —            |
| `SERPAPI_ENGINE`        | Search engine                                  | `google`     |
| `SERPAPI_GL`            | Country code                                   | `vn`         |
| `SERPAPI_HL`            | Language                                       | `vi`         |
| `SERPAPI_LOCATION`      | Geographic origin                              | `Vietnam`    |
| `SERPAPI_GOOGLE_DOMAIN` | Regional Google domain                         | `google.com` |
| `SERPAPI_NUM`           | Number of results to return                    | `10`         |
| `SERPAPI_DEVICE_MB`     | Device type for results                        | `mobile`     |

---

## 2. Setup Infrastructure

Start PostgreSQL and signal-cli via Docker Compose:

```bash
docker compose up -d
```

This starts:

| Container               | Image                           | Port | Purpose                              |
| ----------------------- | ------------------------------- | ---- | ------------------------------------ |
| `domain-monitor-db`     | `postgres:16-alpine`            | 5432 | Database                             |
| `domain-monitor-signal` | `bbernhard/signal-cli-rest-api` | 8080 | Signal messaging API (`native` mode) |

### Link signal-cli to your phone

Run the setup script — it handles container restart, QR code generation, linking, and group discovery:

```bash
./scripts/signal-setup.sh
```

The script will:

1. Restart the signal-cli container with fresh data
2. Open a QR code in your browser
3. Wait for you to scan it with Signal (Settings → Linked Devices → Link New Device)
4. Display your available Signal groups and their IDs

---

## 3. Run Migrations

```bash
# Install dependencies
pnpm install

# Apply existing migrations
pnpm migration:run

# After entity changes, generate a new migration
pnpm migration:compare
```

---

## 4. Development

```bash
# Start the monitor service (domain availability checks)
pnpm dev monitor

# Start the search bot (Signal /search command handler)
pnpm dev search
```

Both services use `nest start --watch` for hot-reload during development.

---

## 5. Production Deployment

### Build

```bash
pnpm build
```

### Run with Node

```bash
# Monitor service
pnpm monitor:prod

# Search bot service
pnpm search:prod
```

### Run with Docker

Add an `app` service to `docker-compose.yaml` for containerized deployment:

```yaml
app:
  build: .
  env_file: .env
  depends_on:
    postgres:
      condition: service_healthy
    signal-cli:
      condition: service_started
  command: ['node', 'dist/cmd/search/main']
  restart: unless-stopped
```

Then:

```bash
docker compose up -d --build
docker compose logs -f app
```

---

## Architecture

### How the Search Bot Works

```
Signal Group → signal-cli (native mode, port 8080)
                    ↓
         Search Bot polls GET /v1/receive/{number}
         every 5 seconds via @nestjs/schedule
                    ↓
         Filters messages starting with /search
                    ↓
         Queries SerpAPI for Google results
                    ↓
         Sends response via POST /v2/send
         back to the Signal group
                    ↓
         Logs to search_logs table in PostgreSQL
```

The bot handles both:

- **`dataMessage`** — messages from other users in the group
- **`syncMessage.sentMessage`** — messages sent from your own linked device

### Commands

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `/search <keyword>`    | Search Google and return top results |
| `/search` (no keyword) | Show usage guide                     |

### Error Messages (Vietnamese)

| Scenario        | Message                                            |
| --------------- | -------------------------------------------------- |
| Timeout         | `Tìm kiếm bị timeout sau 15s. Vui lòng thử lại.`   |
| Invalid API key | `API key không hợp lệ.`                            |
| Quota exceeded  | `API key đã hết quota.`                            |
| Rate limited    | `Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.` |
| Unexpected      | `Đã xảy ra lỗi không mong muốn.`                   |

---

## Project Structure

```
src/
├── cmd/
│   ├── monitor/                  # Monitor app entry
│   │   ├── main.ts
│   │   └── app.module.ts
│   └── search/                   # Search bot app entry
│       ├── main.ts
│       └── app.module.ts
├── modules/
│   ├── database/
│   │   ├── entities/
│   │   │   ├── domain-monitor-log.entity.ts
│   │   │   └── search-log.entity.ts
│   │   └── migrations/
│   ├── domain-monitor/           # Domain monitoring logic
│   ├── notification/             # Signal & VipTalk notification services
│   └── search-bot/               # Search bot module
│       ├── interfaces/
│       ├── signal-listener.service.ts   # Polls signal-cli for messages
│       ├── search-bot.service.ts        # Command handler & formatter
│       ├── search-bot.module.ts
│       └── serpapi.service.ts           # Google search via SerpAPI
├── data-source.ts                # TypeORM CLI data source
└── main.ts                       # Default entry (monitor)
```
