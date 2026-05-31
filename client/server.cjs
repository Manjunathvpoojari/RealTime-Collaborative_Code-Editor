const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const distPath = path.join(__dirname, 'dist');

// Check if dist exists
if (!fs.existsSync(distPath)) {
  console.error('ERROR: dist folder not found! Build may have failed.');
  process.exit(1);
}

console.log('✓ dist folder found');

app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Client running on port ${PORT}`);
});