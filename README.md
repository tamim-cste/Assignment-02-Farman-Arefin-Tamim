# Sanctuary Cap Cana – Resort Detail Page

A full-stack web application showcasing a luxury all-inclusive resort with dynamic property listings, interactive gallery, map integration, and booking functionality.

## Features

- **Dynamic Property Listings** – Sort properties by most popular, highest price, or lowest price
- **Interactive Gallery** – Mobile-responsive image gallery with modal and touch support
- **Google Maps Integration** – Display nearby properties on an interactive map
- **Booking System** – Check villa availability with real-time price calculation
- **Responsive Design** – Optimized for desktop and mobile devices
- **Favorites System** – Save favorite properties to browser local storage

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:**  Express.js
- **APIs:** Google Maps API


## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env` file in the project root and add your Google Maps API key:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

### Production Build

```bash
npm start
```

## Project Structure

```
├── public/
│   ├── index.html          # Main HTML page
│   ├── style.css           # Stylesheet
│   ├── assets/             # Images and logo
│   └── js/
│       └── app.js          # Frontend JavaScript logic
├── data/
│   ├── most_popular.json   # Popular properties data
│   ├── highest_price.json  # High-priced properties data
│   └── lowest_price.json   # Budget-friendly properties data
├── images/                 # Resort images
├── server.js               # Express server
├── package.json            # Dependencies and scripts
└── .env                    # Environment variables (not included)
```

## API Endpoints

- `GET /` – Serve main application
- `GET /images` – Get list of available image URLs
- `GET /get-property` – Fetch property data
  - Query parameters:
    - `most-popular=true` – Load popular properties
    - `highest-price=true` – Load expensive properties
    - `lowest-price=true` – Load budget properties
    - `limit=n` – Limit results to n properties

## Troubleshooting

If port 3000 is already in use, kill the existing process:

```bash
lsof -i :3000
kill -9 <PID>
```



## 📂 Repository

[GitHub Repository](https://github.com/tamim-cste/Assignment-02-Farman-Arefin-Tamim-?utm_source=chatgpt.com)

---

## 👨‍💻 Author

**Farman Arefin Tamim**

Software Engineer Intern
at W3 Engineers Ltd.
