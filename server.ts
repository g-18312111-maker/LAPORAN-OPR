import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(session({
  secret: 'sacred-heart-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true, 
    sameSite: 'none',
    httpOnly: true
  }
}));

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxzy6jYmJAaSCMmr9MYpiP7rhTHM-AfcBro3pUWRvkTKv7pvz5dexIb7SLGkS4xGGk/exec";

// API Routes
app.post("/api/sheets/submit", async (req, res) => {
  try {
    console.log('Submitting to Apps Script. Payload size:', JSON.stringify(req.body).length);
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(req.body),
    });

    const result = await response.json();
    console.log('Apps Script response:', result);
    res.json(result);
  } catch (error) {
    console.error('Error submitting to Apps Script:', error);
    res.status(500).json({ error: 'Failed to submit to Google Sheets' });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
