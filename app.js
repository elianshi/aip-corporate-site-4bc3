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

    form.addEventListener("submit", async (e) => {
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
      const emailVal = document.getElementById("contact-email").value.trim();
      const needVal = document.getElementById("contact-need").value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const params = new URLSearchParams(window.location.search);
      const endpoint = params.get("api") || document.querySelector('meta[name="aip-endpoint"]')?.content || "http://127.0.0.1:8090/api/v1/inbound/leads";
      const projectCode = document.querySelector('meta[name="aip-project-code"]')?.content || "";
      const projectName = document.querySelector('meta[name="aip-project-name"]')?.content || document.title;

      let liveAck = "";
      let pushErr = "";
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_code: projectCode,
            project_name: projectName,
            source: "contact_form",
            contact_name: nameVal,
            contact_email: emailVal,
            need: needVal,
            page_url: window.location.href
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          liveAck = `已实时推送至飞书运营专员 Luna（归类：${data.intent || "咨询"} · 优先级：${data.priority || "P1"}）。`;
        } else {
          pushErr = `服务返回状态 ${resp.status}`;
        }
      } catch (err) {
        pushErr = err?.message || "无法连接本地服务";
        try {
          const q = JSON.parse(localStorage.getItem("aip-pending-leads") || "[]");
          q.push({ contact_name: nameVal, contact_email: emailVal, need: needVal, at: new Date().toISOString() });
          localStorage.setItem("aip-pending-leads", JSON.stringify(q));
        } catch (storageErr) {}
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }

      if (formStatus) {
        if (liveAck) {
          formStatus.style.color = "var(--success)";
          formStatus.textContent = `感谢 ${nameVal}！${liveAck}`;
        } else {
          formStatus.style.color = "var(--danger)";
          formStatus.textContent = `⚠️ 线索已暂存本地，但未能推送至飞书（${pushErr}）。请确认本地 127.0.0.1:8090 服务已启动并在 Chromium/内置浏览器中刷新页面后重试。`;
        }
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
