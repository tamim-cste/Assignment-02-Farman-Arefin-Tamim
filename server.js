require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

//  Serve static frontend 
app.use(express.static(path.join(__dirname, 'public')));

// Serve images
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/load-google-maps.js', (req, res) => {
  if (!GOOGLE_MAPS_API_KEY) {
    res.status(500).type('text/javascript').send("console.error('Missing GOOGLE_MAPS_API_KEY environment variable');");
    return;
  }

  res.type('text/javascript').send(`(function() {
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  })();`);
});

// GET /images  →  returns list of image URLs
app.get('/images', (req, res) => {
  const dir = path.join(__dirname, 'images');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Cannot read images directory' });
    const urls = files
      .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))
      .map(f => `/images/${f}`);
    res.json(urls);
  });
});

// GET /get-property for fetching property data based on query parameters
app.get('/get-property', (req, res) => {
  const { 'most-popular': mostPopular, 'highest-price': highestPrice,
          'lowest-price': lowestPrice, limit } = req.query;

  let file;
  if (mostPopular  === 'true') file = 'most_popular.json';
  else if (highestPrice === 'true') file = 'highest_price.json';
  else if (lowestPrice  === 'true') file = 'lowest_price.json';
  else file = 'most_popular.json'; // default

  const filePath = path.join(__dirname, 'data', file);

  fs.readFile(filePath, 'utf8', (err, raw) => {
    if (err) return res.status(500).json({ error: 'Data file not found' });

    const data  = JSON.parse(raw);
    let items   = data?.Result?.Items ?? [];

    if (limit) {
      const n = parseInt(limit, 10);
      if (!isNaN(n) && n > 0) items = items.slice(0, n);
    }

    res.json({ items });
  });
});

// The Server is Start from here make sure to run this file with npm run dev and before running it kill the poccess with port 3000 if it is already running by using the command lsof -i :3000 and then kill -9 <PID>
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
