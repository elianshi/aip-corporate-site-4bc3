(() => {
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  const themeToggle = document.getElementById("theme-toggle");
  const osDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const applyStoredScheme = () => {
    let val = "light dark";
    try {
      const stored = localStorage.getItem("color-scheme");
      if (stored === "light" || stored === "dark") val = stored;
    } catch (e) {}
    if (metaScheme) metaScheme.content = val;
  };

  if (themeToggle && metaScheme) {
    themeToggle.addEventListener("click", () => {
      const currentStored = (() => {
        try { return localStorage.getItem("color-scheme"); } catch (e) { return null; }
      })();
      const osScheme = osDarkQuery.matches ? "dark" : "light";
      const rendered = (currentStored === "light" || currentStored === "dark") ? currentStored : osScheme;
      const target = rendered === "dark" ? "light" : "dark";
      try {
        if (target === osScheme) {
          localStorage.removeItem("color-scheme");
          metaScheme.content = "light dark";
        } else {
          localStorage.setItem("color-scheme", target);
          metaScheme.content = target;
        }
      } catch (e) {
        metaScheme.content = target;
      }
    });
    window.addEventListener("storage", (e) => {
      if (e.key === "color-scheme") applyStoredScheme();
    });
  }

  // Modal dialog triggers
  const demoDialog = document.getElementById("demo-dialog");
  const openDemoBtns = [document.getElementById("open-demo-btn"), document.getElementById("hero-demo-btn")];
  openDemoBtns.forEach((btn) => {
    if (btn && demoDialog) {
      btn.addEventListener("click", () => demoDialog.showModal());
    }
  });
  if (demoDialog) {
    demoDialog.addEventListener("close", () => {
      if (demoDialog.returnValue === "go-contact") {
        document.getElementById("contact-name")?.focus();
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Scroll reveal fallback when CSS animation-timeline view() is unsupported
  if (!CSS.supports("(animation-timeline: view()) and (animation-range: entry)") &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const cards = document.querySelectorAll(".reveal-card");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }
      }
    }, { threshold: 0.15 });
    cards.forEach((el) => {
      el.style.transition = "opacity 0.35s ease, transform 0.35s ease";
      observer.observe(el);
    });
  }

  // Deferred validation & ARIA sync for consultation form
  const form = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  if (form) {
    const announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "visually-hidden";
    document.body.append(announcer);

    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const supportsUserInvalid = CSS.supports("selector(:user-invalid)");
    const dirtyMap = new WeakMap();

    const syncField = (el, allowAnnounce) => {
      if (!el.matches?.("input, textarea, select")) return;
      const isInvalid = supportsUserInvalid ? el.matches(":user-invalid") : !el.validity.valid;
      if (!supportsUserInvalid) {
        el.classList.toggle("user-invalid-fallback", isInvalid);
      }
      el.setAttribute("aria-invalid", isInvalid ? "true" : "false");
      linkError(el, isInvalid);
      if (isInvalid && allowAnnounce) {
        const errNode = document.getElementById(el.dataset.error);
        if (errNode) announcer.textContent = errNode.textContent.trim();
      }
    };

    form.querySelectorAll("input, textarea").forEach((el) => el.setAttribute("aria-invalid", "false"));
    form.addEventListener("blur", (e) => {
      dirtyMap.set(e.target, true);
      syncField(e.target, true);
    }, true);
    form.addEventListener("input", (e) => {
      if (dirtyMap.get(e.target)) syncField(e.target, false);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstInvalid = null;
      form.querySelectorAll("input, textarea").forEach((el) => {
        dirtyMap.set(el, true);
        if (!el.validity.valid && !firstInvalid) firstInvalid = el;
        syncField(el, false);
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      const nameVal = document.getElementById("contact-name").value.trim();
      if (formStatus) {
        formStatus.textContent = `感谢 ${nameVal}！我们已收到您的企业咨询请求，架构师将尽快联系您。`;
      }
      form.reset();
      form.querySelectorAll("input, textarea").forEach((el) => {
        dirtyMap.delete(el);
        el.classList.remove("user-invalid-fallback");
        el.setAttribute("aria-invalid", "false");
        linkError(el, false);
      });
    });
  }
})();
