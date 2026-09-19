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
          <button class="btn btn-navy btn-sm btn-style" onclick="viewEventDetails('${ev.id}')">View Results</button>
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
    if (section) section.style.display = "block";

    const titleEl = document.getElementById("active-event-title");
    if (titleEl) {
      titleEl.innerText = `${res.data?.eventTitle || "Event"} (${res.data?.status || "Active"})`;
    }

    const statsEl = document.getElementById("event-summary-stats");
    if (statsEl) {
      const total = res.data?.summary?.totalParticipants ?? "N/A";
      const picked = res.data?.summary?.totalPicked ?? "N/A";
      const remaining = res.data?.summary?.remaining ?? "N/A";
      statsEl.innerHTML = `<p>Total Participants: ${total} | Picked: ${picked} | Remaining: ${remaining}</p>`;
    }

    // --- 1. Render Table ---
    const tableBody = document.getElementById("pairings-table");
    const picksList = res.data?.summary?.picks || res.data?.picks || [];

    if (tableBody) {
      if (picksList.length > 0) {
        tableBody.innerHTML = picksList
          .map(
            (p) => `
        <tr>
          <td>${p.pickerName || p.picker || "N/A"}</td>
          <td>${p.pickedName || p.picked || "N/A"}</td>
        </tr>
      `,
          )
          .join("");
      } else {
        tableBody.innerHTML =
          '<tr><td colspan="2">No picks recorded yet.</td></tr>';
      }
    }

    // --- 2. Render Special Requests ---
    const reqContainer = document.getElementById("admin-special-requests");

    if (reqContainer) {
      // Check all potential keys where the backend might place special requests
      const requestsList =
        res.data?.summary?.specialRequests ||
        res.data?.specialRequests ||
        res.data?.requests ||
        [];

      if (requestsList.length > 0) {
        reqContainer.innerHTML = requestsList
          .map(
            (r) => `
        <div class="request-item">
          <p><strong>From:</strong> ${r.name || r.pickerName || "N/A"} (${r.phone || r.phoneNo || "N/A"})</p>
          <p><strong>Email:</strong> ${r.emailAdd || r.email || "N/A"}</p>
          <p><strong>Wants to Gift:</strong> ${r.wantToGift || r.target || "N/A"}</p>
          <p><strong>Note:</strong> ${r.description || r.reason || "N/A"}</p>
        </div>
      `,
          )
          .join("");
      } else {
        reqContainer.innerHTML = '<p class="subtext">No special requests.</p>';
      }
    }
  } else {
    alert(`Could not fetch event results: ${res.message}`);
  }
}
// 6. PARTICIPANT PICKING FLOW
// Step 1: Select Participant
async function handleParticipantSelection() {
  const dropdown = document.getElementById("participant-dropdown");
  const selectedName = dropdown?.value;

  if (!selectedName) {
    alert("Please select your name.");
    return;
  }

  // Set the selected name first
  state.pickerName = selectedName;

  const res = await apiCall(`/pick/${state.currentEventId}`, "POST", {
    pickerName: selectedName,
  });

  if (res.ok) {
    // Check all potential backend keys for participant list
    let rawParticipants =
      res.data.participants ||
      res.data.eventParticipants ||
      res.data.data ||
      res.data ||
      [];

    // Parse comma-separated strings if returned in string format
    if (typeof rawParticipants === "string") {
      rawParticipants = rawParticipants
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    }

    // Standardize every participant into an object { id, name, isPicked }
    state.eventParticipants = Array.isArray(rawParticipants)
      ? rawParticipants.map((p, index) => {
          if (typeof p === "string") {
            return { id: index + 1, name: p, isPicked: false };
          }
          return {
            id: p.id || p._id || index + 1,
            name: p.name || p.pickerName || p.fullName || "",
            isPicked: Boolean(p.isPicked),
          };
        })
      : [];

    // NOW that state.eventParticipants has proper objects and IDs, locate the selected picker:
    const selectedParticipant = state.eventParticipants.find(
      (p) => p.name === selectedName,
    );

    // Set state.pickerId using the mapped ID from the response (or option dataset fallback)
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    state.pickerId =
      selectedParticipant?.id || selectedOption?.dataset?.id || selectedName;

    const activeUserLabel = document.getElementById("active-user-name");
    if (activeUserLabel) activeUserLabel.innerText = selectedName;

    renderPickingGrid();
    showView("participant-picking-view");
  } else {
    // If user already picked, message contains who they picked
    alert(res.message);
  }
}

function renderPickingGrid() {
  const container = document.getElementById("picking-cards-container");
  if (!container) return;
  container.innerHTML = "";

  if (state.eventParticipants.length === 0) {
    container.innerHTML =
      '<p class="subtext">No available participants found to pick.</p>';
    return;
  }

  state.eventParticipants.forEach((person) => {
    // Cannot pick self
    if (person.name === state.pickerName) return;
    // Ensure person.id is a valid integer fallback if backend didn't supply one
    const validId = parseInt(person.id, 10) || index + 1;

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
        onclick="submitPick('${person.id}', '${person.name}')">
        ${person.isPicked ? "Unavailable" : "Pick"}
      </button>
    `;

    container.appendChild(card);
  });
}
// Step 2: Make Pick
async function submitPick(targetId, targetName) {
  const pickerIdentifier = state.pickerId || state.pickerName;
  if (!pickerIdentifier) {
    alert("Picker name/ID is missing. Please select your name again.");
    return;
  }

  // Convert targetId to a valid integer required by backend validation schema
  const numericTargetId = parseInt(targetId, 10);

  if (isNaN(numericTargetId)) {
    alert("Target participant ID is invalid. Please refresh and try again.");
    return;
  }

  const res = await apiCall(
    `/pick/make/${state.currentEventId}/${encodeURIComponent(pickerIdentifier)}`,
    "POST",
    {
      pickedParticipantId: numericTargetId, // Key expected by backend schema validator
      pickedParticipant: numericTargetId, // Key fallback
      pickedName: targetName,
    },
  );

  console.log("PICK SELECTION RESPONSE:", res);

  if (res.ok) {
    const targetLabel = document.getElementById("picked-target-name");
    if (targetLabel) targetLabel.innerText = targetName;
    showView("already-picked-view");
  } else {
    alert(
      `Selection Failed: ${res.message || "Server error (" + res.status + ")"}`,
    );
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
        res.data.title || "Secret Santa Event";
      document.getElementById("p-landing-event-desc").innerText =
        res.data.description || "Select your name to continue.";

      const dropdown = document.getElementById("participant-dropdown");
      if (!dropdown) return;

      let rawParticipants = res.data.participants || [];
      let participantNames = [];

      // Handle String vs Array structures from backend
      if (typeof rawParticipants === "string") {
        // "Access, john, ade, shola" -> ["Access", "john", "ade", "shola"]
        participantNames = rawParticipants
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name.length > 0);
      } else if (Array.isArray(rawParticipants)) {
        // Handles array of strings OR array of objects [{ name: "Access" }]
        participantNames = rawParticipants.map((p) =>
          typeof p === "string" ? p : p.name,
        );
      }

      // Populate dropdown cleanly
      if (participantNames.length > 0) {
        const optionsHtml = participantNames
          .map((name) => `<option value="${name}">${name}</option>`)
          .join("");

        dropdown.innerHTML =
          '<option value="">-- Choose Your Name --</option>' + optionsHtml;
      } else {
        dropdown.innerHTML =
          '<option value="">No participants found for this event</option>';
      }

      showView("participant-landing-view");
    } else {
      alert(`Could not load event: ${res.message}`);
    }
  }
});
