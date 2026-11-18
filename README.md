# Where Is My Stuff?

A camera-first React + Vite app for saving belongings with their real storage places. The app uses Supabase for sign-in, item and location records, and private photo storage. Photo suggestions are provided by a server-side OpenAI vision request; the browser never receives the OpenAI API key.

## Set up Supabase

1. Create a Supabase project and copy its Project URL and publishable/anon key from **Project Settings → API**.
2. Copy `.env.example` to `.env`. Add the Supabase URL and anon key to the `VITE_` variables.
3. In the Supabase SQL Editor, run `supabase/schema.sql`. It creates the item and location tables, user-scoped Row Level Security policies, default rooms for new accounts, and a private photo bucket with per-user storage policies.
4. In **Authentication → URL Configuration**, add your local site URL (`http://localhost:5173`) and deployed site URL to the allowed redirect URLs.

The app stops at a setup screen when Supabase is not configured. Do not put a service-role key in the browser or a `VITE_` variable.

## Optional photo identification

Add an OpenAI API key to the server-only `OPENAI_API_KEY` variable in `.env`. The default vision model is `gpt-4o-mini`; set `OPENAI_VISION_MODEL` to another supported vision model if desired. The API key is read only by the Node server. A signed-in user's photo is sent to this server only after they press **Continue** on the photo preview. The server verifies the Supabase access token, validates image type and size, applies rate limiting, and asks the model for structured item suggestions. If no key is configured or AI is unavailable, users can enter the details manually.

The model does not choose a storage location. Users select the room and storage place themselves. The private Supabase photo bucket and database policies restrict each user to their own records and photos.

## Run locally

```sh
npm install
npm run dev
```

This starts the Vite frontend and local Node API. Camera access requires HTTPS or localhost.

## Deploy to Vercel

1. Import this project into Vercel and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Production environment variables.
2. Deploy the project. Vercel rewrites app routes such as `/signup` and `/app/scan` to the React entry point.
3. Add the deployed site URL to Supabase **Authentication → URL Configuration** as both the Site URL and an allowed redirect URL. Local signup confirmations use the current site origin.
4. Optional photo identification requires a server-side `OPENAI_API_KEY`. Without it, the app provides manual item entry; never add this key as a `VITE_` variable.

For a local production build, run `npm run build`. Keep `.env` out of source control.
