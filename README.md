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

## Prototype identity

Authentication is not implemented. Enter an existing user UUID to register or view registrations, and an organizer UUID to view attendee IDs. These IDs are caller-supplied and do not provide real access control.

The current API does not create events; the organizer dashboard only displays existing events and registrations.
