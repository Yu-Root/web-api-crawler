const express = require('express');
const cors = require('cors');
const path = require('path');
const crawlRouter = require('./routes/crawl');
const modulesRouter = require('./routes/modules');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - increase limit for large request bodies (e.g., response data)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    // Routes
    app.use('/api/crawl', crawlRouter);
    app.use('/api/modules', modulesRouter);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Static docs
    app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

    app.listen(PORT, () => {
      console.log(`API Crawler Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
