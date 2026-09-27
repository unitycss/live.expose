# live.expose

Two consoles, one live site:

- **`index.html`** — the public gallery. Anyone can view it, nobody can upload from it. This is what "goes to GitHub → Vercel."
- **`owner.html`** — your private upload console. Open it from your own browser (any computer), enter your owner key once, and every upload/delete goes straight to the live site — no redeploy needed.
- **`api/images.js`** — the serverless backend both pages talk to. It stores images in Vercel Blob storage and a small JSON manifest alongside them.

## 1. Push to GitHub

```bash
cd live-expose
git init
git add .
git commit -m "live.expose"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## 2. Import into Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Other** (no build step needed).
3. Deploy.

## 3. Turn on Blob storage

1. In the Vercel project → **Storage** tab → **Create Database** → **Blob**.
2. Connect it to this project. Vercel automatically adds the `BLOB_READ_WRITE_TOKEN` env var for you.

## 4. Set your owner key

1. Project → **Settings → Environment Variables**.
2. Add `OWNER_KEY` = some long random string only you know (this is your password).
3. Redeploy so the function picks it up.

## 5. Use it

- Public site: `https://your-project.vercel.app/`
- Owner console: `https://your-project.vercel.app/owner.html` — paste your `OWNER_KEY` in, then upload. It appears on the public gallery within seconds (the public page polls every 15s, or refresh manually).

## Notes / limits

- Images are capped at 4MB each (Vercel's serverless request-body limit on the Hobby plan). For bigger originals, resize before upload.
- `owner.html` stores your key only in `sessionStorage` (cleared when you close the tab) — never in the repo or on the public page.
- The category pills on the public site are generated automatically from whatever category text you type per image — no code changes needed to add a new one.
