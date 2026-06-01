/* SwiftRemo v6.9 · combobox progresivo para desplegables.
   Mejora todos los <select> sin cambiar contratos JS ni valores almacenados.
   - Input de búsqueda directo.
   - Botón ▾ que abre todas las opciones aunque haya texto escrito.
   - Práctica actual sincronizada con el <select> real.
   - Compatible con selects que se rellenan dinámicamente. */

const ENHANCED = "swiftComboEnhanced";
let openCombo = null;

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function norm(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isEligible(select) {
  if (!select || select.dataset[ENHANCED] === "1") return false;
  if (select.multiple) return false;
  if (select.dataset.noCombo === "1") return false;
  // Evita convertir selects invisibles de reserva.
  const id = select.id || "";
  if (id.startsWith("sql")) return false;
  return true;
}

function optionRows(select) {
  return Array.from(select.options || []).map((opt, index) => ({
    value: opt.value,
    label: opt.textContent || opt.label || opt.value,
    disabled: opt.disabled,
    index
  }));
}

function selectedLabel(select) {
  const opt = select.options?.[select.selectedIndex];
  return opt ? (opt.textContent || opt.label || opt.value || "") : "";
}

function closeCurrent() {
  if (openCombo) {
    openCombo.list.classList.add("hidden");
    openCombo.root.classList.remove("open");
    openCombo = null;
  }
}

function enhanceSelect(select) {
  if (!isEligible(select)) return;
  select.dataset[ENHANCED] = "1";
  select.classList.add("native-select-hidden-v69");

  const root = document.createElement("div");
  root.className = "sr-combo-v69";
  root.dataset.forSelect = select.id || "";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.className = "sr-combo-input-v69";
  input.placeholder = select.getAttribute("aria-label") || select.closest("label")?.childNodes?.[0]?.textContent?.trim() || "Buscar…";
  input.value = selectedLabel(select);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "sr-combo-button-v69";
  button.title = "Mostrar todas las opciones";
  button.setAttribute("aria-label", "Mostrar todas las opciones");
  button.textContent = "▾";

  const list = document.createElement("div");
  list.className = "sr-combo-list-v69 hidden";

  root.append(input, button, list);
  select.insertAdjacentElement("afterend", root);

  let activeIndex = -1;

  function rowsFiltered(useFilter = true) {
    const rows = optionRows(select).filter(r => !r.disabled);
    const q = norm(input.value);
    if (!useFilter || !q) return rows;
    const starts = [];
    const contains = [];
    for (const r of rows) {
      const n = norm(`${r.label} ${r.value}`);
      if (n.startsWith(q)) starts.push(r);
      else if (n.includes(q)) contains.push(r);
    }
    return [...starts, ...contains];
  }

  function renderList({ useFilter = true } = {}) {
    const rows = rowsFiltered(useFilter);
    activeIndex = rows.findIndex(r => r.value === select.value);
    if (activeIndex < 0 && rows.length) activeIndex = 0;

    if (!rows.length) {
      list.innerHTML = `<div class="sr-combo-empty-v69">Sin resultados. Borra la búsqueda o cambia filtros.</div>`;
      return rows;
    }

    list.innerHTML = rows.map((r, i) => {
      const cls = [
        "sr-combo-option-v69",
        r.value === select.value ? "selected" : "",
        i === activeIndex ? "active" : ""
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-value="${esc(r.value)}" data-index="${i}">
        <span>${esc(r.label)}</span>
      </button>`;
    }).join("");

    list.querySelectorAll(".sr-combo-option-v69").forEach(btn => {
      btn.addEventListener("mousedown", ev => ev.preventDefault());
      btn.addEventListener("click", ev => {
        ev.preventDefault();
        choose(btn.dataset.value);
      });
    });
    return rows;
  }

  function open({ useFilter = true } = {}) {
    if (openCombo && openCombo.root !== root) closeCurrent();
    renderList({ useFilter });
    list.classList.remove("hidden");
    root.classList.add("open");
    openCombo = { root, list };
  }

  function choose(value) {
    const old = select.value;
    select.value = value;
    input.value = selectedLabel(select);
    closeCurrent();
    if (select.value !== old) {
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function syncFromSelect() {
    input.value = selectedLabel(select);
  }

  input.addEventListener("input", () => open({ useFilter: true }));
  input.addEventListener("focus", () => open({ useFilter: Boolean(input.value.trim()) }));
  button.addEventListener("click", ev => {
    ev.preventDefault();
    input.focus();
    // El botón muestra todas las opciones aunque la barra tenga texto.
    open({ useFilter: false });
  });

  input.addEventListener("keydown", ev => {
    const visible = !list.classList.contains("hidden");
    if (ev.key === "Escape") {
      closeCurrent();
      input.value = selectedLabel(select);
      return;
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const rows = visible ? rowsFiltered(true) : renderList({ useFilter: true });
      if (!visible) open({ useFilter: true });
      if (!rows.length) return;
      activeIndex += ev.key === "ArrowDown" ? 1 : -1;
      if (activeIndex < 0) activeIndex = rows.length - 1;
      if (activeIndex >= rows.length) activeIndex = 0;
      renderList({ useFilter: true });
      const active = list.querySelector(".sr-combo-option-v69.active");
      active?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (ev.key === "Enter") {
      const rows = rowsFiltered(true);
      if (rows[activeIndex]) {
        ev.preventDefault();
        choose(rows[activeIndex].value);
      }
    }
  });

  input.addEventListener("blur", () => {
    // Permite click en opción antes de cerrar.
    setTimeout(() => {
      if (!root.matches(":focus-within")) {
        input.value = selectedLabel(select);
        closeCurrent();
      }
    }, 140);
  });

  select.addEventListener("change", syncFromSelect);

  const observer = new MutationObserver(() => {
    syncFromSelect();
    if (!list.classList.contains("hidden")) renderList({ useFilter: true });
  });
  observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected"] });
}

function enhanceAll() {
  document.querySelectorAll("select").forEach(enhanceSelect);
}

document.addEventListener("DOMContentLoaded", () => {
  enhanceAll();
  const bodyObserver = new MutationObserver(() => enhanceAll());
  bodyObserver.observe(document.body, { childList: true, subtree: true });
});

document.addEventListener("click", ev => {
  if (openCombo && !openCombo.root.contains(ev.target)) closeCurrent();
});

window.addEventListener("keydown", ev => {
  if (ev.key === "Escape") closeCurrent();
});

window.SwiftRemoComboboxV69 = { enhanceAll };
