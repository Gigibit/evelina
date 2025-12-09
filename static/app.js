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
    dt.textContent = label;

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
    heading.textContent = sectionTitle;
    section.appendChild(heading);

    section.appendChild(renderValueNode(value));

    container.appendChild(section);
  });

  return container;
}

function getModalElements() {
  const modal = document.getElementById("detail-modal");

  if (!modal) {
    return {};
  }

  return {
    modal,
    overlay: modal.querySelector("[data-close-modal].modal-overlay"),
    closeButton: modal.querySelector("[data-close-modal].modal-close"),
    detailTitle: modal.querySelector("#detail-title"),
    detailContent: modal.querySelector("#detail-content"),
  };
}

function closeModal() {
  const { modal } = getModalElements();

  if (!modal) {
    return;
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openModal(target, record) {
  const { modal, detailTitle, detailContent } = getModalElements();

  if (!modal || !detailTitle || !detailContent) {
    return;
  }

  document.querySelectorAll(".record-row.is-selected").forEach((row) => {
    row.classList.remove("is-selected");
  });
  if (target) {
    target.classList.add("is-selected");
  }

  detailTitle.textContent = target?.dataset.summary || "Dettagli record";
  detailContent.classList.remove("muted");
  detailContent.replaceChildren(buildDetailSections(record));

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function setupModalCloseHandlers() {
  const { overlay, closeButton } = getModalElements();

  [overlay, closeButton].forEach((element) => {
    if (!element) {
      return;
    }

    element.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

function setupTableInteractions() {
  const rows = document.querySelectorAll(".record-row[data-record]");

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const recordData = row.dataset.record ? JSON.parse(row.dataset.record) : {};
      openModal(row, recordData);
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

  if (!fileInput || !fileName) {
    return;
  }

  fileInput.addEventListener("change", () => {
    const name = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "Nessun file selezionato";
    fileName.textContent = name;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupModalCloseHandlers();
  setupTableInteractions();
  setupResultDetails();
  setupFilePicker();
});
