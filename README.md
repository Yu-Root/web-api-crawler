# API Crawler Tool

A web-based API crawler tool with frontend interface for capturing and analyzing HTTP requests.

## Features

- **Two Modes**: Anonymous mode and logged-in mode (Cookie injection)
- **Real-time Capture**: Capture all HTTP requests using Playwright
- **Filter by Method**: Filter requests by GET/POST/PUT/DELETE/PATCH
- **Domain Filtering**: Filter requests by specific domains
- **Export**: Export captured requests as JSON or HTML
- **Resizable Panel**: Drag to resize the Request Details panel

## Tech Stack

### Frontend

| Technology | Description |
|------------|-------------|
| React 18 | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |

### Backend

| Technology | Description |
|------------|-------------|
| Node.js | JavaScript runtime |
| Express.js | Web framework |
| Playwright | Browser automation |

## Project Structure

```
api-crawler/
├── client/                    # Frontend React Application
│   ├── src/
│   │   ├── components/       # UI Components
│   │   │   ├── ExportButton.jsx
│   │   │   ├── RequestDetail.jsx
│   │   │   ├── RequestFilter.jsx
│   │   │   └── RequestList.jsx
│   │   ├── pages/
│   │   │   └── Crawler.jsx   # Main Page
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                    # Backend Server
│   ├── index.js              # Express Server Entry
│   ├── routes/
│   │   └── crawl.js         # Crawler API Routes
│   ├── services/
│   │   └── playwright.js     # Playwright Crawler Service
│   └── package.json
│
└── package.json              # Root Package (npm scripts)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/api-crawler.git
cd api-crawler

# Install all dependencies
npm install

# Or install separately
cd server && npm install
cd ../client && npm install
```

### Development

#### Start Backend Server (Port 3001)

```bash
cd server
npm start
```

The server will start at http://localhost:3001

#### Start Frontend (Port 5173)

```bash
cd client
npm run dev
```

The frontend will start at http://localhost:5173

### Production Build

```bash
cd client
npm run build
```

The built files will be in the `dist/` folder.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crawl/start` | POST | Start crawling |
| `/api/crawl/stop` | POST | Stop crawling |
| `/api/crawl/status` | GET | Get crawler status |
| `/api/health` | GET | Health check |

### Start Crawl Request Example

```bash
curl -X POST http://localhost:3001/api/crawl/start \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "filters": {
      "domains": ["api.example.com"]
    },
    "waitTime": 10000,
    "headless": false
  }'
```

## Configuration

### Frontend Options

| Option | Description | Default |
|--------|-------------|---------|
| URL | Target URL to crawl | - |
| Mode | Anonymous or Logged In | anonymous |
| Cookies | Cookie string for logged-in mode | - |
| Filter Domain | Filter by domain | - |
| Wait (s) | Wait time for requests | 10 |
| Headless | Enable/disable headless mode | false |

### Backend Options

| Option | Description | Default |
|--------|-------------|---------|
| url | Target URL to crawl | required |
| cookies | Array of cookie objects | [] |
| filters.domains | Array of domain filters | [] |
| filters.methods | Array of method filters | [] |
| waitTime | Wait time in milliseconds | 10000 |
| headless | Run browser in headless mode | true |

## License

MIT
