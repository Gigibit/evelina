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

  if (!fileInput || !fileName) {
    return;
  }

  fileInput.addEventListener("change", () => {
    const name = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "Nessun file selezionato";
    fileName.textContent = name;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupTableInteractions();
  setupResultDetails();
  setupFilePicker();
});
