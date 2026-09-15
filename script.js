// Configuration - Replace with your API endpoint
const API_ENDPOINT = "/api/events";

// Hong Kong time is UTC+8 year-round (no DST).
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2147483647;

// State
let currentDate = getHKTMonthDate();
let events = [];
let selectedDate = null;
let activeStateTimer = null;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Instant in UTC shifted so UTC getters return HKT calendar/clock fields.
function asHKT(date = new Date()) {
  return new Date(date.getTime() + HKT_OFFSET_MS);
}

function getHKTDateKey(date = new Date()) {
  const hkt = asHKT(date);
  const year = hkt.getUTCFullYear();
  const month = String(hkt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(hkt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHKTMonthDate(date = new Date()) {
  const [year, month] = getHKTDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function getNextHKTMidnightMs(date = new Date()) {
  const hkt = asHKT(date);
  const nextMidnightHKTAsUTC = Date.UTC(
    hkt.getUTCFullYear(),
    hkt.getUTCMonth(),
    hkt.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return nextMidnightHKTAsUTC - HKT_OFFSET_MS;
}

function parseHKTDisplayTimeToMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    return NaN;
  }

  const match = String(timeStr)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return NaN;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "AM") {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0) - HKT_OFFSET_MS;
}

function parseEventEndMs(event) {
  if (event.endDateTime) {
    const endMs = Date.parse(event.endDateTime);
    if (!Number.isNaN(endMs)) {
      return endMs;
    }
  }

  const lastDate = event.endDate || event.date;
  const fromDisplayTime = parseHKTDisplayTimeToMs(lastDate, event.endTime);
  if (!Number.isNaN(fromDisplayTime)) {
    return fromDisplayTime;
  }

  if (!lastDate) {
    return NaN;
  }

  const [year, month, day] = lastDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - HKT_OFFSET_MS;
}

function hasEventEnded(event, now = new Date()) {
  const endMs = parseEventEndMs(event);
  if (Number.isNaN(endMs)) {
    return false;
  }
  return endMs <= now.getTime();
}

function eventCoversDate(event, dateStr) {
  if (event.date === dateStr) {
    return true;
  }
  return Boolean(
    event.endDate && dateStr >= event.date && dateStr <= event.endDate,
  );
}

function hasActiveEventOnDate(dateStr, now = new Date(), eventList = events) {
  const todayStr = getHKTDateKey(now);
  if (dateStr < todayStr) {
    return false;
  }

  return eventList.some(
    (event) => eventCoversDate(event, dateStr) && !hasEventEnded(event, now),
  );
}

// Helper function to create local date from YYYY-MM-DD string
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isPastHKTDate(dateStr, now = new Date()) {
  return dateStr < getHKTDateKey(now);
}

function refreshActiveCalendarState() {
  const todayStr = getHKTDateKey();
  if (selectedDate && isPastHKTDate(selectedDate)) {
    selectedDate = todayStr;
  }
  renderCalendar();
  if (selectedDate) {
    selectDate(selectedDate);
  }
  scheduleActiveStateRefresh();
}

function getMsUntilNextActiveStateChange(now = new Date(), eventList = events) {
  const nowMs = now.getTime();
  let nextMs = getNextHKTMidnightMs(now);
  const todayStr = getHKTDateKey(now);

  eventList.forEach((event) => {
    const endMs = parseEventEndMs(event);
    if (Number.isNaN(endMs) || endMs <= nowMs || endMs >= nextMs) {
      return;
    }

    const lastDate = event.endDate || event.date;
    if (lastDate === todayStr) {
      nextMs = endMs;
    }
  });

  return Math.min(Math.max(nextMs - nowMs + 50, 50), MAX_TIMEOUT_MS);
}

function scheduleActiveStateRefresh() {
  if (activeStateTimer) {
    clearTimeout(activeStateTimer);
    activeStateTimer = null;
  }

  activeStateTimer = setTimeout(
    refreshActiveCalendarState,
    getMsUntilNextActiveStateChange(),
  );
}

function setupRealtimeRefresh() {
  scheduleActiveStateRefresh();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshActiveCalendarState();
    }
  });
}

// Initialize
async function init() {
  await fetchEvents();
  renderCalendar();
  setupEventListeners();
  selectDate(getHKTDateKey());
  setupRealtimeRefresh();
}

// Fetch events from Google Sheets (via API)
async function fetchEvents() {
  try {
    console.log("Fetching events from:", API_ENDPOINT);
    const response = await fetch(API_ENDPOINT);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    events = await response.json();
    console.log("Loaded events:", events.length);
    console.log("Events:", events);
  } catch (error) {
    console.error("Error fetching events:", error);
    events = [];
  }
}

// Render calendar
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById("current-month").textContent =
    currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventDates = getEventDatesForMonth(year, month);

  const daysContainer = document.getElementById("calendar-days");
  daysContainer.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    daysContainer.appendChild(emptyDay);
  }

  const now = new Date();
  const todayStr = getHKTDateKey(now);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    dayEl.textContent = day;
    dayEl.dataset.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dateStr = dayEl.dataset.date;
    if (hasActiveEventOnDate(dateStr, now, events)) {
      if (eventDates.start.has(dateStr)) {
        dayEl.classList.add("has-event");
      } else if (eventDates.range.has(dateStr)) {
        dayEl.classList.add("has-event-range");
      }
    }

    if (dateStr === todayStr) {
      dayEl.classList.add("today");
    }

    if (isPastHKTDate(dateStr, now)) {
      dayEl.classList.add("past");
      dayEl.setAttribute("aria-disabled", "true");
    } else {
      if (dateStr === selectedDate) {
        dayEl.classList.add("selected");
      }
      dayEl.addEventListener("click", () => selectDate(dateStr));
    }

    daysContainer.appendChild(dayEl);
  }
}

function getEventDatesForMonth(year, month) {
  const startDates = new Set();
  const rangeDates = new Set();

  events.forEach((event) => {
    const eventStart = parseLocalDate(event.date);
    const eventEnd = event.endDate ? parseLocalDate(event.endDate) : eventStart;

    if (
      (eventStart.getFullYear() === year && eventStart.getMonth() === month) ||
      (eventEnd.getFullYear() === year && eventEnd.getMonth() === month) ||
      (eventStart < new Date(year, month, 1) &&
        eventEnd > new Date(year, month + 1, 0))
    ) {
      if (
        eventStart.getFullYear() === year &&
        eventStart.getMonth() === month
      ) {
        startDates.add(event.date);
      }

      let currentDate = new Date(
        Math.max(eventStart, new Date(year, month, 1)),
      );
      const endDate = new Date(
        Math.min(eventEnd, new Date(year, month + 1, 0)),
      );

      while (currentDate <= endDate) {
        const dateStr = toDateKey(currentDate);
        if (dateStr !== event.date) {
          rangeDates.add(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });

  return { start: startDates, range: rangeDates };
}

function selectDate(dateStr) {
  if (isPastHKTDate(dateStr)) {
    return;
  }

  selectedDate = dateStr;
  const date = parseLocalDate(dateStr);

  document.querySelectorAll(".calendar-day.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  const clickedDay = document.querySelector(`[data-date="${dateStr}"]`);
  if (clickedDay) {
    clickedDay.classList.add("selected");
  }

  document.getElementById("selected-date").textContent =
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  console.log("Selected date:", dateStr);

  const dayEvents = events.filter((event) => {
    const isMatch =
      event.date === dateStr ||
      (event.endDate && dateStr >= event.date && dateStr <= event.endDate);
    return isMatch;
  });

  console.log("Day events found:", dayEvents);

  renderEvents(dayEvents);
}

function renderEvents(dayEvents) {
  const eventsContainer = document.getElementById("events-list");

  if (dayEvents.length === 0) {
    eventsContainer.innerHTML =
      '<p class="no-events">No events on this date</p>';
    return;
  }

  eventsContainer.innerHTML = dayEvents
    .map(
      (event) => `
        <div class="event-card">
            ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" class="event-image">` : ""}
            <h3>${event.title}</h3>
            <p class="event-time">${event.startTime} - ${event.endTime}</p>
            <p class="event-description">${event.description}</p>
            <div class="event-buttons">
                ${event.isFree ? '<span class="free-badge">FREE</span>' : ""}
                ${
                  hasEventEnded(event)
                    ? '<span class="ended-badge">Ended</span>'
                    : event.eventbriteId
                      ? `<button class="event-btn event-btn-primary" data-eventbrite-id="${event.eventbriteId}">Get Tickets</button>`
                      : event.ticketUrl
                        ? `<a href="${event.ticketUrl}" class="event-btn event-btn-primary" target="_blank">Get Tickets</a>`
                        : ""
                }
            </div>
        </div>
    `,
    )
    .join("");

  // Add event listeners to all ticket buttons
  document.querySelectorAll("[data-eventbrite-id]").forEach((button) => {
    button.addEventListener("click", function () {
      const eventbriteId = this.getAttribute("data-eventbrite-id");
      openEventbriteCheckout(eventbriteId);
    });
  });
}

function openEventbriteCheckout(eventbriteId) {
  console.log(
    "Sending message to parent window for Eventbrite ID:",
    eventbriteId,
  );

  // Send message to parent window (Webflow site)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      {
        type: "OPEN_EVENTBRITE_MODAL",
        eventbriteId: eventbriteId,
      },
      "*",
    );
  } else {
    // Fallback if not in iframe
    window.open(`https://www.eventbrite.com/e/${eventbriteId}`, "_blank");
  }
}

function setupEventListeners() {
  document.getElementById("prev-month").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

if (typeof document !== "undefined") {
  init();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isPastHKTDate,
    getHKTDateKey,
    getNextHKTMidnightMs,
    hasEventEnded,
    hasActiveEventOnDate,
    eventCoversDate,
    parseEventEndMs,
    parseHKTDisplayTimeToMs,
    getMsUntilNextActiveStateChange,
    asHKT,
  };
}
