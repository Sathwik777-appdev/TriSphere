# TriSphere Backend

Backend API server for the TriSphere educational platform.

## Overview

This backend server provides API endpoints for TriSphere's functionality, including:
- GitHub repository integration for textbook PDFs

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=Sathwik777-appdev
GITHUB_REPO=trisphere-pdfs
PORT=3000
FRONTEND_URL=http://localhost:5173
```

> **Note**: The `.env.example` file is provided as a template.

### 3. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on port 3000 by default (or the port specified in `.env`).

## API Endpoints

### Health Check
- **GET** `/health`
- Returns server status
- Response: `{ "status": "ok", "message": "TriSphere backend server is running" }`



## Project Structure

```
backend/
├── routes/
│   ├── ai.js           # AI/Astra helper routes
│   └── reports.js      # Reports / analytics routes
├── .env                # Environment variables (not in git)
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies and scripts
└── server.js           # Main server file
```

## Running with Frontend

To run both frontend and backend servers simultaneously from the root directory:

```bash
npm run dev:all
```

This will start:
- Frontend (Vite) on port 5173
- Backend (Express) on port 3000

## CORS Configuration

The server is configured to accept requests from the frontend URL specified in the `FRONTEND_URL` environment variable (default: `http://localhost:5173`).

## Error Handling

All API endpoints include comprehensive error handling with appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

## Development

The backend uses Node.js with the `--watch` flag in development mode, which automatically restarts the server when files change.

## Security Notes

- Never commit the `.env` file to version control
- Keep your GitHub token secure
- Use environment variables for all sensitive data
- The `.gitignore` file is configured to exclude `.env` files

## Dependencies

- **express**: Web framework for Node.js
- **cors**: Enable Cross-Origin Resource Sharing
- **dotenv**: Load environment variables from .env file
