// BASE CONFIGURATION
const API_BASE_URL = "https://giftsmatch.onrender.com";

// GLOBAL APP STATE
const state = {
  accessToken: localStorage.getItem("accessToken") || null,
  registeredEmail: "",
  currentEventId: null,
  pickerName: null,
  eventParticipants: [],
};

// 1. MOBILE NAVBAR DROPDOWN TOGGLE
const navToggleBtn = document.getElementById("nav-toggle-btn");
const navMenu = document.getElementById("nav-menu");

navToggleBtn?.addEventListener("click", () => {
  navMenu.classList.toggle("active");
});

function closeMobileNav() {
  navMenu.classList.remove("active");
}

// 2. VIEW ROUTER
function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add("active");
  }
}

// 3. API HELPER FUNCTION
async function apiCall(
  endpoint,
  method = "GET",
  body = null,
  isProtected = false,
) {
  const headers = { "Content-Type": "application/json" };

  if (isProtected && state.accessToken) {
    headers["Authorization"] = `Bearer ${state.accessToken}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle array error format vs string message format
      if (data.errors && Array.isArray(data.errors)) {
        const errMsgs = data.errors
          .map((e) => `${e.field}: ${e.message}`)
          .join("\n");
        throw new Error(errMsgs);
      }
      throw new Error(data.message || `Server error (${response.status})`);
    }

    return { ok: true, status: response.status, data };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// 4. AUTHENTICATION FLOWS

// Admin / Participant Sign Up
document
  .getElementById("admin-register-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("reg-firstname").value.trim();
    const lastName = document.getElementById("reg-lastname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phoneNo = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;

    const res = await apiCall("/auth/register", "POST", {
      firstName,
      lastName,
      email,
      phoneNo,
      password,
    });

    if (res.ok) {
      state.registeredEmail = email;
      document.getElementById("otp-email-label").innerText =
        `Sent to: ${email}`;
      alert(res.data.message || "OTP sent! Please check your email.");
      showView("otp-verification-view");
    } else {
      alert(`Registration Failed:\n${res.message}`);
    }
  });

// Verify OTP
document.getElementById("otp-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const otp = document.getElementById("otp-code").value.trim();

  const res = await apiCall("/auth/verify", "POST", {
    email: state.registeredEmail,
    otp,
  });

  if (res.ok) {
    alert("Email verified successfully! You can now log in.");
    showView("admin-login-view");
  } else {
    alert(`Verification Failed: ${res.message}`);
  }
});

async function resendOTP() {
  if (!state.registeredEmail) {
    alert("No email found to resend OTP.");
    return;
  }
  const res = await apiCall("/auth/resend-otp", "POST", {
    email: state.registeredEmail,
  });
  if (res.ok) alert("OTP resent successfully!");
  else alert(`Resend Failed: ${res.message}`);
}

// Admin Login
document
  .getElementById("admin-login-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const res = await apiCall("/auth/login", "POST", { email, password });

    if (res.ok) {
      state.accessToken = res.data.accessToken;
      localStorage.setItem("accessToken", state.accessToken);
      alert("Login successful!");
      loadAdminEvents();
      showView("admin-dashboard-view");
    } else {
      alert(`Login Failed: ${res.message}`);
    }
  });

function logoutAdmin() {
  apiCall("/auth/logout", "POST");
  state.accessToken = null;
  localStorage.removeItem("accessToken");
  showView("admin-login-view");
}

// Participant Registration
document
  .getElementById("participant-signup-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("p-firstname").value.trim();
    const lastName = document.getElementById("p-lastname").value.trim();
    const email = document.getElementById("p-email").value.trim();
    const phoneNo = document.getElementById("p-phone").value.trim();
    const password = document.getElementById("p-pass").value;

    const res = await apiCall("/auth/register", "POST", {
      firstName,
      lastName,
      email,
      phoneNo,
      password,
    });

    if (res.ok) {
      state.registeredEmail = email;
      document.getElementById("otp-email-label").innerText =
        `Sent to: ${email}`;
      alert("Registration successful! Please verify your OTP.");
      showView("otp-verification-view");
    } else {
      alert(`Registration Failed:\n${res.message}`);
    }
  });

// 5. EVENT MANAGEMENT

// Load Admin Events
async function loadAdminEvents() {
  const container = document.getElementById("admin-events-list");
  container.innerHTML = '<p class="subtext">Loading events...</p>';

  const res = await apiCall("/event/all", "GET", null, true);

  // Gotcha Fix: 404 means 0 events on this route
  if (!res.ok && res.message.includes("404")) {
    container.innerHTML =
      '<p class="subtext">You have not created any events yet.</p>';
    return;
  }

  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    container.innerHTML = res.data
      .map(
        (ev) => `
      <div class="event-row">
        <div>
          <strong>${ev.title}</strong>
          <p class="subtext">Dates: ${new Date(ev.startDate).toLocaleDateString()} - ${new Date(ev.deadline).toLocaleDateString()}</p>
        </div>
        <div>
          <button class="btn btn-navy btn-sm" onclick="viewEventDetails('${ev.id}')">View Results</button>
          <button class="btn btn-coral btn-sm" onclick="copyEventLink('${ev.id}')">Copy Share Link</button>
        </div>
      </div>
    `,
      )
      .join("");
  } else {
    container.innerHTML = '<p class="subtext">No events found.</p>';
  }
}

function copyEventLink(eventId) {
  const shareableUrl = `${window.location.origin}${window.location.pathname}?eventId=${eventId}`;
  navigator.clipboard.writeText(shareableUrl);
  alert(`Shareable link copied to clipboard!\n${shareableUrl}`);
}

// Create New Event
document
  .getElementById("create-event-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("ev-title").value.trim();
    const description = document.getElementById("ev-desc").value.trim();
    const participants = document
      .getElementById("ev-participants")
      .value.trim();
    const startDate = new Date(
      document.getElementById("ev-start").value,
    ).toISOString();
    const deadline = new Date(
      document.getElementById("ev-end").value,
    ).toISOString();

    // Validate dates
    if (new Date(deadline) <= new Date(startDate)) {
      alert("Deadline must be after the start date.");
      return;
    }

    const payload = { title, participants, startDate, deadline };
    if (description) payload.description = description;

    const res = await apiCall("/event", "POST", payload, true);

    if (res.ok) {
      alert("Event created successfully!");
      loadAdminEvents();
      showView("admin-dashboard-view");
    } else {
      alert(`Failed to create event:\n${res.message}`);
    }
  });

// View Event Results (Admin)
async function viewEventDetails(eventId) {
  const res = await apiCall(`/pick/results/${eventId}`, "GET", null, true);

  if (res.ok) {
    const section = document.getElementById("event-details-section");
    section.style.display = "block";

    document.getElementById("active-event-title").innerText =
      `${res.data.eventTitle} (${res.data.status})`;
    document.getElementById("event-summary-stats").innerHTML = `
      <p>Total Participants: ${res.data.summary.totalParticipants} | Picked: ${res.data.summary.totalPicked} | Remaining: ${res.data.summary.remaining}</p>
    `;

    // Render Table
    const tableBody = document.getElementById("pairings-table");
    if (res.data.summary.picks.length > 0) {
      tableBody.innerHTML = res.data.summary.picks
        .map(
          (p) => `
        <tr>
          <td>${p.pickerName}</td>
          <td>${p.pickedName}</td>
        </tr>
      `,
        )
        .join("");
    } else {
      tableBody.innerHTML =
        '<tr><td colspan="2">No picks recorded yet.</td></tr>';
    }

    // Special Requests
    const reqContainer = document.getElementById("admin-special-requests");
    if (
      res.data.summary.specialRequests &&
      res.data.summary.specialRequests.length > 0
    ) {
      reqContainer.innerHTML = res.data.summary.specialRequests
        .map(
          (r) => `
        <div class="request-item">
          <p><strong>From:</strong> ${r.name} (${r.phone})</p>
          <p><strong>Wants to Gift:</strong> ${r.wantToGift}</p>
          <p><strong>Note:</strong> ${r.description}</p>
        </div>
      `,
        )
        .join("");
    } else {
      reqContainer.innerHTML = '<p class="subtext">No special requests.</p>';
    }
  } else {
    alert(`Could not fetch event results: ${res.message}`);
  }
}

// 6. PARTICIPANT PICKING FLOW

// Step 1: Select Participant
async function handleParticipantSelection() {
  const dropdown = document.getElementById("participant-dropdown");
  const selectedName = dropdown.value;

  if (!selectedName) {
    alert("Please select your name.");
    return;
  }

  state.pickerName = selectedName;

  const res = await apiCall(`/pick/${state.currentEventId}`, "POST", {
    pickerName: selectedName,
  });

  if (res.ok) {
    state.eventParticipants = res.data.participants || [];
    document.getElementById("active-user-name").innerText = selectedName;
    renderPickingGrid();
    showView("participant-picking-view");
  } else {
    // If user already picked, message contains who they picked
    alert(res.message);
  }
}

function renderPickingGrid() {
  const container = document.getElementById("picking-cards-container");
  container.innerHTML = "";

  state.eventParticipants.forEach((person) => {
    // Cannot pick self
    if (person.name === state.pickerName) return;

    const card = document.createElement("div");
    card.className = `picker-card ${person.isPicked ? "disabled" : ""}`;

    card.innerHTML = `
      <div style="font-size:2rem; margin-bottom:0.5rem;">👤</div>
      <h4>${person.name}</h4>
      <p style="font-size:0.8rem; margin-bottom:1rem; color:#666;">
        ${person.isPicked ? "Already Picked" : "Available"}
      </p>
      <button 
        class="btn ${person.isPicked ? "btn-navy" : "btn-coral"} btn-block" 
        ${person.isPicked ? "disabled" : ""} 
        onclick="submitPick(${person.id}, '${person.name}')">
        ${person.isPicked ? "Unavailable" : "Pick"}
      </button>
    `;

    container.appendChild(card);
  });
}

// Step 2: Make Pick
async function submitPick(targetId, targetName) {
  const res = await apiCall(`/pick/make/${state.currentEventId}`, "POST", {
    pickerName: state.pickerName,
    pickedParticipantId: targetId,
    pickedName: targetName,
  });

  if (res.ok) {
    document.getElementById("picked-target-name").innerText = targetName;
    showView("already-picked-view");
  } else {
    alert(`Selection Failed: ${res.message}`);
  }
}

// Submit Special Request
document
  .getElementById("special-request-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!state.currentEventId) {
      alert("No event ID detected from URL link.");
      return;
    }

    const firstName = document.getElementById("sr-firstname").value.trim();
    const lastName = document.getElementById("sr-lastname").value.trim();
    const name = `${firstName} ${lastName}`;
    const phone = document.getElementById("sr-phone").value.trim();
    const emailAdd = document.getElementById("sr-email").value.trim();
    const wantToGift = document.getElementById("sr-target").value.trim();
    const description = document.getElementById("sr-reason").value.trim();

    const res = await apiCall(`/request/${state.currentEventId}`, "POST", {
      name,
      phone,
      emailAdd,
      wantToGift,
      description,
    });

    if (res.ok) {
      alert("Special request sent successfully to the event admin!");
      showView("home-view");
    } else {
      alert(`Failed to send request: ${res.message}`);
    }
  });

// 7. INITIALIZATION ON PAGE LOAD
window.addEventListener("DOMContentLoaded", async () => {
  // Parse eventId from URL query parameter (e.g. ?eventId=123)
  const urlParams = new URLSearchParams(window.location.search);
  const eventIdParam = urlParams.get("eventId");

  if (eventIdParam) {
    state.currentEventId = eventIdParam;

    // Fetch event details to populate participant dropdown
    const res = await apiCall(`/event/${eventIdParam}`, "GET");
    if (res.ok) {
      document.getElementById("p-landing-event-title").innerText =
        res.data.title;
      document.getElementById("p-landing-event-desc").innerText =
        res.data.description || "Select your name to continue.";

      const dropdown = document.getElementById("participant-dropdown");
      dropdown.innerHTML = '<option value="">-- Choose Your Name --</option>';

      if (Array.isArray(res.data.participants)) {
        res.data.participants.forEach((p) => {
          dropdown.innerHTML += `<option value="${p.name}">${p.name}</option>`;
        });
      }

      showView("participant-landing-view");
    }
  }
});
