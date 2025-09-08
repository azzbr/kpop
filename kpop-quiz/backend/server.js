const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const COUNTER_FILE = path.join(__dirname, 'data', 'counter.json');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize counter file if it doesn't exist
if (!fs.existsSync(COUNTER_FILE)) {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ totalTests: 0 }, null, 2));
}

// Helper function to read counter
function readCounter() {
  try {
    const data = fs.readFileSync(COUNTER_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading counter file:', error);
    return { totalTests: 0 };
  }
}

// Helper function to write counter
function writeCounter(data) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing counter file:', error);
  }
}

// Routes
app.get('/api/counter', (req, res) => {
  const counter = readCounter();
  res.json(counter);
});

app.post('/api/increment', (req, res) => {
  const counter = readCounter();
  counter.totalTests += 1;
  writeCounter(counter);
  res.json(counter);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
