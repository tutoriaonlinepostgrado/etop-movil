"use strict";
const DATA_URL = "https://tutoriaonlinepostgrado.github.io/sitiowebetop/nrcs.json";
const status = document.getElementById("status");
const search = document.getElementById("search");
const results = document.createElement("section");
results.id = "results";
results.setAttribute("aria-live","polite");
document.querySelector(".panel").insertAdjacentElement("afterend",results);
let courses = null;
const detail=document.createElement("section");
detail.id="course-detail";detail.hidden=true;detail.setAttribute("aria-label","Ficha del curso");
detail.innerHTML='<div class="detail-header"><button type="button" id="detail-back">← Volver a resultados</button><span>FICHA 360 · ETOP MÓVIL</span></div><div id="detail-content"></div>';
results.insertAdjacentElement("afterend",detail);
document.getElementById("detail-back").addEventListener("click",()=>{detail.hidden=true;results.hidden=false;document.querySelector(".panel").hidden=false;document.querySelector(".welcome").hidden=false;results.scrollIntoView({block:"start"});});
function openCourse(c){
 const content=document.getElementById("detail-content");content.replaceChildren();
 const heading=document.createElement("h2");heading.textContent=field(c,"nombre curso","NOMBRE_CURSO","nombre")||"Ficha del curso";content.append(heading);
 const nrc=field(c,"nrc","NRC_COD_CAL");
 const tag=document.createElement("div");tag.className="detail-nrc";tag.textContent=nrc?"NRC "+nrc:"NRC no disponible";content.append(tag);
 const section=document.createElement("section");section.className="detail-section";
 const st=document.createElement("h3");st.textContent="Información del curso";section.append(st);
 for(const [label,keys] of [["Código de curso",["codigo curso","codigo","COD_CURSO"]],["Estado",["estado","ESTADO_CAL"]],["Tutor",["tutor","NOMBRE_TUTOR"]],["Facultad",["facultad","FACULTAD"]],["Programa",["programa","PROGRAMA"]],["Intake",["intake","INTAKE"]],["Inicio",["fecha inicio","FECHA_INICIO"]],["Término",["fecha fin","FECHA_FIN"]]]){
  const p=line(label,field(c,...keys));if(p)section.append(p);
 }
 content.append(section);
 const note=document.createElement("section");note.className="detail-section detail-pending";
 const title=document.createElement("h3");title.textContent="Seguimiento y acciones";note.append(title);
 const p=document.createElement("p");p.textContent="Los indicadores de estudiantes, la nómina y las acciones de edición requieren una conexión institucional autenticada. Esta ficha es de solo lectura.";note.append(p);content.append(note);
 detail.hidden=false;results.hidden=true;document.querySelector(".panel").hidden=true;document.querySelector(".welcome").hidden=true;window.scrollTo({top:0,behavior:"smooth"});
}

const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
const safe = value => String(value ?? "").trim();
const field = (obj,...keys) => { for(const key of keys) if(obj[key]!==undefined && obj[key]!==null && obj[key]!=="")return safe(obj[key]); return ""; };
async function loadCourses(){
 if(courses)return courses;
 status.textContent="Consultando catálogo de cursos...";
 const response=await fetch(DATA_URL,{cache:"no-store"});
 if(!response.ok)throw new Error("HTTP "+response.status);
 const data=await response.json();
 if(!Array.isArray(data))throw new Error("El catálogo no tiene el formato esperado.");
 courses=data;
 return courses;
}
function line(label,value){if(!value)return null;const p=document.createElement("p");const strong=document.createElement("strong");strong.textContent=label+": ";p.append(strong,document.createTextNode(value));return p;}
function render(items){
 detail.hidden=true;results.hidden=false;document.querySelector(".panel").hidden=false;document.querySelector(".welcome").hidden=false;
 results.replaceChildren();
 const heading=document.createElement("h2");heading.textContent="Resultados ("+items.length+")";results.append(heading);
 if(!items.length){const p=document.createElement("p");p.textContent="No encontramos coincidencias. Prueba otro NRC, código, curso o tutor.";results.append(p);return;}
 for(const c of items.slice(0,40)){
  const article=document.createElement("article");article.className="course-card";article.tabIndex=0;article.setAttribute("role","button");article.setAttribute("aria-label","Abrir ficha del curso");article.addEventListener("click",()=>openCourse(c));article.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCourse(c);}});
  const title=document.createElement("h3");title.textContent=field(c,"nombre curso","NOMBRE_CURSO","nombre")||"Curso sin nombre";article.append(title);
  for(const [label,keys] of [["NRC",["nrc","NRC_COD_CAL"]],["Código",["codigo curso","codigo","COD_CURSO"]],["Estado",["estado","ESTADO_CAL"]],["Tutor",["tutor","NOMBRE_TUTOR"]],["Facultad",["facultad","FACULTAD"]],["Inicio",["fecha inicio","FECHA_INICIO"]],["Término",["fecha fin","FECHA_FIN"]]]){
   const p=line(label,field(c,...keys));if(p)article.append(p);
  }
  results.append(article);
 }
 if(items.length>40){const p=document.createElement("p");p.className="result-note";p.textContent="Se muestran las primeras 40 coincidencias. Escribe una búsqueda más específica.";results.append(p);}
}
async function runSearch(){
 const term=norm(search.value);
 if(!term){status.textContent="Escribe un NRC, código, nombre del curso o tutor.";results.replaceChildren();search.focus();return;}
 try{
  const data=await loadCourses();
  const matches=data.filter(c=>["nrc","NRC_COD_CAL","codigo curso","codigo","COD_CURSO","nombre curso","NOMBRE_CURSO","tutor","NOMBRE_TUTOR"].some(k=>norm(c[k]).includes(term)&&safe(c[k])));
  status.textContent="Fuente: catálogo publicado por ETOP. Los datos pueden no estar actualizados en tiempo real.";
  render(matches);
 }catch(e){status.textContent="No se pudo consultar el catálogo de cursos. Comprueba tu conexión o vuelve a intentar.";results.replaceChildren();console.error("Error de consulta ETOP:",e.message);}
}
document.getElementById("searchBtn").addEventListener("click",runSearch);
search.addEventListener("keydown",e=>{if(e.key==="Enter")runSearch();});
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{status.textContent=button.dataset.tool+": módulo pendiente de integración.";document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"center"});}));
document.querySelectorAll("[data-nav]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b===button));status.textContent=button.dataset.nav==="Cursos"?"Escribe un NRC para consultar cursos.":button.dataset.nav+": sección en preparación.";document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"center"});}));
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
