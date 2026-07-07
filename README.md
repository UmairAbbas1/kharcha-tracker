# Kharcha Tracker

Kharcha Tracker is a clean, responsive expense tracker for recording daily spending, viewing category breakdowns, and watching your total balance update in real time. It uses a React + Vite frontend and an Express + lowdb backend, so everything stays lightweight and easy to run locally.

## What It Does

- Add, edit, and delete expenses.
- Track spending by category and by day.
- See total spend, count of expenses, and visual summaries.
- Persist data locally in a JSON database.
- Work smoothly on the frontend with a simple `/api` proxy to the backend.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, Axios, Lucide React
- Backend: Node.js, Express, lowdb, CORS
- Storage: `backend/db.json`

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm available in both `frontend` and `backend`

### Install Dependencies

Open two terminals and run:

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### Start the App

Start the backend first:

```bash
cd backend
npm run dev
```

Then start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open the app at `http://localhost:5173`.

### Windows Shortcuts

If you are on Windows, you can also use the included batch files:

- `START HERE.bat` starts both servers.
- `start-backend.bat` starts only the API.
- `start-frontend.bat` starts only the frontend.

## Default Ports

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## API Overview

The frontend talks to the backend through these endpoints:

- `GET /api/expenses` - list all expenses
- `GET /api/expenses/:id` - get a single expense
- `POST /api/expenses` - create a new expense
- `PUT /api/expenses/:id` - update an expense
- `DELETE /api/expenses/:id` - delete an expense
- `GET /api/stats` - get totals, category summary, and recent daily spending

## Data Model

Each expense contains:

- `id`
- `title`
- `amount`
- `category`
- `date`
- `created_at`

Valid categories are:

- Food
- Transport
- Rent
- Fun
- Other

## Project Structure

```text
kharcha-tracker/
├── backend/
│   ├── db.json
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api.js
│       ├── App.jsx
│       ├── constants.js
│       ├── index.css
│       ├── main.jsx
│       └── components/
├── START HERE.bat
├── start-backend.bat
├── start-frontend.bat
└── README.md
```

## Notes

- The backend seeds sample expense data automatically the first time `backend/db.json` is empty.
- The frontend uses a Vite proxy for `/api`, so local development works without manual CORS handling in the browser.
