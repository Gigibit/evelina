function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    const formatted = value.map((item) => (typeof item === "object" ? JSON.stringify(item) : formatValue(item)));
    return formatted.join(", ");
  }

  if (typeof value === "object") {
    return "";
  }

  return String(value);
}

function formatLabel(label) {
  if (label === null || label === undefined) {
    return "";
  }

  return String(label)
    .replace(/[_-]+/g, " ")
    .replace(/([a-zà-ù])([A-ZÀ-Ù])/g, "$1 $2")
    .replace(/([A-ZÀ-Ù])([A-ZÀ-Ù][a-zà-ù])/g, "$1 $2")
    .trim();
}

function renderValueNode(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return renderDefinitions(Object.entries(value));
  }

  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    list.className = "detail-list";

    if (value.length === 0) {
      const item = document.createElement("li");
      item.textContent = "—";
      list.appendChild(item);
      return list;
    }

    value.forEach((entry) => {
      const item = document.createElement("li");
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        item.appendChild(renderDefinitions(Object.entries(entry)));
      } else {
        item.textContent = formatValue(entry);
      }
      list.appendChild(item);
    });

    return list;
  }

  const span = document.createElement("span");
  span.textContent = formatValue(value);
  return span;
}

function renderDefinitions(entries) {
  const dl = document.createElement("dl");
  dl.className = "definition-list";

  entries.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = formatLabel(label) || "—";

    const dd = document.createElement("dd");
    dd.appendChild(renderValueNode(value));

    dl.append(dt, dd);
  });

  return dl;
}

function buildDetailSections(data) {
  const container = document.createElement("div");
  container.className = "detail-sections";

  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nessun dettaglio disponibile per questo record.";
    container.appendChild(empty);
    return container;
  }

  Object.entries(data).forEach(([sectionTitle, value]) => {
    const section = document.createElement("div");
    section.className = "detail-section";

    const heading = document.createElement("h3");
    heading.textContent = formatLabel(sectionTitle) || "Sezione";
    section.appendChild(heading);

    section.appendChild(renderValueNode(value));

    container.appendChild(section);
  });

  return container;
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Impossibile leggere ${key} da localStorage`, error);
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setupModal() {
  const modal = document.getElementById("record-modal");
  if (!modal) {
    return null;
  }

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };

  modal.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", closeModal);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  return {
    element: modal,
    close: closeModal,
  };
}

function setupTableInteractions() {
  const modal = setupModal();
  const modalTitle = document.getElementById("record-modal-title");
  const modalBody = document.getElementById("record-modal-body");

  if (!modal || !modalTitle || !modalBody) {
    return;
  }

  const rows = document.querySelectorAll(".record-row[data-record]");

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const recordData = row.dataset.record ? JSON.parse(row.dataset.record) : {};
      const title = row.dataset.summary?.trim() || "Dettagli record";

      modalTitle.textContent = title;
      modalBody.classList.remove("muted");
      modalBody.replaceChildren(buildDetailSections(recordData));

      modal.element.classList.add("is-open");
      modal.element.setAttribute("aria-hidden", "false");
    });
  });
}

function setupResultDetails() {
  const resultContainer = document.querySelector("#result-details[data-record]");
  if (!resultContainer) {
    return;
  }

  const recordData = JSON.parse(resultContainer.dataset.record || "{}");
  resultContainer.replaceChildren(buildDetailSections(recordData));
}

function setupFilePicker() {
  const fileInput = document.querySelector("input[type=file]#atto");
  const fileName = document.getElementById("file-name");
  const uploadCard = document.querySelector(".upload-card");
  const archivePanel = document.querySelector('.panel[data-panel="archivio"]');
  let dragDepth = 0;

  if (!fileInput || !fileName) {
    return;
  }

  const isArchiveActive = () => !archivePanel || archivePanel.classList.contains("is-active");

  const enableDragging = (event) => {
    if (!isArchiveActive()) {
      return;
    }

    event.preventDefault();
    dragDepth += 1;
    uploadCard?.classList.add("is-dragging");
  };

  const handleDragLeave = (event) => {
    if (!isArchiveActive()) {
      return;
    }

    if (!event.relatedTarget || !uploadCard?.contains(event.relatedTarget)) {
      dragDepth = Math.max(0, dragDepth - 1);
    }

    if (dragDepth === 0) {
      uploadCard?.classList.remove("is-dragging");
    }
  };

  document.addEventListener("dragenter", enableDragging);
  document.addEventListener("dragover", (event) => {
    if (!isArchiveActive()) {
      return;
    }

    event.preventDefault();
  });

  document.addEventListener("dragleave", handleDragLeave);

  document.addEventListener("drop", (event) => {
    if (!isArchiveActive()) {
      return;
    }

    event.preventDefault();
    uploadCard?.classList.remove("is-dragging");
    dragDepth = 0;

    const files = event.dataTransfer?.files;
    if (files && files.length) {
      fileInput.files = files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  fileInput.addEventListener("change", () => {
    const name = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "Nessun file selezionato";
    fileName.textContent = name;
    uploadCard?.classList.remove("is-dragging");
    dragDepth = 0;
  });
}

function formatDateLabel(dateValue, timeValue) {
  if (!dateValue) {
    return "Data da definire";
  }

  const timePart = timeValue ? ` alle ${timeValue}` : "";
  return new Date(dateValue).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }) + timePart;
}

function renderAppointments(list) {
  const container = document.getElementById("appointment-list");
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!list || list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "Nessun appuntamento pianificato.";
    container.appendChild(empty);
    return;
  }

  list
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((item) => {
      const entry = document.createElement("li");
      const title = document.createElement("h4");
      title.textContent = item.title || "Appuntamento";

      const when = document.createElement("p");
      when.className = "muted";
      when.textContent = formatDateLabel(item.date, item.time);

      if (item.notes) {
        const notes = document.createElement("p");
        notes.textContent = item.notes;
        entry.append(title, when, notes);
      } else {
        entry.append(title, when);
      }

      container.appendChild(entry);
    });
}

function renderCalendar(appointments, referenceDate) {
  const calendar = document.getElementById("appointment-calendar");
  const currentLabel = document.getElementById("calendar-current");

  if (!calendar || !currentLabel) {
    return;
  }

  const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
  const dayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "short" });

  const normalizedReference = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthStart = normalizedReference;
  const startOffset = (monthStart.getDay() + 6) % 7; // Monday as first day
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const grouped = (appointments || []).reduce((acc, appointment) => {
    if (!appointment.date) {
      return acc;
    }

    acc[appointment.date] = acc[appointment.date] || [];
    acc[appointment.date].push(appointment);
    return acc;
  }, {});

  calendar.replaceChildren();
  currentLabel.textContent = monthFormatter.format(normalizedReference);

  const headerRow = document.createElement("div");
  headerRow.className = "calendar-grid calendar-header";
  const weekdays = Array.from({ length: 7 }).map((_, index) => {
    const reference = new Date(2023, 5, index + 5); // Monday reference week
    const label = dayFormatter.format(reference);
    return label.charAt(0).toUpperCase() + label.slice(1, 3);
  });

  weekdays.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell is-label";
    cell.textContent = day;
    headerRow.appendChild(cell);
  });

  calendar.appendChild(headerRow);

  const bodyGrid = document.createElement("div");
  bodyGrid.className = "calendar-grid";

  cells.forEach((cellDate) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    if (!cellDate) {
      cell.classList.add("is-empty");
      bodyGrid.appendChild(cell);
      return;
    }

    const label = document.createElement("div");
    label.className = "calendar-day";
    label.textContent = cellDate.getDate();

    const dateKey = cellDate.toISOString().slice(0, 10);
    const dayAppointments = grouped[dateKey] || [];

    cell.appendChild(label);

    if (dayAppointments.length) {
      cell.classList.add("has-appointments");

      const list = document.createElement("ul");
      list.className = "calendar-events";

      dayAppointments
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
        .forEach((item) => {
          const event = document.createElement("li");
          event.innerHTML = `<strong>${item.title || "Appuntamento"}</strong>${item.time ? ` · ${item.time}` : ""}`;
          list.appendChild(event);
        });

      cell.appendChild(list);
    }

    bodyGrid.appendChild(cell);
  });

  calendar.appendChild(bodyGrid);
}

function renderBookings(list) {
  const container = document.getElementById("booking-list");
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!list || list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "Nessuna prenotazione ancora inserita.";
    container.appendChild(empty);
    return;
  }

  list
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((item) => {
      const entry = document.createElement("li");
      const title = document.createElement("h4");
      title.textContent = item.purpose || "Prenotazione";

      const when = document.createElement("p");
      when.className = "muted";
      when.textContent = formatDateLabel(item.date);

      const channel = document.createElement("span");
      channel.className = "tag";
      channel.textContent = item.channel || "—";

      entry.append(title, when, channel);

      if (item.notes) {
        const notes = document.createElement("p");
        notes.textContent = item.notes;
        entry.append(notes);
      }

      container.appendChild(entry);
    });
}

function renderCommunications(list) {
  const container = document.getElementById("communication-list");
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!list || list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "Ancora nessuna comunicazione.";
    container.appendChild(empty);
    return;
  }

  list
    .slice()
    .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()))
    .forEach((item) => {
      const entry = document.createElement("li");
      const title = document.createElement("h4");
      title.textContent = item.title || "Comunicazione";

      const body = document.createElement("p");
      body.textContent = item.body || "";

      entry.append(title, body);

      const meta = document.createElement("p");
      meta.className = "muted";
      const created = item.createdAt ? new Date(item.createdAt) : new Date();
      meta.textContent = `Pubblicata il ${created.toLocaleDateString("it-IT")}`;
      entry.append(meta);

      container.appendChild(entry);
    });
}

function renderProfile(profile) {
  const summary = document.getElementById("profile-summary");
  if (!summary) {
    return;
  }

  summary.replaceChildren();

  if (!profile || Object.values(profile).every((value) => !value)) {
    const placeholder = document.createElement("p");
    placeholder.className = "muted";
    placeholder.textContent = "Completa i campi per vedere un riepilogo pronto all'uso.";
    summary.appendChild(placeholder);
    return;
  }

  summary.appendChild(
    renderDefinitions(
      Object.entries(profile).map(([key, value]) => [
        key,
        value || "—",
      ]),
    ),
  );
}

function setupAgenda() {
  const appointmentForm = document.getElementById("appointment-form");
  if (!appointmentForm) {
    return;
  }

  let appointments = loadFromStorage("appointments", [
    {
      title: "Firma atto preliminare",
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      notes: "Cliente: Rossi. Verifica documenti d'identità.",
    },
  ]);

  let calendarReference = new Date();

  renderAppointments(appointments);
  renderCalendar(appointments, calendarReference);

  const updateCalendar = () => renderCalendar(appointments, calendarReference);

  appointmentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(appointmentForm);
    const entry = {
      title: formData.get("title"),
      date: formData.get("date"),
      time: formData.get("time"),
      notes: formData.get("notes"),
    };

    appointments = [...appointments, entry];
    const updated = appointments;
    saveToStorage("appointments", updated);
    renderAppointments(updated);
    updateCalendar();
    appointmentForm.reset();
  });

  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");

  if (prev && next) {
    prev.addEventListener("click", () => {
      calendarReference = new Date(calendarReference.getFullYear(), calendarReference.getMonth() - 1, 1);
      updateCalendar();
    });

    next.addEventListener("click", () => {
      calendarReference = new Date(calendarReference.getFullYear(), calendarReference.getMonth() + 1, 1);
      updateCalendar();
    });
  }
}

function setupBookings() {
  const bookingForm = document.getElementById("booking-form");
  if (!bookingForm) {
    return;
  }

  let bookings = loadFromStorage("bookings", [
    {
      purpose: "Predisposizione mutuo",
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      channel: "In presenza",
      notes: "Cliente Bianchi, con consulente bancario.",
    },
  ]);

  renderBookings(bookings);

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const entry = {
      purpose: formData.get("purpose"),
      date: formData.get("date"),
      channel: formData.get("channel"),
      notes: formData.get("notes"),
    };

    bookings = [...bookings, entry];
    const updated = bookings;
    saveToStorage("bookings", updated);
    renderBookings(updated);
    bookingForm.reset();
  });
}

function setupCommunications() {
  const communicationForm = document.getElementById("communication-form");
  if (!communicationForm) {
    return;
  }

  let communications = loadFromStorage("communications", [
    {
      title: "Aggiornamento dossier",
      body: "Caricati i documenti per l'atto di compravendita. Procedere alla revisione entro venerdì.",
      createdAt: new Date().toISOString(),
    },
  ]);

  renderCommunications(communications);

  communicationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(communicationForm);
    const entry = {
      title: formData.get("title"),
      body: formData.get("body"),
      createdAt: new Date().toISOString(),
    };

    communications = [entry, ...communications];
    const updated = communications;
    saveToStorage("communications", updated);
    renderCommunications(updated);
    communicationForm.reset();
  });
}

function setupProfile() {
  const profileForm = document.getElementById("profile-form");
  if (!profileForm) {
    return;
  }

  const profile = loadFromStorage("profile", {
    name: "Avv. Daniela Verdi",
    role: "Notaio",
    email: "daniela.verdi@studio.it",
    phone: "+39 347 0000000",
  });

  Object.entries(profile).forEach(([key, value]) => {
    const input = profileForm.elements.namedItem(key);
    if (input) {
      input.value = value || "";
    }
  });

  renderProfile(profile);

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(profileForm);
    const entry = {
      name: formData.get("name"),
      role: formData.get("role"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    };

    saveToStorage("profile", entry);
    renderProfile(entry);
  });
}

function setupTaskbarNavigation() {
  const buttons = document.querySelectorAll(".taskbar-btn[data-panel-target]");
  const panels = document.querySelectorAll(".panel[data-panel]");

  if (!buttons.length || !panels.length) {
    return;
  }

  const showPanel = (panelName) => {
    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === panelName;
      panel.classList.toggle("is-active", isActive);
      panel.toggleAttribute("hidden", !isActive);
    });

    buttons.forEach((button) => {
      if (button.dataset.panelTarget === panelName) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    });
  };

  const initial = document.querySelector(".taskbar-btn.is-active")?.dataset.panelTarget || panels[0].dataset.panel;
  showPanel(initial);

  buttons.forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.panelTarget));
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupTableInteractions();
  setupResultDetails();
  setupFilePicker();
  setupAgenda();
  setupBookings();
  setupCommunications();
  setupProfile();
  setupTaskbarNavigation();
});
