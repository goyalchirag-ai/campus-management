# Gather

Gather is a Flask event-registration app. Flask serves the responsive frontend and JSON API from one Render web service.

## Run locally

Create `Backend/.env` with:

```text
SUPABASE_URL=your-supabase-project-url
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Install dependencies and run:

```powershell
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`. The app uses the `users`, `events`, and `registrations` tables described by the project schema.

## Deploy on Render

Create a Blueprint from this repository using `render.yaml`, or configure a Python web service with:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the Render environment. Render's health check uses `/health`.

## Separate frontend on Render

The frontend can also be deployed independently as a Render **Static Site**.
The build renders the shared templates without starting Flask or accessing the database.

1. Create a Static Site from this repository, branch `main`, with Root Directory left blank.
2. Set Build Command to `pip install -r frontend-requirements.txt && python build_frontend.py`.
3. Set Publish Directory to `dist`.
4. Add `API_BASE_URL` with the public backend origin (for example `https://your-backend.onrender.com`, without `/api`). This public URL is embedded during build; rebuild after changing it. No database keys belong in the frontend service.
5. Add these Rewrite rules under Redirects/Rewrites:

   | Source | Destination | Action |
   | --- | --- | --- |
   | `/events/*` | `/event.html` | Rewrite |
   | `/registrations` | `/registrations.html` | Rewrite |
   | `/organizer` | `/organizer.html` | Rewrite |

6. On the backend service, set `FRONTEND_ORIGINS` to the frontend origin (for example `https://campus-management-frontend.onrender.com`). Multiple origins can be comma-separated. Redeploy the backend after setting it.
7. Open the frontend URL, check event browsing, open an event directly, and verify registration and organizer pages.

Alternatively, the repository's `render.yaml` defines both services and these rewrite rules for a Blueprint deployment.

For a local frontend preview, set `API_BASE_URL=http://localhost:5000`, run `python build_frontend.py`, and serve `dist` with a static server supporting the rewrite rules above. Set the backend's `FRONTEND_ORIGINS` to the preview server's origin.

## Prototype identity

Authentication is not implemented. Enter an existing user UUID to register or view registrations, and an organizer UUID to view attendee IDs. These IDs are caller-supplied and do not provide real access control.

The current API does not create events; the organizer dashboard only displays existing events and registrations.
