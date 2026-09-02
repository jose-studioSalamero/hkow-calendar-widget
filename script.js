// Configuration - Replace with your API endpoint
const API_ENDPOINT = "/api/events";

// State
let currentDate = new Date();
let events = [];
let selectedDate = null;

// Initialize
async function init() {
  await fetchEvents();
  renderCalendar();
  setupEventListeners();
}

// Fetch events from Google Sheets (via API)
async function fetchEvents() {
  try {
    console.log('Fetching events from:', API_ENDPOINT);
    const response = await fetch(API_ENDPOINT);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    events = await response.json();
    console.log('Loaded events:', events.length);
    console.log('Events:', events);
  } catch (error) {
    console.error("Error fetching events:", error);
    events = [];
  }
}

// Render calendar
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update month header
  document.getElementById("current-month").textContent =
    currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Get calendar data
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get event dates for highlighting
  const eventDates = getEventDatesForMonth(year, month);

  // Render days
  const daysContainer = document.getElementById("calendar-days");
  daysContainer.innerHTML = "";

  // Empty cells before month starts
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day empty";
    daysContainer.appendChild(emptyDay);
  }

  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    dayEl.textContent = day;
    dayEl.dataset.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Check if this day has events
    const dateStr = dayEl.dataset.date;
    if (eventDates.start.has(dateStr)) {
      dayEl.classList.add("has-event");
    } else if (eventDates.range.has(dateStr)) {
      dayEl.classList.add("has-event-range");
    }

    // Check if today
    const today = new Date();
    if (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    ) {
      dayEl.classList.add("today");
    }

    // Click handler
    dayEl.addEventListener("click", () => selectDate(dateStr));

    daysContainer.appendChild(dayEl);
  }
}

// Get event dates for current month
function getEventDatesForMonth(year, month) {
  const startDates = new Set();
  const rangeDates = new Set();

  events.forEach((event) => {
    const eventStart = new Date(event.date + "T00:00:00");
    const eventEnd = event.endDate ? new Date(event.endDate + "T00:00:00") : eventStart;

    // Check if event is in current month
    if (
      (eventStart.getFullYear() === year && eventStart.getMonth() === month) ||
      (eventEnd.getFullYear() === year && eventEnd.getMonth() === month) ||
      (eventStart < new Date(year, month, 1) &&
        eventEnd > new Date(year, month + 1, 0))
    ) {
      // Add start date
      if (
        eventStart.getFullYear() === year &&
        eventStart.getMonth() === month
      ) {
        startDates.add(event.date);
      }

      // Add range dates
      let currentDate = new Date(
        Math.max(eventStart, new Date(year, month, 1)),
      );
      const endDate = new Date(
        Math.min(eventEnd, new Date(year, month + 1, 0)),
      );

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (dateStr !== event.date) {
          rangeDates.add(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });

  return { start: startDates, range: rangeDates };
}

// Select date and show events
function selectDate(dateStr) {
  selectedDate = dateStr;
  const date = new Date(dateStr + "T00:00:00");

  // Remove previous selection
  document.querySelectorAll('.calendar-day.selected').forEach(el => {
    el.classList.remove('selected');
  });

  // Add selected class to clicked date
  const clickedDay = document.querySelector(`[data-date="${dateStr}"]`);
  if (clickedDay) {
    clickedDay.classList.add('selected');
  }

  // Update header
  document.getElementById("selected-date").textContent =
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  console.log('Selected date:', dateStr);

  // Filter events for this date
  const dayEvents = events.filter((event) => {
    const isMatch = event.date === dateStr || 
                    (event.endDate && dateStr >= event.date && dateStr <= event.endDate);
    return isMatch;
  });

  console.log('Day events found:', dayEvents);

  // Render events
  renderEvents(dayEvents);
}

// Render events list
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
                ${event.isFree ? '<span class="free-badge">FREE</span>' : ''}
                ${event.ticketUrl ? `<a href="${event.ticketUrl}" class="event-btn event-btn-primary" target="_blank">Get Tickets</a>` : ""}
            </div>
        </div>
    `,
    )
    .join("");
}

// Setup event listeners
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

// Start app
init();