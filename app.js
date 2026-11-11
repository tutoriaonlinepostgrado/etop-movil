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
const detailExtras=()=>document.querySelectorAll(".tiles,.notice,main > h2");
const calendarPage=make("section","calendar-page");calendarPage.hidden=true;calendarPage.id="calendar-page";document.querySelector("main").append(calendarPage);
function hideMain(){detail.hidden=true;results.hidden=true;document.querySelector(".panel").hidden=true;document.querySelector(".welcome").hidden=true;detailExtras().forEach(el=>el.hidden=true);}
function activateNav(name){document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===name));}
function showMain(){editorPage.hidden=true;calendarPage.hidden=true;detail.hidden=true;results.hidden=false;document.querySelector(".panel").hidden=false;document.querySelector(".welcome").hidden=false;detailExtras().forEach(el=>el.hidden=false);}
document.getElementById("detail-back").addEventListener("click",()=>{showMain();results.scrollIntoView({block:"start"});});
function make(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function openCourse(c){
 editorPage.hidden=true;
 const content=document.getElementById("detail-content");content.replaceChildren();
 const state=field(c,"estado","ESTADO_CAL")||"Sin estado";
 const heading=make("div","course-heading");
 const stateBadge=make("span","course-state",state);heading.append(stateBadge);
 heading.append(make("h2","",field(c,"nombre curso","NOMBRE_CURSO","nombre")||"Ficha del curso"));
 heading.append(make("p","course-nrc","NRC "+(field(c,"nrc","NRC_COD_CAL")||"No disponible")));
 content.append(heading);
 const section=make("section","detail-section");
 section.append(make("h3","","Datos del curso"));
 const grid=make("div","detail-grid");
 for(const [label,keys] of [["Tutor",["tutor","NOMBRE_TUTOR"]],["Código",["codigo curso","codigo","COD_CURSO"]],["Inicio",["fecha inicio","FECHA_INICIO"]],["Término",["fecha fin","FECHA_FIN"]],["Facultad",["facultad","FACULTAD"]],["Intake",["intake","INTAKE"]],["Programa",["programa","PROGRAMA"]]]){
  const value=field(c,...keys);if(!value)continue;
  const item=make("div","detail-field");item.append(make("span","",label),make("strong","",value));grid.append(item);
 }
 section.append(grid);content.append(section);
 const follow=make("section","detail-section");follow.append(make("h3","","Seguimiento estudiantil"));
 const metrics=make("div","metric-grid");
 for(const label of ["Estudiantes","Sin ingreso","En riesgo"]){const m=make("div","metric-box");m.append(make("strong","","—"),make("span","",label));metrics.append(m);}
 follow.append(metrics,make("p","detail-caption","Indicadores pendientes de conexión institucional autenticada."));content.append(follow);
 const actions=make("section","detail-section");actions.append(make("h3","","Accesos y herramientas del NRC"));
 const actionGrid=make("div","detail-actions");
 const nrc=field(c,"nrc","NRC_COD_CAL");
 const id=field(c,"id","ID");
 const intake=field(c,"intake","INTAKE");
 const baseSP="https://unabportal365.sharepoint.com/sites/actasynrc/Lists/NRC_TUTOR_ACTUAL/";
 const sharepointCourse=id?baseSP+"DispForm.aspx?ID="+encodeURIComponent(id)+"&env=Embedded":"";
 const sharepointIntake=intake?new URL("Vista_version.aspx",baseSP):null;
 if(sharepointIntake){const p=sharepointIntake.searchParams;p.set("viewid","f4c009bb-0552-43a5-9718-9c1d37d8f98b");p.set("env","WebViewList");p.set("FilterField1","field_8");p.set("FilterValue1",intake);}
 const students=nrc?new URL("https://unabportal365.sharepoint.com/sites/actasynrc/Lists/BASESEMAFORO_20/Todosloselementos.aspx"):null;
 if(students){students.searchParams.set("FilterField1","NRC_COD_CAL_FILTRO");students.searchParams.set("FilterValue1",nrc);students.searchParams.set("FilterType1","Text");students.searchParams.set("viewid","1f85f1c7-089f-47d6-8635-a2cc761fecc3");students.searchParams.set("env","Embedded");}
 const pieces=nrc.split("_");const period=pieces.at(-1),crn=pieces[0];
 const integration=crn&&period?new URL("https://lms.unab.cl/int-canvas/"):null;
 if(integration){for(const [k,v] of Object.entries({term_code:period,periodo:period,nrc:crn,nrc_code:crn,crn,NRC:crn}))integration.searchParams.set(k,v);}
 const editor=id?new URL("https://apps.powerapps.com/play/e/default-8fbed393-d03b-49f8-be79-cd5e1f590fb2/a/8d0fd473-95da-45be-8063-4cfebbbd6624"):null;
 if(editor){editor.searchParams.set("tenantId","8fbed393-d03b-49f8-be79-cd5e1f590fb2");editor.searchParams.set("ids",id);}
 const links=[
 ["Ver calendarios","",()=>openCalendars(c)],
 ["Curso en SharePoint",sharepointCourse],
 ["Cursos del intake",sharepointIntake?.href],
 ["Base Semáforo",students?.href],
 ["Web de Integración",integration?.href],
 ["Editar curso","",()=>openCourseEditor(c,null,"ficha")],
 ["Incidencias",nrc?"https://tutoriaonlinepostgrado.github.io/sitiowebetop/incidencias.html?nrc="+encodeURIComponent(nrc):""]
 ];
 for(const [label,url,action] of links){
  let b;
  if(action){b=make("button","action-enabled",label);b.type="button";b.addEventListener("click",action);}
  else if(url){b=make("a","action-link",label+" ↗");b.href=url;b.target="_blank";b.rel="noopener noreferrer";}
  else{b=make("button","",label);b.disabled=true;b.title="No hay identificador o dato suficiente para construir el acceso";}
  actionGrid.append(b);
 }
 actions.append(actionGrid,make("p","detail-caption","Los accesos institucionales requieren permisos Microsoft 365. Las vistas y aplicaciones externas se abren aparte."));content.append(actions);
 detail.hidden=false;results.hidden=true;document.querySelector(".panel").hidden=true;document.querySelector(".welcome").hidden=true;detailExtras().forEach(el=>el.hidden=true);window.scrollTo({top:0,behavior:"smooth"});
}


let calendarFiltered=[],calendarOffset=0,calendarContextCourse=null;
function optionSelect(label,values){
 const wrap=make("label","calendar-filter");wrap.append(make("span","",label));
 const input=make("input","calendar-filter-input");input.type="search";input.placeholder="Todos · buscar "+label.toLowerCase();input.setAttribute("aria-label","Filtrar por "+label);
 const datalist=make("datalist");datalist.id="cal-options-"+label.toLowerCase().replace(/[^a-z0-9]/g,"-");
 values.forEach(v=>datalist.append(new Option(v,v)));input.setAttribute("list",datalist.id);
 wrap.append(input,datalist);return {wrap,select:input};
}
function renderCalendarRows(){
 const list=document.getElementById("calendar-list");list.replaceChildren();
 const subset=calendarFiltered.slice(calendarOffset,calendarOffset+35);
 for(const c of subset){
  const card=make("article","calendar-row");
  const top=make("div","calendar-row-top");top.append(make("strong","",field(c,"nombre curso","NOMBRE_CURSO")||"Curso sin nombre"),make("span","",field(c,"estado","ESTADO_CAL")));
  card.append(top,make("p","","NRC "+field(c,"nrc","NRC_COD_CAL")+" · "+field(c,"codigo curso","codigo","COD_CURSO")));
  card.append(make("p","","Tutor: "+(field(c,"tutor","NOMBRE_TUTOR")||"Sin asignar")));
  const dates=make("div","calendar-row-dates");dates.append(make("span","","Inicio: "+(field(c,"fecha inicio","FECHA_INICIO")||"—")),make("span","","Término: "+(field(c,"fecha fin","FECHA_FIN")||"—")));card.append(dates);
  const actions=make("div","calendar-row-actions");
  const view=make("button","calendar-action","Ver ficha");view.type="button";view.addEventListener("click",()=>{calendarPage.hidden=true;openCourse(c);activateNav("Cursos");});
  actions.append(view);
  const edit=make("button","calendar-action calendar-edit","Editar curso");edit.type="button";edit.addEventListener("click",()=>openCourseEditor(c,calendarContextCourse));actions.append(edit);
  card.append(actions);list.append(card);
 }
 document.getElementById("calendar-count").textContent=calendarFiltered.length+" cursos · mostrando "+(calendarFiltered.length?calendarOffset+1:0)+"–"+Math.min(calendarOffset+35,calendarFiltered.length);
 document.getElementById("calendar-prev").disabled=calendarOffset===0;
 document.getElementById("calendar-next").disabled=calendarOffset+35>=calendarFiltered.length;
}
const POWERAPP_EDITOR="https://apps.powerapps.com/play/e/default-8fbed393-d03b-49f8-be79-cd5e1f590fb2/a/8d0fd473-95da-45be-8063-4cfebbbd6624";
let editorReturnCourse=null,editorReturnView="calendarios",editorOriginCourse=null;
const editorPage=make("section","editor-page");editorPage.id="editor-page";editorPage.hidden=true;document.querySelector("main").append(editorPage);
function closeCourseEditor(){
 editorPage.replaceChildren();editorPage.hidden=true;
 if(editorReturnView==="ficha"&&editorOriginCourse){openCourse(editorOriginCourse);activateNav("Cursos");}else if(editorReturnCourse){openCalendars(editorReturnCourse);}else{openCalendars();}
}
function openCourseEditor(c,contextCourse=null,origin="calendarios"){
 const id=field(c,"id","ID");
 if(!id){alert("El catálogo no contiene el ID de SharePoint necesario para abrir el editor de este curso.");return;}
 editorReturnCourse=contextCourse;editorReturnView=origin;editorOriginCourse=c;
 const url=new URL(POWERAPP_EDITOR);url.searchParams.set("tenantId","8fbed393-d03b-49f8-be79-cd5e1f590fb2");url.searchParams.set("ids",id);
 const target=url.href;
 hideMain();calendarPage.hidden=true;editorPage.hidden=false;editorPage.replaceChildren();
 const header=make("div","editor-top");
 const back=make("button","calendar-back",origin==="ficha"?"← Volver a ficha 360":"← Volver a calendarios");back.type="button";back.addEventListener("click",closeCourseEditor);
 const title=make("div","");title.append(make("h2","","Editar curso"),make("p","detail-caption",field(c,"nombre curso","NOMBRE_CURSO")||"Curso ETOP"),make("p","detail-caption","NRC "+(field(c,"nrc","NRC_COD_CAL")||"")));
 header.append(back,title);editorPage.append(header);
 const notice=make("p","detail-caption","Editor institucional de Microsoft Power Apps. Inicia sesión con tu cuenta UNAB si se solicita. Si el formulario no aparece, utiliza Abrir editor.");
 editorPage.append(notice);
 const frame=make("iframe","editor-frame");frame.title="Editor institucional del curso";frame.src=target;frame.setAttribute("loading","eager");frame.setAttribute("referrerpolicy","strict-origin-when-cross-origin");editorPage.append(frame);
 const fallback=make("a","calendar-new","Abrir editor en Microsoft 365 ↗");fallback.href=target;fallback.target="_blank";fallback.rel="noopener noreferrer";editorPage.append(fallback);
 editorPage.append(make("p","detail-caption","Al regresar, el catálogo público puede tardar en reflejar los cambios guardados en SharePoint."));
 window.scrollTo(0,0);
}
async function openCalendars(selectedCourse=null){
 calendarContextCourse=selectedCourse;editorPage.hidden=true;
 hideMain();calendarPage.hidden=false;activateNav("Cursos");calendarPage.replaceChildren(make("h2","","Calendarios ETOP"),make("p","detail-caption","Consultando catálogo de cursos..."));
 window.scrollTo(0,0);
 try{
  const allData=await loadCourses();
  const intake=selectedCourse?field(selectedCourse,"intake","INTAKE"):"";
  if(selectedCourse&&!intake){
   calendarPage.replaceChildren(make("h2","","Calendario de la versión"),make("p","detail-caption","Este NRC no tiene intake o versión informada en el catálogo; no es posible identificar sus cursos relacionados."));
   const back=make("button","calendar-back","← Volver a la ficha");back.addEventListener("click",()=>openCourse(selectedCourse));calendarPage.append(back);return;
  }
  const data=intake?allData.filter(c=>norm(field(c,"intake","INTAKE"))===norm(intake)):allData;
  calendarPage.replaceChildren(make("h2","",selectedCourse?"Calendario de la versión":"Calendarios ETOP"),make("p","detail-caption",selectedCourse?"Cursos del mismo intake o versión que el NRC seleccionado.":"Consulta de todos los cursos del catálogo ETOP. Los datos pueden tener desfase."));
  if(selectedCourse){
   const back=make("button","calendar-back","← Volver a la ficha");back.addEventListener("click",()=>openCourse(selectedCourse));calendarPage.append(back);
   calendarPage.append(make("p","calendar-scope","Versión: "+intake));
  }
  const filters=make("div","calendar-filters");
  const query=make("input","calendar-query");query.placeholder="Buscar NRC, curso o tutor";query.setAttribute("aria-label","Buscar cursos del calendario");
  calendarPage.append(query);
  const selects={};
  for(const [label,key] of [["Estado","estado"],["Facultad","facultad"],["Tutor","tutor"],["Intake","intake"]]){
   const values=[...new Set(data.map(c=>field(c,key)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
   const control=optionSelect(label,values);filters.append(control.wrap);selects[key]=control.select;
  }
  if(selectedCourse){selects.intake.value=intake;selects.intake.readOnly=true;}
  calendarPage.append(filters);
  const toolbar=make("div","calendar-toolbar");
  const newCourse=make("a","calendar-new","＋ Agregar curso en SharePoint ↗");
  newCourse.href="https://unabportal365.sharepoint.com/sites/actasynrc/Lists/NRC_TUTOR_ACTUAL/NewForm.aspx";
  newCourse.target="_blank";newCourse.rel="noopener noreferrer";
  toolbar.append(newCourse,make("p","detail-caption","La consulta utiliza el catálogo publicado. Editar y agregar abren Microsoft 365 con tus permisos institucionales; los cambios no se guardan en el catálogo local."));
  calendarPage.append(toolbar,make("p","calendar-count",""));
  calendarPage.lastChild.id="calendar-count";
  const list=make("div","calendar-list");list.id="calendar-list";calendarPage.append(list);
  const pager=make("div","calendar-pager");
  const prev=make("button","","← Anteriores");prev.id="calendar-prev";
  const next=make("button","","Siguientes →");next.id="calendar-next";
  prev.addEventListener("click",()=>{calendarOffset=Math.max(0,calendarOffset-35);renderCalendarRows();});
  next.addEventListener("click",()=>{calendarOffset+=35;renderCalendarRows();});
  pager.append(prev,next);calendarPage.append(pager);
  const apply=()=>{
   const q=norm(query.value);
   calendarFiltered=data.filter(c=>
    (!q||["nrc","NRC_COD_CAL","nombre curso","NOMBRE_CURSO","tutor","codigo curso","codigo","intake","facultad","estado","programa"].some(k=>norm(c[k]).includes(q)))&&
    Object.entries(selects).every(([key,input])=>!input.value||norm(field(c,key)).includes(norm(input.value)))
   ).sort((a,b)=>field(a,"fecha inicio","FECHA_INICIO").localeCompare(field(b,"fecha inicio","FECHA_INICIO")));
   calendarOffset=0;renderCalendarRows();
  };
  query.addEventListener("input",apply);Object.values(selects).forEach(el=>el.addEventListener("input",apply));apply();
 }catch(e){calendarPage.append(make("p","","No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentar."));}
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
 showMain();
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
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.tool==="Calendarios"){openCalendars();return;}if(/herramientas|nóminas/i.test(button.dataset.tool)){window.location.href="./herramientas.html";return;}status.textContent=button.dataset.tool+": módulo pendiente de integración.";document.querySelector(".panel").scrollIntoView({behavior:"smooth",block:"center"});}));
document.querySelectorAll("[data-nav]").forEach(button=>button.addEventListener("click",()=>{activateNav(button.dataset.nav);if(button.dataset.nav==="Cursos"){openCalendars();return;}showMain();status.textContent=button.dataset.nav==="Inicio"?"Busca un NRC para abrir su ficha.":button.dataset.nav+": sección en preparación.";window.scrollTo(0,0);}));
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
