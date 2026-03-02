# MeritMatrix - Deployment Guide

## 1. Supabase Setup

1. Go to https://supabase.com → New Project
2. Name: "meritmatrix" | Region: Asia South (Mumbai)
3. Wait for setup to complete
4. Go to **SQL Editor** → paste entire `SUPABASE_SCHEMA.sql` → Run
5. Go to **Authentication** → Settings:
   - Enable Email OTP
   - Site URL: https://your-domain.netlify.app
   - Redirect URLs: https://your-domain.netlify.app/**
6. Copy from **Settings → API**:
   - `Project URL` → VITE_SUPABASE_URL
   - `anon public key` → VITE_SUPABASE_ANON_KEY

## 2. Make Yourself Admin

After signup, run in Supabase SQL Editor:
```sql
INSERT INTO roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';
```

## 3. Copy Logos to Supabase Storage (Optional)

1. Supabase → Storage → New bucket: "logos" (public)
2. Upload all .webp and .png files from `/public/logos/`
3. Update logo URLs in the logos table to use Supabase storage URLs

## 4. Local Development

```bash
git clone <repo>
cd meritmatrix
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

## 5. Deploy to Netlify

### Option A: CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Option B: GitHub Integration
1. Push code to GitHub
2. Netlify → New Site → Import from GitHub
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

## 6. Environment Variables

Required in Netlify Dashboard (Site → Environment Variables):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
```

## 7. Custom Domain (Optional)

Netlify → Domain Settings → Add custom domain
Add CNAME record pointing to your Netlify URL

## 8. Adding Questions via CSV

Admin Panel → Questions → Paste CSV in this format:
```csv
question_text,option_a,option_b,option_c,option_d,correct_answer,marks,negative_marks,subject,explanation
What is the capital of Odisha?,Cuttack,Bhubaneswar,Puri,Rourkela,b,1,0.25,GK,Bhubaneswar is the capital
```

## 9. Scalability Notes

- Supabase free tier: 500MB DB, 50,000 MAU — sufficient for ~5,000 students
- For 50,000+ students: Upgrade to Supabase Pro ($25/month)
- Add CDN (Cloudflare) in front of Netlify for performance
- Images: Move to Supabase Storage or Cloudflare R2 for better performance
- For high concurrency during exams: Add Supabase connection pooling (PgBouncer)

## File Structure

```
meritmatrix/
├── src/
│   ├── App.jsx          # Complete app (all components)
│   └── main.jsx         # React entry
├── public/
│   └── logos/           # Agency logos
├── index.html
├── vite.config.js
├── package.json
├── netlify.toml
├── .env.example
└── SUPABASE_SCHEMA.sql
```
