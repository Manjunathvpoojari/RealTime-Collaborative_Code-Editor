const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app      = express();
const distPath = path.join(__dirname, 'dist');

if (!fs.existsSync(distPath)) {
  console.error('ERROR: dist folder not found! Run "npm run build" first.');
  process.exit(1);
}

console.log('✓ dist folder found');

app.use(express.static(distPath));

// SPA fallback — serve index.html for any non-file route
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Client running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});