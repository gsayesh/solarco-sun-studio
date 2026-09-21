(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const menu = $(".menu-toggle");
  const nav = $("#navigation");
  function closeMenu() {
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open navigation");
    nav.classList.remove("is-open");
  }
  // A sibling dropdown can sample the page backdrop beyond the sticky header.
  const navigationMedia = window.matchMedia("(max-width: 700px)");
  const header = menu.closest("header");
  const headerInner = $(".header-inner");
  const headerAction = $(".header-cta");
  function positionNavigation() {
    closeMenu();
    if (navigationMedia.matches) {
      nav.classList.add("mobile-navigation");
      header.insertAdjacentElement("afterend", nav);
    } else {
      nav.classList.remove("mobile-navigation");
      headerInner.insertBefore(nav, headerAction);
    }
  }
  navigationMedia.addEventListener("change", positionNavigation);
  positionNavigation();
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
    nav.classList.toggle("is-open", open);
  });
  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      closeMenu();
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu.getAttribute("aria-expanded") === "true"
    ) {
      closeMenu();
      menu.focus();
    }
  });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden =
        !active;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (["ArrowRight", "ArrowDown"].includes(event.key))
        next = (index + 1) % tabs.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key))
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectTab(tabs[next]);
        tabs[next].focus();
      }
    });
  });
  const hour = $("#sun-hour");
  const battery = $("#battery-toggle");
  const layers = $("#scene-layers");
  function updateSceneCopy() {
    const value = Number(hour.value);
    const hours = Math.floor(value);
    const minutes = value % 1 ? "30" : "00";
    const time = `${hours % 12 || 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
    $("#time-display").textContent = time;
    hour.setAttribute("aria-valuetext", time);
    const storage = battery.getAttribute("aria-pressed") === "true";
    const evening = value >= 18 || value <= 6.5;
    $("#scene-status").textContent = evening
      ? storage
        ? "As daylight fades, stored energy can power your evening."
        : "As daylight fades, a grid connection can supply your home."
      : storage
        ? "Daylight powers your home. Surplus can be stored or exported."
        : "Daylight powers your home. Surplus may be exported to the grid.";
    $("#battery-label").textContent = storage
      ? "With battery storage"
      : "Solar without storage";
    $("#battery-caption").textContent = storage
      ? "Save some sunshine for later"
      : "Explore a solar-only home";
  }
  hour.addEventListener("input", () => {
    updateSceneCopy();
    window.solarScene?.setHour(Number(hour.value));
  });
  battery.addEventListener("click", () => {
    const on = battery.getAttribute("aria-pressed") !== "true";
    battery.setAttribute("aria-pressed", String(on));
    updateSceneCopy();
    window.solarScene?.setBattery(on);
  });
  layers.addEventListener("click", () => {
    const on = layers.getAttribute("aria-pressed") !== "true";
    layers.setAttribute("aria-pressed", String(on));
    window.solarScene?.setExploded(on);
  });
  $("#scene-reset").addEventListener("click", () => {
    hour.value = "12";
    battery.setAttribute("aria-pressed", "true");
    layers.setAttribute("aria-pressed", "false");
    updateSceneCopy();
    window.solarScene?.setHour(12);
    window.solarScene?.setBattery(true);
    window.solarScene?.setExploded(false);
    window.solarScene?.resetView();
  });
  const dragHintMarkup = $(".drag-hint").innerHTML;
  window.addEventListener("solar:ready", () => {
    updateSceneCopy();
    $("#scene-reset").hidden = false;
    layers.hidden = false;
    $(".drag-hint").innerHTML = dragHintMarkup;
  });
  document
    .querySelector('script[src="solar-scene.js"]')
    ?.addEventListener("error", () =>
      window.dispatchEvent(new Event("solar:error")),
    );
  window.addEventListener("solar:error", () => {
    $(".drag-hint").textContent = "Architectural solar concept";
    $("#scene-reset").hidden = true;
    layers.hidden = true;
  });
  const form = $("#enquiry-form");
  const success = $("#form-success");
  form.querySelector("[type=submit]").disabled = false;
  const fields = ["name", "location", "email", "phone", "consent"];
  const messages = {
    name: "Please add your name.",
    location: "Please add your suburb or postcode.",
    email: "Please enter a valid email address.",
    phone: "Please use a valid phone number, or leave this blank.",
    consent: "Please confirm we may contact you about your enquiry.",
  };
  function validate(id) {
    const input = document.getElementById(id);
    const value = input.value.trim();
    let valid = true;
    if (id === "consent") valid = input.checked;
    else if (id === "email") valid = value !== "" && input.validity.valid;
    else if (id === "phone")
      valid =
        !value ||
        (/^[+()\d\s.-]+$/.test(value) && value.replace(/\D/g, "").length >= 7);
    else valid = value.length > 0;
    input.setAttribute("aria-invalid", String(!valid));
    document.getElementById(`${id}-error`).textContent = valid
      ? ""
      : messages[id];
    return valid;
  }
  fields.forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      if (input.hasAttribute("aria-invalid")) validate(id);
    });
    input.addEventListener("blur", () => {
      if (input.value || input.hasAttribute("aria-invalid")) validate(id);
    });
  });
  document.querySelectorAll("[data-interest]").forEach((link) =>
    link.addEventListener("click", () => {
      if (form.hidden) $("#form-reset").click();
      const interest = [...form.elements.interest].find(
        (input) => input.value === link.dataset.interest,
      );
      if (interest) interest.checked = true;
    }),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const invalid = fields.filter((id) => !validate(id));
    if (invalid.length) {
      document.getElementById(invalid[0]).focus();
      return;
    }
    const config = window.SOLAR_CONFIG || { mode: "demo" };
    const submit = form.querySelector('[type="submit"]');
    const error = $("#submit-error");
    error.hidden = true;
    if (config.mode === "live") {
      if (!config.endpoint) {
        error.textContent =
          "The enquiry service is not connected yet. Please try again when the live service is available.";
        error.hidden = false;
        return;
      }
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result.success !== true)
          throw new Error("Submission not confirmed");
        success.querySelector(".eyebrow").textContent =
          "YOUR ENQUIRY HAS BEEN RECEIVED";
        success.querySelector("h3").textContent =
          "Your next chapter starts here.";
        success.querySelector("p:not(.eyebrow)").textContent =
          "Thank you for sharing a little about your home. Your enquiry has been sent to The Solar Co.";
      } catch {
        error.textContent =
          "Your enquiry could not be confirmed. Your details are still here so you can try again.";
        error.hidden = false;
        return;
      } finally {
        clearTimeout(timeout);
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
      }
    }
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
  $("#form-reset").addEventListener("click", () => {
    form.reset();
    fields.forEach((id) => {
      document.getElementById(id).removeAttribute("aria-invalid");
      document.getElementById(`${id}-error`).textContent = "";
    });
    $("#submit-error").hidden = true;
    success.hidden = true;
    form.hidden = false;
    form.querySelector("input").focus();
  });
  if (window.SOLAR_CONFIG?.mode === "live")
    $(".demo-note").textContent =
      "Your details are used to respond to this enquiry.";
  const mobileCta = $(".mobile-quote");
  if ("IntersectionObserver" in window) {
    let heroInView = true;
    let quoteInView = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.classList.contains("hero-copy"))
            heroInView = entry.isIntersecting;
          else quoteInView = entry.isIntersecting;
        });
        const hidden = heroInView || quoteInView;
        mobileCta.classList.toggle("is-hidden", hidden);
        mobileCta.tabIndex = hidden ? -1 : 0;
        mobileCta.setAttribute("aria-hidden", String(hidden));
      },
      { threshold: 0 },
    );
    observer.observe($(".hero-copy"));
    observer.observe($("#quote"));
  }
})();
