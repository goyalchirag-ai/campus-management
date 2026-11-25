const USER_ID_KEY = "gather.userId";
const ORGANIZER_ID_KEY = "gather.organizerId";

const getSavedId = (key) => window.localStorage.getItem(key) || "";

function setMessage(element, message, tone = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function saveIdentityForm(form, input, key, message) {
  if (!form || !input) return;
  input.value = getSavedId(key);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setMessage(message, "Enter an ID before saving.", "error");
      return;
    }
    window.localStorage.setItem(key, value);
    setMessage(message, "ID saved in this browser.", "success");
    updateProfileLabel();
  });
}

function updateProfileLabel() {
  const label = document.getElementById("current-user-label");
  if (!label) return;
  const userId = getSavedId(USER_ID_KEY);
  label.textContent = userId ? `User ${userId.slice(0, 8)}…` : "Identity not set";
}

function renderEmpty(container, message) {
  container.replaceChildren(makeElement("div", "empty-state", message));
}

function renderEventCard(event) {
  const card = makeElement("article", "event-card");
  const top = makeElement("div", "event-card-top");
  const status = makeElement("span", "status-pill", event.status || "Status unavailable");
  top.append(status);

  const title = makeElement("h3", "", event.title || "Untitled event");
  const metadata = makeElement("div", "event-meta");
  const capacity = makeElement(
    "span",
    "",
    event.capacity === null ? "Unlimited capacity" : `Up to ${event.capacity} seats`,
  );
  const organizer = makeElement(
    "span",
    "",
    `Organizer ${event.organizer_id || "not assigned"}`,
  );
  metadata.append(capacity, organizer);

  const footer = makeElement("div", "event-card-footer");
  footer.append(makeElement("span", "capacity-copy", "Event details and registration"));
  const link = makeElement("a", "button button-secondary", "View event");
  link.href = `/events/${encodeURIComponent(event.id)}`;
  footer.append(link);

  card.append(top, title, metadata, footer);
  return card;
}

async function loadEvents() {
  const grid = document.getElementById("events-grid");
  const message = document.getElementById("events-message");
  const count = document.getElementById("event-count");
  if (!grid) return;

  try {
    const events = await apiRequest("/api/events");
    count.textContent = `${events.length} ${events.length === 1 ? "event" : "events"}`;
    if (events.length === 0) {
      setMessage(message, "");
      renderEmpty(grid, "No events have been published yet.");
      return;
    }
    grid.replaceChildren(...events.map(renderEventCard));
    setMessage(message, "");
  } catch (error) {
    count.textContent = "Unavailable";
    setMessage(message, error.message, "error");
  }
}

async function loadEventDetail() {
  const eventId = document.body.dataset.eventId;
  const message = document.getElementById("event-message");
  const panel = document.getElementById("event-detail");
  const registerInput = document.getElementById("register-user-id");
  const registerForm = document.getElementById("register-form");
  const registerMessage = document.getElementById("registration-message");
  const registerButton = document.getElementById("register-button");
  if (!eventId || !panel) return;

  if (registerInput) registerInput.value = getSavedId(USER_ID_KEY);
  let eventRecord;
  try {
    eventRecord = await apiRequest(`/api/events/${encodeURIComponent(eventId)}`);
    document.getElementById("event-title").textContent = eventRecord.title || "Untitled event";
    document.getElementById("event-status").textContent = eventRecord.status || "Status unavailable";
    document.getElementById("event-capacity").textContent =
      eventRecord.capacity === null ? "Unlimited" : `${eventRecord.capacity} seats`;
    document.getElementById("event-id").textContent = eventRecord.id;
    document.getElementById("event-organizer").textContent =
      eventRecord.organizer_id || "Not assigned";
    panel.hidden = false;
    setMessage(message, "");
  } catch (error) {
    setMessage(message, error.message, "error");
    if (message) message.dataset.tone = "error";
    return;
  }

  registerForm?.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const userId = registerInput.value.trim();
    if (!userId) {
      setMessage(registerMessage, "Enter your existing user UUID to register.", "error");
      return;
    }

    registerButton.disabled = true;
    setMessage(registerMessage, "Submitting your registration…");
    try {
      await apiRequest("/api/registrations", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, event_id: eventRecord.id }),
      });
      window.localStorage.setItem(USER_ID_KEY, userId);
      updateProfileLabel();
      setMessage(registerMessage, "Registration confirmed. Your pass is saved.", "success");
    } catch (error) {
      setMessage(registerMessage, error.message, "error");
    } finally {
      registerButton.disabled = false;
    }
  });
}

function renderRegistration(registration, eventRecord) {
  const row = makeElement("article", "ticket-row");
  const accent = makeElement("div", "ticket-accent");
  const main = makeElement("div", "ticket-row-main");
  const details = makeElement("div");
  details.append(
    makeElement("span", "status-pill", eventRecord.status || "Registered"),
    makeElement("h2", "ticket-title", eventRecord.title || "Event no longer available"),
  );
  const meta = makeElement("div", "ticket-meta");
  meta.append(makeElement("span", "", `Capacity: ${eventRecord.capacity ?? "Unlimited"}`));
  details.append(meta);

  const link = makeElement("a", "button button-secondary", "View event");
  link.href = `/events/${encodeURIComponent(registration.event_id)}`;
  main.append(details, link);

  const stub = makeElement("div", "ticket-stub");
  stub.append(
    makeElement("span", "eyebrow eyebrow-muted", "Registered"),
    makeElement(
      "span",
      "ticket-date",
      registration.created_at
        ? new Date(registration.created_at).toLocaleDateString()
        : "Date unavailable",
    ),
    makeElement("span", "capacity-copy", `Pass · ${registration.id.slice(0, 8)}`),
  );
  row.append(accent, main, stub);
  return row;
}

async function loadRegistrations(userId) {
  const message = document.getElementById("registrations-message");
  const grid = document.getElementById("registrations-grid");
  const count = document.getElementById("registration-count");
  setMessage(message, "Loading registrations…");
  grid.replaceChildren();

  try {
    const [registrations, events] = await Promise.all([
      apiRequest(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`),
      apiRequest("/api/events"),
    ]);
    const eventById = new Map(events.map((event) => [event.id, event]));
    const ordered = registrations.slice().sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
    count.textContent = `${ordered.length} ${ordered.length === 1 ? "registration" : "registrations"}`;
    if (ordered.length === 0) {
      renderEmpty(grid, "No registrations found for this user ID.");
      setMessage(message, "");
      return;
    }
    grid.replaceChildren(
      ...ordered.map((registration) =>
        renderRegistration(registration, eventById.get(registration.event_id) || {}),
      ),
    );
    setMessage(message, "");
  } catch (error) {
    count.textContent = "Unavailable";
    setMessage(message, error.message, "error");
  }
}

function renderOrganizerEvent(event, registrationCount, organizerId, attendees) {
  const card = makeElement("article", "organizer-event-card");
  const top = makeElement("div", "organizer-event-top");
  const details = makeElement("div");
  details.append(
    makeElement("span", "status-pill", event.status || "Status unavailable"),
    makeElement("h3", "", event.title || "Untitled event"),
    makeElement("div", "event-meta", `Event ID ${event.id}`),
  );
  const capacityValue = event.capacity === null ? null : Number(event.capacity);
  const capacityLabel =
    capacityValue === null
      ? `${registrationCount} registrations · unlimited capacity`
      : `${registrationCount} / ${capacityValue} seats`;
  const capacity = makeElement("div", "capacity", capacityLabel);
  top.append(details, capacity);

  const track = makeElement("div", "capacity-track");
  const fill = makeElement("div", "capacity-fill");
  const percent =
    capacityValue && capacityValue > 0
      ? Math.min(100, (registrationCount / capacityValue) * 100)
      : 0;
  fill.style.width = `${percent}%`;
  track.append(fill);

  const footer = makeElement("div", "event-card-footer");
  footer.append(makeElement("span", "capacity-copy", `Organizer ${organizerId}`));
  const viewButton = makeElement("button", "button button-secondary", "View attendees");
  viewButton.type = "button";
  viewButton.addEventListener("click", () => showAttendees(event, attendees));
  footer.append(viewButton);
  card.append(top, track, footer);
  return card;
}

function showAttendees(event, attendees) {
  const section = document.getElementById("attendees-section");
  const title = document.getElementById("attendees-title");
  const list = document.getElementById("attendees-list");
  const message = document.getElementById("attendees-message");
  title.textContent = `Attendees · ${event.title || "Event"}`;
  list.replaceChildren();
  if (attendees.length === 0) {
    renderEmpty(list, "No registrations yet.");
  } else {
    list.replaceChildren(
      ...attendees.map((attendee) => {
        const row = makeElement("div", "attendee-row");
        row.append(
          makeElement("code", "", attendee.user_id),
          makeElement(
            "span",
            "capacity-copy",
            attendee.created_at ? new Date(attendee.created_at).toLocaleString() : "",
          ),
        );
        return row;
      }),
    );
  }
  setMessage(message, "");
  section.hidden = false;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadOrganizerDashboard(organizerId) {
  const message = document.getElementById("organizer-message");
  const eventsContainer = document.getElementById("organizer-events");
  const metrics = document.getElementById("organizer-metrics");
  const attendeesSection = document.getElementById("attendees-section");
  attendeesSection.hidden = true;
  eventsContainer.replaceChildren();
  setMessage(message, "Loading organizer events…");

  try {
    const allEvents = await apiRequest("/api/events");
    const ownedEvents = allEvents.filter(
      (event) => (event.organizer_id || "").toLowerCase() === organizerId.toLowerCase(),
    );
    const attendeeResults = await Promise.all(
      ownedEvents.map(async (event) => ({
        event,
        attendees: await apiRequest(
          `/api/events/${encodeURIComponent(event.id)}/registrations?organizer_id=${encodeURIComponent(organizerId)}`,
        ),
      })),
    );
    const registrationTotal = attendeeResults.reduce(
      (total, result) => total + result.attendees.length,
      0,
    );
    const capacities = ownedEvents
      .map((event) => event.capacity)
      .filter((capacity) => capacity !== null && Number.isFinite(Number(capacity)));
    const availableSeats = capacities.reduce((total, capacity) => total + Number(capacity), 0);

    document.getElementById("metric-events").textContent = String(ownedEvents.length);
    document.getElementById("metric-registrations").textContent = String(registrationTotal);
    document.getElementById("metric-seats").textContent =
      capacities.length === ownedEvents.length ? String(availableSeats) : "—";
    metrics.hidden = false;

    if (ownedEvents.length === 0) {
      renderEmpty(eventsContainer, "No events were found for this organizer ID.");
    } else {
      eventsContainer.replaceChildren(
        ...attendeeResults.map(({ event, attendees }) =>
          renderOrganizerEvent(event, attendees.length, organizerId, attendees),
        ),
      );
    }
    setMessage(message, "");
  } catch (error) {
    metrics.hidden = true;
    setMessage(message, error.message, "error");
  }
}

function initializePage() {
  updateProfileLabel();

  const eventsUserForm = document.getElementById("user-id-form");
  const eventsUserInput = document.getElementById("user-id-input");
  saveIdentityForm(
    eventsUserForm,
    eventsUserInput,
    USER_ID_KEY,
    document.getElementById("events-message"),
  );
  saveIdentityForm(
    document.getElementById("organizer-id-form"),
    document.getElementById("organizer-id-input"),
    ORGANIZER_ID_KEY,
    document.getElementById("events-message"),
  );

  const registrationsForm = document.getElementById("registrations-user-form");
  const registrationsInput = document.getElementById("registrations-user-id");
  if (registrationsForm && registrationsInput) {
    registrationsInput.value = getSavedId(USER_ID_KEY);
    registrationsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const userId = registrationsInput.value.trim();
      if (!userId) {
        setMessage(document.getElementById("registrations-message"), "Enter a user ID.", "error");
        return;
      }
      window.localStorage.setItem(USER_ID_KEY, userId);
      updateProfileLabel();
      loadRegistrations(userId);
    });
    if (registrationsInput.value) loadRegistrations(registrationsInput.value);
  }

  const organizerForm = document.getElementById("organizer-form");
  const organizerInput = document.getElementById("organizer-id");
  if (organizerForm && organizerInput) {
    organizerInput.value = getSavedId(ORGANIZER_ID_KEY);
    organizerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const organizerId = organizerInput.value.trim();
      if (!organizerId) {
        setMessage(document.getElementById("organizer-message"), "Enter an organizer ID.", "error");
        return;
      }
      window.localStorage.setItem(ORGANIZER_ID_KEY, organizerId);
      loadOrganizerDashboard(organizerId);
    });
    if (organizerInput.value) loadOrganizerDashboard(organizerInput.value);
  }

  if (document.body.dataset.page === "events") loadEvents();
  if (document.body.dataset.page === "event-detail") loadEventDetail();
}

document.addEventListener("DOMContentLoaded", initializePage);
