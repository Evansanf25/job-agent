# Job Agent

A personal job search tool with AI-powered fit scoring, JD analysis, and cover letter generation.

## Project structure

```
job-agent/
├── server/          # Node/Express backend → deploy to Railway
│   ├── index.js     # API routes
│   ├── db.js        # Postgres connection + schema
│   ├── claude.js    # Anthropic API calls
│   └── .env.example
├── client/          # React frontend → deploy to Vercel
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/
│   │   │   ├── Search.js    # Job search tab
│   │   │   ├── Analyze.js   # Paste JD tab
│   │   │   └── Tracker.js   # Application tracker
│   └── .env.example
├── railway.json     # Railway deploy config
└── vercel.json      # Vercel deploy config
```

---

## Local development

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Set up environment variables

```bash
# In server/
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and DATABASE_URL
```

For local dev you can use a local Postgres instance, or skip the DB and test Claude calls directly.

### 3. Run the server

```bash
cd server && npm run dev
```

### 4. Run the client (separate terminal)

```bash
cd client && npm start
```

App runs at `http://localhost:3000`, server at `http://localhost:3001`.

---

## Deploying to Railway (backend)

### 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/job-agent.git
git push -u origin main
```

### 2. Create a Railway project

- Go to railway.app → New Project → Deploy from GitHub repo
- Select your `job-agent` repo
- Railway will auto-detect `railway.json` and use it

### 3. Add Postgres

- In Railway dashboard → your project → Add Service → Database → PostgreSQL
- Railway automatically sets `DATABASE_URL` in your environment

### 4. Add environment variables

In Railway → your service → Variables, add:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLIENT_URL=https://your-app.vercel.app   (add after Vercel deploy)
```

Railway sets `PORT` and `DATABASE_URL` automatically.

### 5. Deploy

Railway deploys automatically on every `git push`. Your backend URL will be something like `https://job-agent-production.up.railway.app`.

---

## Deploying to Vercel (frontend)

### 1. Go to vercel.com → New Project → Import your GitHub repo

### 2. Add environment variable

In Vercel → Project Settings → Environment Variables:
```
REACT_APP_API_URL=https://your-railway-backend-url.up.railway.app
```

### 3. Deploy

Vercel builds and deploys automatically. Your app URL will be `https://job-agent.vercel.app` (or similar).

### 4. Update CORS on Railway

Go back to Railway → Variables and update:
```
CLIENT_URL=https://your-actual-vercel-url.vercel.app
```

Then redeploy Railway (push any small change to GitHub).

---

## Updating your resume

Open `server/claude.js` and edit the `RESUME` constant at the top of the file. Keep it concise — 3-5 sentences covering your role, background, key skills, and target.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/search` | Generate scored job listings |
| POST | `/api/analyze` | Analyze a pasted JD, save to DB |
| POST | `/api/applications/:id/cover-letter` | Draft cover letter for saved application |
| GET | `/api/applications` | Get all saved applications |
| PATCH | `/api/applications/:id` | Update status, notes, or URL |
| DELETE | `/api/applications/:id` | Remove an application |
