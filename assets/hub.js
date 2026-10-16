/* Northeastern Economics PhD Student Hub: page behaviour.
   All content lives in data/*.json and index.html; this file only renders it. */
(async function(){
const getJSON=path=>fetch(path,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(path+' returned '+r.status);return r.json();});
const getText=path=>fetch(path,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(path+' returned '+r.status);return r.text();});
let alumni,content,T;
try{
[alumni,content,T]=await Promise.all([getJSON('data/alumni.json'),getJSON('data/resources.json'),getJSON('data/latex.json')]);
await Promise.all(Object.values(T).map(async t=>{t.src=await getText(t.source);}));
}catch(err){
console.error(err);
const box=document.createElement('div');box.className='load-error';box.setAttribute('role','alert');
box.innerHTML='<strong>The hub’s content could not be loaded.</strong><p>Reload the page. If you opened index.html straight from your computer, preview it with <code>python3 -m http.server</code> instead (see README).</p>';
document.getElementById('main').prepend(box);return;
}
const {resources,archive:archiveResources,groupNotes,searchExtras=[]}=content;
resources.forEach(r=>{r.desc=r.desc.replace('{alumni_count}',alumni.length);});

// ---- Alumni directory (data/alumni.json) ----
function normalizeDirectoryText(value){return String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/ı/g,'i').replace(/[’'ʻ]/g,'').replace(/[–—-]/g,' ');}
function alumniVerification(person){if(person.status!=='verified')return 'unconfirmed';return person.verification_scope==='employer'?'employer':'role';}
function filterAlumni(records,query='',cohort='',verification=''){const words=normalizeDirectoryText(query).trim().split(/\s+/).filter(Boolean);return records.filter(p=>(!cohort||p.cohort===cohort)&&(!verification||alumniVerification(p)===verification)&&words.every(w=>normalizeDirectoryText([p.name,p.display_name,p.current_role,p.current_employer,p.cohort].join(' ')).includes(w)));}
const alumniSearchResources=alumni.map(p=>({category:'Alumni current positions',title:p.display_name||p.name,desc:alumniVerification(p)==='unconfirmed'?'Current position unconfirmed':(p.current_role?p.current_role+' · ':'')+p.current_employer,url:'#alumni-'+p.id,keywords:p.name+' '+p.cohort+' alumni placements current positions employers',route:'careers'}));
const alumniSearch=document.getElementById('alumni-search');
const alumniCohort=document.getElementById('alumni-cohort');
const alumniStatus=document.getElementById('alumni-verification');
const alumniRows=document.getElementById('alumni-rows');
let alumniPage=0;const alumniPageSize=12;let selectedAlumnus=null;
function directoryElement(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function alumniCheckedDate(person){const date=new Date(person.checked_date+'T12:00:00Z');return Number.isNaN(date.getTime())?'Date unavailable':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);}
function directoryNotes(person){let notes=Array.isArray(person.notes)?person.notes.filter(Boolean).join(' '):String(person.notes||'');if(alumniVerification(person)==='employer'&&!/title.*(public|confirm|available|visible|hidden)|exact.*title/i.test(notes))notes=(notes+' Exact formal title is not publicly confirmed.').trim();return notes;}
function alumniRow(person){const level=alumniVerification(person);const row=directoryElement('tr',level==='unconfirmed'?'alumni-unconfirmed':'');row.id='alumni-row-'+person.id;if(person.id===selectedAlumnus)row.classList.add('alumni-selected');const nameCell=directoryElement('td');nameCell.append(directoryElement('strong','alumni-name',person.display_name||person.name),directoryElement('span','alumni-cohort','Wiki cohort '+person.cohort));if(person.display_name&&normalizeDirectoryText(person.display_name)!==normalizeDirectoryText(person.name)){nameCell.append(directoryElement('span','alumni-alias','Listed in the wiki as '+person.name));}const positionCell=directoryElement('td');if(level==='role'){positionCell.append(directoryElement('strong','alumni-role',person.current_role),directoryElement('span','alumni-employer',person.current_employer));}else if(level==='employer'){positionCell.append(directoryElement('strong','alumni-role',person.current_employer),directoryElement('span','alumni-employer',person.current_role?'Profile description: '+person.current_role:'Exact title not publicly confirmed'));}else{positionCell.append(directoryElement('strong','alumni-role','Current position not confirmed'),directoryElement('span','alumni-employer','Further verification needed'));}const sourceCell=directoryElement('td');sourceCell.append(directoryElement('span','verification-badge '+(level==='role'?'':level),level==='role'?'Role & employer confirmed':level==='employer'?'Employer confirmed only':'Unconfirmed'));if(person.source_url){const source=directoryElement('a','alumni-source',(person.source_label||person.source_title||'Professional source')+' ↗');source.href=person.source_url;source.target='_blank';source.rel='noopener noreferrer';sourceCell.append(source);}else{sourceCell.append(directoryElement('span','alumni-employer','No conclusive public source'));}sourceCell.append(directoryElement('span','alumni-source-date','Checked '+alumniCheckedDate(person)));const note=directoryNotes(person);if(note){const details=directoryElement('details','alumni-notes');details.append(directoryElement('summary','','Verification notes'),directoryElement('p','',note));sourceCell.append(details);}row.append(nameCell,positionCell,sourceCell);return row;}
function renderAlumni(){const found=filterAlumni(alumni,alumniSearch.value,alumniCohort.value,alumniStatus.value);const pages=Math.max(1,Math.ceil(found.length/alumniPageSize));alumniPage=Math.min(alumniPage,pages-1);const start=alumniPage*alumniPageSize;alumniRows.replaceChildren(...found.slice(start,start+alumniPageSize).map(alumniRow));document.getElementById('alumni-results').textContent=found.length+' of '+alumni.length+' alumni'+(found.length?' · Showing '+(start+1)+'–'+Math.min(start+alumniPageSize,found.length):'');document.getElementById('alumni-empty').hidden=found.length>0;document.getElementById('alumni-pagination').hidden=found.length===0;document.getElementById('alumni-page-label').textContent='Page '+(alumniPage+1)+' of '+pages;document.getElementById('alumni-previous').disabled=alumniPage===0;document.getElementById('alumni-next').disabled=alumniPage>=pages-1;}
function resetAlumni(){alumniSearch.value='';alumniCohort.value='';alumniStatus.value='';alumniPage=0;selectedAlumnus=null;renderAlumni();}
function selectAlumnus(id){const person=alumni.find(p=>p.id===Number(id));if(!person)return;alumniCohort.value='';alumniStatus.value='';alumniSearch.value=person.display_name||person.name;alumniPage=0;selectedAlumnus=person.id;renderAlumni();}
const cohortNames=[...new Set(alumni.map(p=>p.cohort))].sort().reverse();cohortNames.forEach(cohort=>{const option=directoryElement('option','',cohort);option.value=cohort;alumniCohort.append(option);});
document.getElementById('alumni-total').textContent=alumni.length;['role','employer','unconfirmed'].forEach(level=>document.getElementById('alumni-'+level+'-count').textContent=alumni.filter(p=>alumniVerification(p)===level).length);
[alumniSearch,alumniCohort,alumniStatus].forEach(control=>control.addEventListener(control===alumniSearch?'input':'change',()=>{alumniPage=0;selectedAlumnus=null;renderAlumni();}));document.getElementById('alumni-reset').addEventListener('click',()=>{resetAlumni();alumniSearch.focus();});
document.getElementById('alumni-previous').addEventListener('click',()=>{alumniPage=Math.max(0,alumniPage-1);renderAlumni();document.getElementById('placements-title').scrollIntoView({block:'start'});});document.getElementById('alumni-next').addEventListener('click',()=>{alumniPage++;renderAlumni();document.getElementById('placements-title').scrollIntoView({block:'start'});});renderAlumni();

// ---- Research & Resources search entries, read from the cards and the software table in index.html ----
const cellText=el=>el?el.textContent.replace(/\s+/g,' ').trim():'';
const firstHref=el=>{const a=el.querySelector('a[href]');return a?a.getAttribute('href'):'#research';};
const rrSearch=[
...[...document.querySelectorAll('#rr-data .rr-card')].map(card=>({category:'Research & Resources · Data',title:cellText(card.querySelector('h4')),desc:cellText(card.querySelector('.rr-what')),url:firstHref(card),keywords:'data dataset database '+cellText(card.querySelector('.rr-tag'))})),
...[...document.querySelectorAll('#rr-software tbody tr')].map(row=>{const cells=row.querySelectorAll('td');return {category:'Research & Resources · Software',title:cellText(row.querySelector('th')),desc:cellText(cells[0])+'. '+cellText(cells[1]),url:firstHref(row),keywords:'software install license download'};}),
...searchExtras];

// ---- Resource lists, routing and site search (data/resources.json) ----
function createResourceLink(r,search=false){
const a=document.createElement('a');a.className='resource-link';a.href=r.url;if(!r.url.startsWith('#')){a.target='_blank';a.rel='noopener noreferrer';}
const content=document.createElement('span');
if(search){const cat=document.createElement('span');cat.className='result-category';cat.textContent=r.category;content.append(cat);}
const title=document.createElement('span');title.className='resource-title';title.textContent=r.title;
const desc=document.createElement('span');desc.className='resource-desc';desc.textContent=r.desc;
content.append(title,desc);const arrow=document.createElement('span');arrow.className='arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent=r.url.startsWith('#')?'→':'↗';a.append(content,arrow);return a;
}
document.querySelectorAll('[data-groups]').forEach(container=>{
const list=resources.filter(r=>r.route===container.dataset.groups);const names=[...new Set(list.map(r=>r.group))];
names.forEach(name=>{const group=document.createElement('section');group.className='resource-group';const heading=document.createElement('h2');heading.textContent=name;const intro=document.createElement('p');intro.className='group-desc';intro.textContent=groupNotes[name];group.append(heading,intro);list.filter(r=>r.group===name).forEach(r=>group.append(createResourceLink(r)));container.append(group);});
});
archiveResources.forEach(r=>document.getElementById('archive-links').append(createResourceLink(r)));
const menu=document.getElementById('main-nav');const menuToggle=document.getElementById('menu-toggle');
menuToggle.addEventListener('click',()=>{const expanded=menuToggle.getAttribute('aria-expanded')==='true';menuToggle.setAttribute('aria-expanded',String(!expanded));menuToggle.textContent=expanded?'Menu +':'Close −';menu.classList.toggle('is-open',!expanded);});
function closeMenu(){menu.classList.remove('is-open');menuToggle.setAttribute('aria-expanded','false');menuToggle.textContent='Menu +';}
const knownRoutes=['home','research','teaching','careers','community'];
function route(){const hash=location.hash.slice(1)||'home';let name=hash;const toArchive=hash==='archive';const toPlacements=hash==='placements'||/^alumni-\d+$/.test(hash);const toPlan=hash==='plan'||hash==='program';const toCourse=hash==='coursework';if(toPlan)name='home';if(toCourse)name='research';if(toArchive)name='community';if(toPlacements)name='careers';if(name==='resources')name='home';if(!knownRoutes.includes(name))name='home';document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!=='view-'+name);menu.querySelectorAll('a').forEach(a=>{if(a.hash==='#'+name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});closeMenu();document.title=(name==='home'?'Northeastern Economics':menu.querySelector('[aria-current="page"]').textContent)+' · PhD Student Hub';if(toArchive){document.getElementById('archive').open=true;document.getElementById('archive').scrollIntoView({block:'start'});}else if(toPlacements){if(hash.startsWith('alumni-'))selectAlumnus(hash.slice(7));document.getElementById('placements').scrollIntoView({block:'start'});}else if(toPlan){document.getElementById('plan').scrollIntoView({block:'start'});}else if(toCourse){document.getElementById('rr-coursework').scrollIntoView({block:'start'});}else if(hash==='resources'){document.getElementById('resources').scrollIntoView({block:'start'});}else{window.scrollTo(0,0);}}
window.addEventListener('hashchange',route);document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&link.getAttribute('href')===location.hash&&(location.hash==='#placements'||/^#alumni-\d+$/.test(location.hash))){event.preventDefault();route();}});route();
document.querySelector('[data-scroll]').addEventListener('click',e=>{e.preventDefault();document.getElementById('resources').scrollIntoView({block:'start'});});
const search=document.getElementById('resource-search');const results=document.getElementById('search-results');const resultList=document.getElementById('results-list');
function updateSearch(){const query=normalizeDirectoryText(search.value).trim();const active=Boolean(query);results.hidden=!active;document.getElementById('home-resources').hidden=active;resultList.replaceChildren();if(!active){document.getElementById('search-status').textContent='';return;}const words=query.split(/\s+/);const found=[...resources,...archiveResources,...alumniSearchResources,...rrSearch].filter(r=>words.every(w=>normalizeDirectoryText(r.title+' '+r.desc+' '+r.category+' '+r.keywords).includes(w)));const seen=new Set();const unique=found.filter(r=>{const key=r.url+'|'+r.title;if(seen.has(key))return false;seen.add(key);return true;});document.getElementById('results-label').textContent=unique.length+' result'+(unique.length===1?'':'s')+' found';document.getElementById('search-status').textContent=unique.length+' matching resources or alumni';if(unique.length){unique.forEach(r=>resultList.append(createResourceLink(r,true)));}else{const empty=document.createElement('p');empty.className='empty-state';empty.textContent='No matching resource or alumnus. Try “exams”, “funding”, an employer or another name.';resultList.append(empty);}}
search.addEventListener('input',updateSearch);document.getElementById('search-form').addEventListener('submit',e=>{e.preventDefault();updateSearch();if(search.value.trim())results.scrollIntoView({block:'start'});});document.getElementById('clear-search').addEventListener('click',()=>{search.value='';updateSearch();search.focus();});

// ---- LaTeX templates (data/latex.json, latex/) ----
(function(){
const $=id=>document.getElementById(id);
let cur='slides',page=0;
function hl(s){const esc=s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return esc.split('\n').map(line=>{const m=line.match(/(^|[^\\])%/);let code=line,com='';if(m){const i=m.index+m[1].length;code=line.slice(0,i);com=line.slice(i);}code=code.replace(/(\\[a-zA-Z@]+)/g,'<span class="k">$1</span>').replace(/([{}\[\]])/g,'<span class="b">$1</span>');return code+(com?'<span class="c">'+com+'</span>':'');}).join('\n');}
function show(k){cur=k;page=0;const t=T[k];document.querySelectorAll('.tex-tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tpl===k)));$('tex-desc').textContent=t.desc;$('tex-file').textContent=t.file;$('tex-code').innerHTML=hl(t.src);$('tex-snip').value=encodeURIComponent(t.src);$('tex-snipname').value=t.file.replace('.tex','');$('tex-status').textContent='pdflatex · '+t.pages.length+(t.pages.length===1?' page':' pages')+' · no errors';document.querySelector('.tex-output').classList.toggle('tex-paper',k==='paper');const th=$('tex-thumbs');th.replaceChildren(...t.pages.map((src,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Page '+(i+1));const im=document.createElement('img');im.src=src;im.alt='';b.append(im);b.addEventListener('click',()=>go(i));return b;}));go(0);}
function go(i){const t=T[cur];page=Math.max(0,Math.min(t.pages.length-1,i));$('tex-page').src=t.pages[page];$('tex-page').alt=t.label+' — page '+(page+1)+' of compiled output';$('tex-count').textContent=(page+1)+' / '+t.pages.length;$('tex-prev').disabled=page===0;$('tex-next').disabled=page===t.pages.length-1;$('tex-thumbs').querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-current',String(j===page)));}
document.querySelectorAll('.tex-tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tpl)));
$('tex-prev').addEventListener('click',()=>go(page-1));$('tex-next').addEventListener('click',()=>go(page+1));
$('tex-copy').addEventListener('click',async()=>{const btn=$('tex-copy');try{await navigator.clipboard.writeText(T[cur].src);btn.textContent='Copied';}catch(e){const r=document.createRange();r.selectNodeContents($('tex-code'));const s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='Selected — press Ctrl/⌘+C';}setTimeout(()=>btn.textContent='Copy source',2200);});
show('slides');
})();

// ---- Research & Resources jump links ----
document.addEventListener("click",ev=>{const a=ev.target.closest("a[data-rr]");if(!a)return;ev.preventDefault();const t=document.querySelector(a.getAttribute("href"));if(t)t.scrollIntoView({block:"start",behavior:"smooth"});},true);
})();
