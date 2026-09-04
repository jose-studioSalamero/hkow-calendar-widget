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

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    dayEl.textContent = day;
    dayEl.dataset.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dateStr = dayEl.dataset.date;
    if (eventDates.start.has(dateStr)) {
      dayEl.classList.add("has-event");
    } else if (eventDates.range.has(dateStr)) {
      dayEl.classList.add("has-event-range");
    }

    const today = new Date();
    if (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    ) {
      dayEl.classList.add("today");
    }

    dayEl.addEventListener("click", () => selectDate(dateStr));

    daysContainer.appendChild(dayEl);
  }
}

function getEventDatesForMonth(year, month) {
  const startDates = new Set();
  const rangeDates = new Set();

  events.forEach((event) => {
    const eventStart = new Date(event.date + "T00:00:00");
    const eventEnd = event.endDate ? new Date(event.endDate + "T00:00:00") : eventStart;

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

function selectDate(dateStr) {
  selectedDate = dateStr;
  const date = new Date(dateStr + "T00:00:00");

  document.querySelectorAll('.calendar-day.selected').forEach(el => {
    el.classList.remove('selected');
  });

  const clickedDay = document.querySelector(`[data-date="${dateStr}"]`);
  if (clickedDay) {
    clickedDay.classList.add('selected');
  }

  document.getElementById("selected-date").textContent =
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  console.log('Selected date:', dateStr);

  const dayEvents = events.filter((event) => {
    const isMatch = event.date === dateStr || 
                    (event.endDate && dateStr >= event.date && dateStr <= event.endDate);
    return isMatch;
  });

  console.log('Day events found:', dayEvents);

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
      (event, index) => `
        <div class="event-card">
            ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" class="event-image">` : ""}
            <h3>${event.title}</h3>
            <p class="event-time">${event.startTime} - ${event.endTime}</p>
            <p class="event-description">${event.description}</p>
            <div class="event-buttons">
                ${event.isFree ? '<span class="free-badge">FREE</span>' : ''}
                ${event.eventbriteId ? 
                  `<button class="event-btn event-btn-primary" data-eventbrite-id="${event.eventbriteId}">Get Tickets</button>` 
                  : event.ticketUrl ? 
                  `<a href="${event.ticketUrl}" class="event-btn event-btn-primary" target="_blank">Get Tickets</a>` 
                  : ""}
            </div>
        </div>
    `,
    )
    .join("");

  // Add event listeners to all ticket buttons
  document.querySelectorAll('[data-eventbrite-id]').forEach(button => {
    button.addEventListener('click', function() {
      const eventbriteId = this.getAttribute('data-eventbrite-id');
      openEventbriteCheckout(eventbriteId);
    });
  });
}

function openEventbriteCheckout(eventbriteId) {
  console.log('Sending message to parent window for Eventbrite ID:', eventbriteId);
  
  // Send message to parent window (Webflow site)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'OPEN_EVENTBRITE_MODAL',
      eventbriteId: eventbriteId
    }, '*');
  } else {
    // Fallback if not in iframe
    window.open(`https://www.eventbrite.com/e/${eventbriteId}`, '_blank');
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

init();