"use strict";
const status = document.getElementById("status");
const search = document.getElementById("search");
document.getElementById("searchBtn").addEventListener("click", () => {
 const term = search.value.trim();
 status.textContent = term ? 'Búsqueda de "' + term + '" pendiente: falta configurar el acceso institucional de solo lectura.' : "Ingresa un NRC, código, nombre de curso o tutor para buscar.";
});
search.addEventListener("keydown", e => { if(e.key === "Enter") document.getElementById("searchBtn").click(); });
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
 status.textContent = button.dataset.tool + ": módulo previsto para una próxima etapa. Todavía no se ejecutan operaciones.";
 document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"center"});
}));
document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => {
 document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b===button));
 status.textContent = button.dataset.nav === "Inicio" || button.dataset.nav === "Cursos" ? "Centro de cursos: prototipo sin conexión a datos." : button.dataset.nav + ": sección pendiente de implementación.";
 document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"center"});
}));
if ("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));