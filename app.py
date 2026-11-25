import os
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"))

app = Flask(__name__)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError(
        "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Backend/.env."
    )

supabase: Client = create_client(supabase_url, supabase_key)


def valid_uuid(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        return None


def database_error():
    app.logger.exception("Supabase request failed")
    return jsonify(error="Database request failed."), 500


@app.route("/")
def index():
    try:
        response = supabase.table("users").select("email").execute()
    except APIError:
        return database_error()

    users = response.data
    html = "<h1>users</h1><ul>"
    for user in users:
        html += f"<li>{user['email']}</li>"
    html += "</ul>"
    return html


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.get("/api/events")
def list_events():
    try:
        response = supabase.table("events").select("*").execute()
    except APIError:
        return database_error()
    return jsonify(response.data)


@app.get("/api/events/<event_id>")
def get_event(event_id):
    event_id = valid_uuid(event_id)
    if event_id is None:
        return jsonify(error="event id must be a valid UUID."), 400

    try:
        response = (
            supabase.table("events")
            .select("*")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
    except APIError:
        return database_error()

    if not response.data:
        return jsonify(error="Event not found."), 404
    return jsonify(response.data[0])


@app.post("/api/registrations")
def create_registration():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Request body must be a JSON object."), 400

    user_id = valid_uuid(payload.get("user_id"))
    event_id = valid_uuid(payload.get("event_id"))
    if user_id is None or event_id is None:
        return jsonify(error="user_id and event_id must be valid UUIDs."), 400

    try:
        event_response = (
            supabase.table("events")
            .select("id, capacity")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not event_response.data:
            return jsonify(error="Event not found."), 404

        user_response = (
            supabase.table("users")
            .select("id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not user_response.data:
            return jsonify(error="User not found."), 404

        existing_response = (
            supabase.table("registrations")
            .select("id")
            .eq("user_id", user_id)
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
        if existing_response.data:
            return jsonify(error="User is already registered for this event."), 409

        registration_count = (
            supabase.table("registrations")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .execute()
            .count
        )
        if registration_count is None:
            app.logger.error("Supabase did not return the registration count.")
            return jsonify(error="Could not verify event capacity."), 500

        capacity = event_response.data[0]["capacity"]
        if capacity is not None and registration_count >= capacity:
            return jsonify(error="Event is at capacity."), 409

        response = (
            supabase.table("registrations")
            .insert({"user_id": user_id, "event_id": event_id})
            .execute()
        )
    except APIError as error:
        if getattr(error, "code", None) == "23505":
            return jsonify(error="User is already registered for this event."), 409
        return database_error()

    return jsonify(response.data[0]), 201


@app.get("/api/me/registrations")
def get_my_registrations():
    user_id = valid_uuid(request.args.get("user_id"))
    if user_id is None:
        return jsonify(error="A valid user_id query parameter is required."), 400

    try:
        response = (
            supabase.table("registrations")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
    except APIError:
        return database_error()
    return jsonify(response.data)


@app.get("/api/events/<event_id>/registrations")
def get_event_registrations(event_id):
    event_id = valid_uuid(event_id)
    organizer_id = valid_uuid(request.args.get("organizer_id"))
    if event_id is None:
        return jsonify(error="event id must be a valid UUID."), 400
    if organizer_id is None:
        return jsonify(error="A valid organizer_id query parameter is required."), 400

    try:
        event_response = (
            supabase.table("events")
            .select("id, organizer_id")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not event_response.data:
            return jsonify(error="Event not found."), 404
        if event_response.data[0]["organizer_id"] != organizer_id:
            return jsonify(error="Only the event organizer can view registrations."), 403

        response = (
            supabase.table("registrations")
            .select("*")
            .eq("event_id", event_id)
            .execute()
        )
    except APIError:
        return database_error()
    return jsonify(response.data)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG", "").lower() == "true",
    )
