
/* ==========================================
   GENERAL — NAVIDAD
   Decoración independiente del sistema
   ========================================== */

(() => {
  "use strict";

  const CONFIG = {
    nieve: true,
    luces: true,
    saludo: true,
    cantidadCopos: 28,
    soloPortalPublico: true
  };

  const IDS = [
    "general-nieve-navidad",
    "general-luces-navidad",
    "general-saludo-navidad"
  ];

  function esAdmin() {
    return (
      window.location.hash.toLowerCase()
        .startsWith("#admin")
    );
  }

  function limpiar() {
    document.body.classList.remove("navidad-activa");

    IDS.forEach((id) => {
      document.getElementById(id)?.remove();
    });
  }

  function crearNieve() {
    const contenedor = document.createElement("div");
    contenedor.id = "general-nieve-navidad";
    contenedor.setAttribute("aria-hidden", "true");

    for (let i = 0; i < CONFIG.cantidadCopos; i++) {
      const copo = document.createElement("span");
      copo.className = "general-copo";
      copo.textContent = i % 3 === 0 ? "❄" : "•";

      const tamano = 7 + Math.random() * 13;
      const duracion = 12 + Math.random() * 13;
      const retraso = -Math.random() * duracion;

      copo.style.left = `${Math.random() * 100}%`;
      copo.style.fontSize = `${tamano}px`;
      copo.style.animationDuration = `${duracion}s`;
      copo.style.animationDelay = `${retraso}s`;

      contenedor.appendChild(copo);
    }

    document.body.appendChild(contenedor);
  }

  function crearLuces() {
    const contenedor = document.createElement("div");
    contenedor.id = "general-luces-navidad";
    contenedor.setAttribute("aria-hidden", "true");

    const colores = [
      "#ffca54",
      "#e34c58",
      "#4cc99d",
      "#7bb8ff"
    ];

    for (let i = 0; i < 24; i++) {
      const luz = document.createElement("span");
      luz.className = "general-luz";

      luz.style.setProperty(
        "--color-luz",
        colores[i % colores.length]
      );

      luz.style.setProperty(
        "--retraso",
        `${(i % 5) * 0.3}s`
      );

      contenedor.appendChild(luz);
    }

    document.body.appendChild(contenedor);
  }

  function crearSaludo() {
    const saludo = document.createElement("div");
    saludo.id = "general-saludo-navidad";
    saludo.setAttribute("aria-hidden", "true");

    saludo.textContent =
      "🎄 ¡La Navidad llega a pequeños exploradores! ✨";

    document.body.appendChild(saludo);
  }

  function iniciarNavidad() {
    if (!document.body) return;

    limpiar();

    if (CONFIG.soloPortalPublico && esAdmin()) {
      return;
    }

    document.body.classList.add("navidad-activa");

    const movimientoReducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (CONFIG.nieve && !movimientoReducido) {
      crearNieve();
    }

    if (CONFIG.luces) {
      crearLuces();
    }

    if (CONFIG.saludo) {
      crearSaludo();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciarNavidad,
      { once: true }
    );
  } else {
    iniciarNavidad();
  }

  window.addEventListener(
    "hashchange",
    iniciarNavidad
  );
})();
