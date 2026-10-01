'use strict';
const $ = id => document.getElementById(id);
const nflEdition = window.MAP_EDITION === 'nfl';
// Curated representatives; only states without a base-roster team are eligible.
const fcsTeams = (nflEdition ? [] : [
  ['311','Maine','Black Bears','ME','ME','Orono',44.9044,-68.6686,'#003263'],
  ['160','New Hampshire','Wildcats','UNH','NH','Durham',43.1346,-70.9345,'#003591'],
  ['227','Rhode Island','Rams','URI','RI','Kingston',41.4845,-71.5369,'#68abe8'],
  ['2571','South Dakota State','Jackrabbits','SDST','SD','Brookings',44.322,-96.783,'#0033a0'],
  ['149','Montana','Grizzlies','MONT','MT','Missoula',46.8597,-113.9826,'#6a0032'],
  ['147','Montana State','Bobcats','MTST','MT','Bozeman',45.6589,-111.05,'#003875']
]).map(([id,name,mascot,abbr,state,city,lat,lon,color])=>({id,name,fullName:`${name} ${mascot}`,abbr,state,city,lat,lon,color,logo:`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`}))
  .filter(t=>!window.TEAMS.some(base=>base.state===t.state));
const allTeams = [...window.TEAMS,...fcsTeams].sort((a,b)=>a.name.localeCompare(b.name));
const byId = Object.fromEntries(allTeams.map(t => [t.id,t]));
const STORAGE = nflEdition ? 'sunday-empire-nfl-v2' : 'saturday-empire-2026-v1';
const testMode = new URLSearchParams(location.search).has('test');
let storageAvailable = true, savedCampaign = null;
try { if(!testMode)savedCampaign=JSON.parse(localStorage.getItem(STORAGE)); } catch { storageAvailable=false; }
let includeFcs = !nflEdition && savedCampaign?.includeFcs === true;
const teams = allTeams.filter(t=>includeFcs||!fcsTeams.includes(t));
let state = Empire.fresh(teams), attacker = null, defender = null, busy = false, lastRay = null, arrowPose = null;

const svg = d3.select('#map'), defs = svg.append('defs'), viewport = svg.append('g');
const mainlandProjection = d3.geoAlbers().scale(1240).translate([530,310]);
const hawaiiProjection = d3.geoConicEqualArea().rotate([157,0]).center([-3,19.9]).parallels([8,18]).scale(800).translate([70,490]);
const projection = point => (point[1]<25&&point[0]<-130?hawaiiProjection:mainlandProjection)(point);
const featureProjection = feature => +feature.id===15?hawaiiProjection:mainlandProjection;
const path = feature => d3.geoPath(featureProjection(feature))(feature);
path.bounds = feature => d3.geoPath(featureProjection(feature)).bounds(feature);
const states = topojson.feature(US_MAP, US_MAP.objects.states).features.filter(s => +s.id < 60 && +s.id !== 2);
const stateCodes = {'01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'};
const teamsInState = code => teams.filter(t => (t.territoryStates || [t.state]).includes(code));
const neutralIds = [];
function updateNeutralIds(){neutralIds.splice(0,neutralIds.length,...states.filter(feature=>!teamsInState(stateCodes[String(feature.id).padStart(2,'0')]).length).map(feature=>'state:'+stateCodes[String(feature.id).padStart(2,'0')]));}
updateNeutralIds();
const newCampaign = () => ({...Empire.fresh(teams,neutralIds),...(!nflEdition?{includeFcs}:{})});
state = newCampaign();
state=Empire.loadCampaign(savedCampaign,teams,neutralIds)||state;
const activeCells = () => cells;
allTeams.forEach(t => { t.point = projection([t.lon,t.lat]); if (!t.point) throw new Error(`Cannot project ${t.name}`); });
const cells = [];
const territoryLayer = viewport.append('g').attr('class','territories');
const regionCache = new Map();
let ownershipKey = null;
function projectedGeometry(feature) {
  const polygons = []; let polygon, ring;
  d3.geoStream(feature,featureProjection(feature).stream({
    polygonStart(){polygon=[];},polygonEnd(){polygons.push(polygon);},
    lineStart(){ring=[];},lineEnd(){if(ring.length>2){ring.push([...ring[0]]);polygon.push(ring);}},
    point(x,y){ring.push([Math.round(x*1e6)/1e6,Math.round(y*1e6)/1e6]);}
  }));
  return polygons;
}
function polygonPath(geometry) {
  return geometry.flatMap(polygon=>polygon.map(ring=>'M'+ring.map(point=>point.join(',')).join('L')+'Z')).join('');
}
function projectedRings(feature) {
  const rings = []; let ring;
  d3.geoStream(feature,featureProjection(feature).stream({polygonStart(){},polygonEnd(){},lineStart(){ring=[];},lineEnd(){if(ring.length>2) rings.push(ring);},point(x,y){ring.push([x,y]);}}));
  return rings;
}
// Both cells sharing an edge use the same wave, so borders never leave gaps.
function softenCell(polygon,candidates){
  const result=[];
  for(let i=0;i<polygon.length-1;i++){
    let a=polygon[i].map(v=>Math.round(v*1e6)/1e6),b=polygon[i+1].map(v=>Math.round(v*1e6)/1e6);
    const reversed=a[0]>b[0]||(a[0]===b[0]&&a[1]>b[1]);if(reversed)[a,b]=[b,a];
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
    const clearance=Math.min(...candidates.map(t=>{const u=Math.max(0,Math.min(1,((t.point[0]-a[0])*dx+(t.point[1]-a[1])*dy)/(length*length)));return Math.hypot(t.point[0]-a[0]-u*dx,t.point[1]-a[1]-u*dy);}));
    const amplitude=Math.min(3,length*.045,clearance*.2),steps=Math.max(2,Math.ceil(length/5)),edge=[];
    for(let j=0;j<=steps;j++){const t=j/steps,wave=amplitude*Math.sin(Math.PI*t)*Math.sin(2*Math.PI*t*(1+Math.floor(length/75)));
      edge.push([a[0]+dx*t-dy/length*wave,a[1]+dy*t+dx/length*wave].map(v=>Math.round(v*1e6)/1e6));}
    if(reversed)edge.reverse();result.push(...edge.slice(0,-1));
  }
  result.push([...result[0]]);return result;
}
function buildCells(){
cells.length=0;
for (const feature of states) {
  const code = stateCodes[String(feature.id).padStart(2,'0')];
  const local = teamsInState(code);
  if (!local.length) {
    cells.push({id:'state:'+code,state:code,name:feature.properties.name,polygon:[[0,0],[1060,0],[1060,650],[0,650]],rings:projectedRings(feature),geometry:projectedGeometry(feature)});
    continue;
  }
  const candidates = local;
  const rings = projectedRings(feature);
  const stateGeometry = projectedGeometry(feature);
  const voronoi = d3.Delaunay.from(candidates.map(t => t.point)).voronoi([0,0,1060,650]);
  candidates.forEach((team,i) => {
    let polygon = candidates.length === 1 ? [[0,0],[1060,0],[1060,650],[0,650]] : voronoi.cellPolygon(i);
    if (!polygon) return;
    if(candidates.length>1)polygon=softenCell(polygon,candidates);
    // Reject cells whose bounding boxes cannot meet this state.
    const bounds = path.bounds(feature);
    const xs = polygon.map(p=>p[0]), ys = polygon.map(p=>p[1]);
    if (Math.max(...xs)<bounds[0][0] || Math.min(...xs)>bounds[1][0] || Math.max(...ys)<bounds[0][1] || Math.min(...ys)>bounds[1][1]) return;
    const geometry = polygonClipping.intersection([polygon],stateGeometry);
    if (!geometry.length) return;
    const cell = {id:team.id,polygon,rings,state:code,geometry}; cells.push(cell);
  });
}
// Concave outlines can isolate fragments in CFB Oklahoma and NFL Florida.
// Give detached pieces to a touching in-state territory, preserving all land.
const repairedCells=cells.filter(cell=>cell.state===(nflEdition?'FL':'OK')&&byId[cell.id]);
for(const cell of repairedCells){
  for(const piece of [...cell.geometry]){
    if(Empire.inRings(byId[cell.id].point,piece))continue;
    for(const neighbor of repairedCells){
      if(neighbor===cell)continue;
      const joined=polygonClipping.union(neighbor.geometry,[piece]);
      if(joined.length<neighbor.geometry.length+1){
        cell.geometry=cell.geometry.filter(p=>p!==piece);neighbor.geometry=joined;break;
      }
    }
  }
}
for(const cell of repairedCells){
  cell.stateRings=cell.rings;cell.rings=cell.geometry.flat();
  cell.polygon=[[0,0],[1060,0],[1060,650],[0,650]];
}
// A multi-state NFL starting territory remains one ownership unit.
if(nflEdition){
  const merged=[...d3.group(cells,cell=>cell.id)].map(([id,parts])=>{
    if(parts.length===1)return parts[0];
    const geometry=polygonClipping.union(...parts.map(cell=>cell.geometry));
    return {id,geometry,rings:geometry.flat(),polygon:[[0,0],[1060,0],[1060,650],[0,650]]};
  });
  cells.splice(0,cells.length,...merged);
}
}
buildCells();
const stateLines = viewport.append('g').attr('class','state-lines');
stateLines.selectAll('path').data(states).join('path').attr('d',path).attr('class','state-line');
const STATE_LINES_STORAGE = STORAGE + '-state-lines';
try { if(!testMode)$('show-state-lines').checked=localStorage.getItem(STATE_LINES_STORAGE)!=='false'; } catch {}
function updateStateLines(){stateLines.style('display',$('show-state-lines').checked?null:'none');}
updateStateLines();
$('show-state-lines').onchange=()=>{
  updateStateLines();
  try { if(!testMode)localStorage.setItem(STATE_LINES_STORAGE,String($('show-state-lines').checked)); } catch {}
};
const TERRITORY_RANKS_STORAGE = STORAGE + '-territory-ranks';
if(!nflEdition){
try { if(!testMode)$('show-territory-ranks').checked=localStorage.getItem(TERRITORY_RANKS_STORAGE)!=='false'; } catch {}
function updateTerritoryRanks(){document.body.classList.toggle('hide-territory-ranks',!$('show-territory-ranks').checked);}
updateTerritoryRanks();
$('show-territory-ranks').onchange=()=>{
  updateTerritoryRanks();
  try { if(!testMode)localStorage.setItem(TERRITORY_RANKS_STORAGE,String($('show-territory-ranks').checked)); } catch {}
};
}
function renderTerritories() {
  const key = JSON.stringify(state.owners);
  if (key === ownershipKey) return;
  ownershipKey = key;
  const visibleCells=activeCells();
  const unclaimed=visibleCells.filter(cell=>state.owners[cell.id]===null);
  territoryLayer.selectAll('.unclaimed-state').data(unclaimed,d=>d.id).join('path').attr('class','unclaimed-state').attr('d',d=>polygonPath(d.geometry)).attr('fill','#c5c9c7').attr('fill-rule','evenodd')
    .attr('stroke','#c5c9c7').attr('stroke-width',1.2).attr('stroke-linejoin','round').attr('vector-effect','non-scaling-stroke')
    .on('pointermove',(event,d)=>tooltip(event,`${d.name} · Unclaimed`)).on('pointerleave',hideTooltip);
  const groups = d3.group(visibleCells.filter(cell=>state.owners[cell.id]!==null),cell=>state.owners[cell.id]);
  const regions = [...groups].map(([id,owned])=>{
    const signature = owned.map(cell=>cell.id).sort().join(',');
    let geometry = regionCache.get(signature);
    if (!geometry) {
      geometry = owned.length===1 ? owned[0].geometry : polygonClipping.union(...owned.map(cell=>cell.geometry));
      regionCache.set(signature,geometry);
    }
    return {id,geometry};
  });
  territoryLayer.selectAll('.territory').data(regions,d=>d.id).join('path').attr('class','territory')
    .attr('fill-rule','evenodd').attr('d',d=>polygonPath(d.geometry)).attr('fill',d=>color(d.id))
    .attr('stroke',d=>color(d.id)).attr('stroke-width',1.2).attr('stroke-linejoin','round').attr('vector-effect','non-scaling-stroke')
    .on('click',(event,d)=>{event.stopPropagation();choose(d.id);})
    .on('pointermove',(event,d)=>tooltip(event,byId[d.id].name)).on('pointerleave',hideTooltip);
}
// Keep selection above territory fills.
// Generate the glow from the filled union, then remove its interior so team
// colors remain visible and the shared matchup edge never casts a shadow.
const selectionGlow = defs.append('filter').attr('id','selection-glow')
  .attr('x','-25%').attr('y','-25%').attr('width','150%').attr('height','150%')
  .attr('color-interpolation-filters','sRGB');
selectionGlow.append('feGaussianBlur').attr('in','SourceAlpha').attr('stdDeviation',2);
selectionGlow.append('feOffset').attr('dy',2);
selectionGlow.append('feComposite').attr('in2','SourceAlpha').attr('operator','out').attr('result','halo');
selectionGlow.append('feFlood').attr('flood-color','#fff');
selectionGlow.append('feComposite').attr('in2','halo').attr('operator','in');
const selectionLayer = viewport.append('g').attr('class','territory-selection').attr('pointer-events','none');
let selectionKey = null;
function renderSelection(){
  const selected=territoryLayer.selectAll('.territory').filter('.selected').data();
  const key=JSON.stringify([ownershipKey,selected.map(t=>t.id).sort()]);
  if(key===selectionKey)return;
  selectionKey=key;
  const geometry=selected.length?polygonClipping.union(...selected.map(t=>t.geometry)):null;
  const effects=selectionLayer.selectAll('g').data(geometry?[{key,geometry}]:[],d=>d.key);
  const exiting=effects.exit().interrupt();
  if(reduced())exiting.remove();
  else exiting.transition().duration(240).style('opacity',0).remove();
  const entering=effects.enter().append('g').style('opacity',0);
  entering.append('path').attr('class','selection-glow');
  entering.append('path').attr('class','selection-outline');
  entering.selectAll('path').attr('d',d=>polygonPath(d.geometry)).attr('fill-rule','evenodd');
  const active=entering.merge(effects).interrupt();
  if(reduced())active.style('opacity',1);
  else active.transition().duration(240).style('opacity',1);
}
const arrow = viewport.append('g').attr('pointer-events','none');
const markerLayer = svg.append('g').attr('class','markers');
const markers = markerLayer.selectAll('g').data(allTeams).join('g').attr('class','team-marker').attr('role','button').attr('tabindex',0).attr('aria-label',t=>`Select ${t.name}`)
  .on('click',(event,t)=>{event.stopPropagation();choose(t.id);})
  .on('keydown',(event,t)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(t.id);}})
  .on('pointermove',(event,t)=>tooltip(event,[t.fullName||t.name,[t.city,t.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '))).on('pointerleave',hideTooltip);
if(!nflEdition)markers.append('circle').attr('r',12);
const logoSize=nflEdition?24:18;
markers.append('image').attr('href',t=>t.logo).attr('x',-logoSize/2).attr('y',-logoSize/2).attr('width',logoSize).attr('height',logoSize).on('error',function(){d3.select(this).remove();});
if(nflEdition)markers.select('image').style('pointer-events','all');
// Lay out badges in screen units, leaving hometown coordinates and attack rays untouched.
let markerLayout = null;
function panMarkers(transform){markerLayer.attr('transform',`translate(${transform.x},${transform.y})`);}
function layoutMarkers(){
  const transform=d3.zoomTransform(svg.node()),matrix=svg.node().getScreenCTM();
  if(!matrix)return;
  const scale=Math.hypot(matrix.a,matrix.b);
  if(!scale)return;
  panMarkers(transform);
  const alive=new Set(Empire.survivors(state)),aliveKey=[...alive].sort().join(',');
  if(markerLayout&&markerLayout.k===transform.k&&markerLayout.scale===scale&&markerLayout.aliveKey===aliveKey)return;
  const badgeRadius=Math.min(nflEdition?26:15,Math.sqrt(1060*650/teams.length)*scale/2.9);
  const gap=(badgeRadius*2+5)/scale;
  const maxOffset=(transform.k<2?badgeRadius*.75:badgeRadius*1.5)/scale;
  const placed=[],positions=new Map();
  // Translation belongs to the parent layer; collision spacing only depends on zoom.
  const candidates=teams.filter(t=>alive.has(t.id)).map(t=>({id:t.id,anchor:t.point.map(value=>value*transform.k)}))
    .sort((a,b)=>a.anchor[1]-b.anchor[1]||a.anchor[0]-b.anchor[0]||a.id.localeCompare(b.id));
  for(const candidate of candidates){
    const [ax,ay]=candidate.anchor;
    let position,bestPosition,bestScore=Infinity;
    for(let ring=0;!position&&ring<=4;ring++){
      const distance=ring*maxOffset/4,steps=ring?ring*12:1;
      for(let step=0;step<steps;step++){
        const angle=step/steps*Math.PI*2;
        const x=ax+Math.cos(angle)*distance,y=ay+Math.sin(angle)*distance;
        const overlap=placed.reduce((sum,p)=>sum+Math.pow(Math.max(0,gap-Math.hypot(x-p.x,y-p.y)),2),0);
        const score=overlap+distance*distance*.15;
        if(score<bestScore){bestScore=score;bestPosition={...candidate,x,y};}
        if(!overlap){
          position={...candidate,x,y};break;
        }
      }
    }
    if(!position)position=bestPosition||{...candidate,x:ax,y:ay};
    placed.push(position);positions.set(candidate.id,position);
  }
  markers.style('display',t=>positions.has(t.id)?null:'none').attr('transform',t=>{
    const p=positions.get(t.id);return p?`translate(${p.x},${p.y}) scale(${badgeRadius/12/scale})`:null;
  });
  markerLayout={k:transform.k,scale,aliveKey};
}
const zoom = d3.zoom().scaleExtent([1,9]).translateExtent([[0,0],[1060,650]]).on('zoom',event=> {
  viewport.attr('transform',event.transform);
  const scaleChanged=markerLayout?.k!==event.transform.k;
  if(scaleChanged)layoutMarkers();else panMarkers(event.transform);
  if(arrowPose&&scaleChanged)drawArrow(arrowPose.angle,arrowPose.length);
  hideTooltip();
});
svg.call(zoom).on('dblclick.zoom',null);
new ResizeObserver(()=>{layoutMarkers();if(arrowPose)drawArrow(arrowPose.angle,arrowPose.length);}).observe(svg.node());
svg.on('wheel.prevent-scroll',event=>event.preventDefault(),{passive:false});
svg.on('click.clear-selection',event=>{if(event.target===svg.node()&&!busy)clear();});
function tooltip(event,text){const bounds=$('map').getBoundingClientRect();$('tooltip').textContent=text;$('tooltip').style.display='block';$('tooltip').style.left=Math.max(5,Math.min(event.clientX-bounds.left+12,bounds.width-240))+'px';$('tooltip').style.top=Math.max(5,event.clientY-bounds.top-42)+'px';}
function hideTooltip(){$('tooltip').style.display='none';}
function save(){if(!nflEdition)state.includeFcs=includeFcs;if(testMode)return;try{localStorage.setItem(STORAGE,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;}}
function color(id){return byId[id].color||'#64734c';}
let noticeTimer,milestoneTimer;
function clearMilestone(){clearTimeout(milestoneTimer);$('milestone').hidden=true;$('milestone-message').textContent='';}
$('close-milestone').onclick=()=>{clearMilestone();render();$('random').focus({preventScroll:true});};
function announceMilestone(remaining){
  clearMilestone();
  if(![100,75,50,25,10,5].includes(remaining))return;
  $('milestone-message').textContent=`${remaining} teams remaining`;
  $('milestone').hidden=false;
  milestoneTimer=setTimeout(clearMilestone,3000);
}
function notice(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=!message;if(message)noticeTimer=setTimeout(()=>$('notice').hidden=true,4500);}
// Measure final clipped cells, subtracting polygon holes.
let cellAreas;
function updateCellAreas(){cellAreas=new Map(cells.map(cell=>[cell.id,cell.geometry.reduce((sum,p)=>sum+Math.abs(d3.polygonArea(p[0]))-p.slice(1).reduce((holes,r)=>holes+Math.abs(d3.polygonArea(r)),0),0)]));}
updateCellAreas();
let awardTerritories=null,awardCacheKey=null,awardCache=null,awardToastTimer;
function campaignAwards(){
  if(nflEdition)return {};
  if(!awardTerritories){
    // Unshared topology arcs form the national perimeter, excluding state borders.
    const geometries=US_MAP.objects.states.geometries,uses=new Map();
    for(const g of geometries)for(const a of g.arcs.flat(Infinity)){const key=a<0?~a:a;uses.set(key,(uses.get(key)||0)+1);}
    const coastPoints={};
    for(const g of geometries){
      const code=stateCodes[String(g.id).padStart(2,'0')];
      const west=['CA','OR','WA'].includes(code),east=['ME','NH','MA','RI','CT','NY','NJ','DE','MD','VA','NC','SC','GA','FL'].includes(code);
      if(!west&&!east)continue;
      coastPoints[code]=[];
      for(const a of g.arcs.flat(Infinity)){
        if(uses.get(a<0?~a:a)!==1)continue;
        const line=topojson.feature(US_MAP,{type:'LineString',arcs:[a]}).geometry.coordinates;
        for(let i=1;i<line.length;i++){
          const p=[(line[i-1][0]+line[i][0])/2,(line[i-1][1]+line[i][1])/2];
          // Remove international land borders, Great Lakes and Florida's Gulf shore.
          if(west&&(p[1]>=48.5||p[1]<=32.54))continue;
          if(east&&(p[1]>=45||(code==='NY'&&p[0]<-73.9)||(code==='FL'&&p[0]<(p[1]>28?-81.6:-80.85))))continue;
          coastPoints[code].push(projection(p));
        }
      }
    }
    awardTerritories=cells.map(c=>({id:c.id,state:c.state,area:cellAreas.get(c.id),coasts:(coastPoints[c.state]||[]).some(p=>Empire.inside(p,c.polygon))?[['CA','OR','WA'].includes(c.state)?'west':'east']:[]}));
  }
  const key=JSON.stringify([teams.map(t=>t.id),state.history]);
  if(key!==awardCacheKey){awardCacheKey=key;awardCache=EmpireAwards.evaluate(state,teams,awardTerritories);}
  return awardCache;
}
function awardBadges(id){
  const list=document.createElement('span');list.className='team-awards';
  const catalog=new Map(EmpireAwards.catalog(teams).map(a=>[a.id,a]));
  for(const rivalry of [false,true]){
    const awards=(campaignAwards()[id]||[]).filter(a=>isRivalryAward(a)===rivalry);if(!awards.length)continue;
    for(const award of awards){
      const badge=document.createElement('span');badge.className='award-badge'+(rivalry?' rivalry-badge':'');
      badge.append(awardIcon(rivalry),document.createTextNode(catalog.get(award.id).name));
      badge.title=rivalry
        ?'Defeated '+catalog.get(award.id).teams.filter(team=>team!==id).map(team=>byId[team].name).join(', ')
        :catalog.get(award.id).description;
      list.append(badge);
    }
  }
  return list;
}
function isRivalryAward(award){return award.id.startsWith('rivalry:');}
function awardIcon(rivalry){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('award-icon');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',rivalry?'M5 21V3m0 1c5-4 9 4 14 0v9c-5 4-9-4-14 0':'M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4v3h-4z');
  svg.append(path);return svg;
}
function renderAwards(){
  const earned=campaignAwards(),list=$('awards-list');list.replaceChildren();
  const hasAward=award=>teams.some(t=>earned[t.id].some(a=>a.id===award.id));
  const catalog=EmpireAwards.catalog(teams).sort((a,b)=>Number(hasAward(b))-Number(hasAward(a)));
  for(const rivalry of [false,true]){
    const heading=document.createElement('h2');heading.className='award-group-title';heading.textContent=rivalry?'Rivalry wins':'Campaign awards';list.append(heading);
    for(const award of catalog.filter(a=>isRivalryAward(a)===rivalry)){
    const holders=teams.filter(t=>earned[t.id].some(a=>a.id===award.id));
    const row=document.createElement('section');row.className='award-item'+(holders.length?' earned':'')+(rivalry?' rivalry-item':'');
    const title=document.createElement('h3');title.append(awardIcon(rivalry),document.createTextNode(award.name));
    const description=document.createElement('p');description.textContent=award.description;
    const winners=document.createElement('p');winners.className='award-holders';winners.textContent=holders.length?holders.map(t=>{const a=earned[t.id].find(a=>a.id===award.id);return t.name+' · '+(a.round?'Round '+a.round:'Starting map');}).join(' • '):'Not earned yet';
    row.append(title,description,winners);list.append(row);
    }
  }
}
function announceAwards(before){
  if(nflEdition)return;
  const catalog=new Map(EmpireAwards.catalog(teams).map(a=>[a.id,a.name])),cards=[];
  for(const [id,awards] of Object.entries(campaignAwards())){
    for(const rivalry of [false,true]){
    const fresh=awards.filter(a=>isRivalryAward(a)===rivalry&&!before[id].some(old=>old.id===a.id));if(!fresh.length)continue;
    const card=document.createElement('div');card.className='award-announcement';
    const logo=document.createElement('img');logo.src=byId[id].logo;logo.alt='';
    const name=document.createElement('strong');name.textContent=byId[id].name;
    const label=document.createElement('small');label.textContent=rivalry?'Rivalry won':'Award won';card.append(logo,name,label);
    for(const award of fresh){const line=document.createElement('span');line.className='announcement-award'+(isRivalryAward(award)?' rivalry-badge':'');line.append(awardIcon(isRivalryAward(award)),document.createTextNode(catalog.get(award.id)));card.append(line);}
    cards.push(card);
    }
  }
  if(!cards.length)return;
  clearTimeout(awardToastTimer);$('award-toast').replaceChildren(...cards);$('award-toast').hidden=false;
  awardToastTimer=setTimeout(()=>$('award-toast').hidden=true,7000);
}
function clearAwardToast(){if(nflEdition)return;clearTimeout(awardToastTimer);$('award-toast').hidden=true;}
function teamStats(){
  const stats=Object.fromEntries(teams.map(t=>[t.id,{wins:0,area:0,rank:null}]));
  for(const entry of state.history)if(entry.loser!==null)stats[entry.winner].wins++;
  for(const cell of cells){const owner=state.owners[cell.id];if(owner)stats[owner].area+=cellAreas.get(cell.id);}
  if(!nflEdition)Empire.survivors(state).sort((a,b)=>stats[b].area-stats[a].area||byId[a].name.localeCompare(byId[b].name)).slice(0,25).forEach((id,i)=>stats[id].rank=i+1);
  return stats;
}
let leaderboardTab='size';
function renderLeaderboard(){
  const stats=teamStats(),byWins=leaderboardTab==='wins';
  const ids=byWins?teams.map(t=>t.id).filter(id=>stats[id].wins>0):Empire.survivors(state);
  ids.sort((a,b)=>stats[b][byWins?'wins':'area']-stats[a][byWins?'wins':'area']||byId[a].name.localeCompare(byId[b].name));
  const panel=$('leaderboard-panel');panel.replaceChildren();
  for(const tab of ['size','wins']){
    const selected=tab===leaderboardTab;
    $(tab+'-tab').setAttribute('aria-selected',String(selected));
    $(tab+'-tab').tabIndex=selected?0:-1;
  }
  panel.setAttribute('aria-labelledby',leaderboardTab+'-tab');
  if(!ids.length){const empty=document.createElement('p');empty.className='leaderboard-empty';empty.textContent='No wins yet. Teams appear after their first win.';panel.append(empty);return;}
  const totalArea=Object.values(stats).reduce((sum,t)=>sum+t.area,0);
  if(!byWins){const description=document.createElement('p');description.className='leaderboard-description';description.textContent='Current territory, as a share of all claimed land.';panel.append(description);}
  const list=document.createElement('ol');list.className='leaderboard-list';
  for(const [index,id] of (byWins?ids:ids.slice(0,25)).entries()){
    const row=document.createElement('li');
    const rank=document.createElement('span');rank.className='leaderboard-rank';rank.textContent=String(index+1);
    const logo=document.createElement('img');logo.src=byId[id].logo;logo.alt='';
    const name=document.createElement('span');name.className='leaderboard-name';name.textContent=byId[id].name;
    const value=document.createElement('strong');value.textContent=byWins?`${stats[id].wins} ${stats[id].wins===1?'win':'wins'}`:`${(totalArea?stats[id].area/totalArea*100:0).toFixed(2)}%`;
    row.append(rank,logo,name,value);list.append(row);
  }
  panel.append(list);panel.scrollTop=0;
}
function teamContent(id,role){
  const t=byId[id],stats=teamStats()[id],fragment=document.createDocumentFragment();
  const img=document.createElement('img');img.src=t.logo;img.alt=t.name;
  const name=document.createElement('strong');
  if(stats.rank){const rank=document.createElement('span');rank.className='territory-rank';rank.textContent=`#${stats.rank} `;rank.title=`#${stats.rank} by current territory area`;rank.setAttribute('aria-label',`Territory rank ${stats.rank}: `);name.append(rank);}
  name.append(t.name);
  const wins=document.createElement('span');wins.className='team-wins';wins.textContent=`${stats.wins} ${stats.wins===1?'win':'wins'}`;
  fragment.append(img,name,wins);
  if(!nflEdition)fragment.append(awardBadges(id));
  if(role){const label=document.createElement('small');label.textContent=role;fragment.append(label);}
  return fragment;
}
function hideArrow(){arrowPose=null;arrow.selectAll('*').remove();}
function drawArrow(angle,length=32){
  arrow.selectAll('*').remove();if(!attacker)return;
  arrowPose={angle,length};
  const [x,y]=byId[attacker].point,k=d3.zoomTransform(svg.node()).k,matrix=svg.node().getScreenCTM();
  // Keep the arrow visible beyond even a displaced logo badge, at every zoom and viewport size.
  length=Math.max(length,(nflEdition?78:48)/(k*Math.hypot(matrix.a,matrix.b)));
  const head=Math.min(length*.45,12/k),shaft=1.7/k;
  const points=[[0,-shaft],[length-head,-shaft],[length-head,-5/k],[length,0],[length-head,5/k],[length-head,shaft],[0,shaft]];
  arrow.append('path').attr('class','attack-arrow').attr('d','M'+points.map(p=>p.join(',')).join('L')+'Z').attr('transform',`translate(${x},${y}) rotate(${angle*180/Math.PI})`);
}
function focusPoints(points,maxScale=3){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const k=Math.max(1,Math.min(maxScale,780/(Math.max(...xs)-Math.min(...xs)+120),420/(Math.max(...ys)-Math.min(...ys)+120)));
  const target=d3.zoomIdentity.translate(530-k*cx,310-k*cy).scale(k);
  moveCamera(target);
}
function moveCamera(target){
  svg.interrupt();if(reduced())svg.call(zoom.transform,target);else svg.transition().duration(650).call(zoom.transform,target);
}
function focusTerritory(...ids){
  // Use clipped, currently owned land, including detached captures and claimed states.
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const cell of activeCells()){
    if(!ids.includes(state.owners[cell.id]))continue;
    for(const polygon of cell.geometry)for(const ring of polygon)for(const [x,y] of ring){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  if(!Number.isFinite(left)){focusPoints(ids.map(id=>byId[id].point));return;}
  // Keep some neighboring land for a single team; frame matchups more tightly.
  const [minScale,maxScale]=zoom.scaleExtent();
  const width=ids.length>1?860:740,height=ids.length>1?500:440;
  const k=Math.max(minScale,Math.min(maxScale,width/Math.max(1,right-left),height/Math.max(1,bottom-top)));
  moveCamera(d3.zoomIdentity.translate(530-k*(left+right)/2,310-k*(top+bottom)/2).scale(k));
}
let dialogKey=null;
let previewKey=null;
function renderMatchup(){
  const key=attacker?`${attacker}:${defender||''}:${state.history.length}:${busy}`:null;
  $('draw-preview').hidden=!key;
  if(key===previewKey)return;previewKey=key;$('draw-preview').replaceChildren();
  if(!key)return;
  if(!nflEdition&&Empire.survivors(state).length===2&&defender){
    const heading=document.createElement('div');heading.className='championship-heading';heading.textContent='National Championship';$('draw-preview').append(heading);
  }
  for(const [id,role] of [[attacker,'ATTACKER'],[defender,'DEFENDER']]){
    if(!id)continue;
    if(role==='DEFENDER'){const vs=document.createElement('span');vs.className='preview-vs';vs.textContent='VS';$('draw-preview').append(vs);}
    const card=document.createElement(defender?'button':'div');card.className='preview-team';
    if(defender){card.type='button';card.disabled=busy;card.setAttribute('aria-label',`${byId[id].name} wins`);card.onclick=()=>win(id);}
    card.append(teamContent(id,defender?'Select Winner':''));$('draw-preview').append(card);
  }
}
function render(){
  if(!nflEdition){$('fcs-option').hidden=state.history.length>0;$('include-fcs').checked=includeFcs;$('include-fcs').disabled=busy;}
  const alive=Empire.survivors(state),finished=alive.length===1;
  document.body.classList.toggle('championship-mode',!nflEdition&&alive.length<=2);
  $('draw-preview').classList.toggle('championship-matchup',!nflEdition&&alive.length===2&&!!defender);
  renderTerritories();
  territoryLayer.classed('matchup-selected',!!attacker&&!!defender);
  territoryLayer.selectAll('.territory').classed('selected',t=>t.id===attacker||t.id===defender)
    .filter('.selected').raise();
  renderSelection();
  markers.style('display',t=>alive.includes(t.id)?null:'none').classed('selected',t=>t.id===attacker||t.id===defender);
  layoutMarkers();
  renderMatchup();
  $('random').disabled=busy;
  $('settings').disabled=busy;
  $('leaderboard').disabled=busy;
  if(!nflEdition)$('awards').disabled=busy;
  if($('leaderboard-dialog').open)renderLeaderboard();
  $('random').hidden=!!defender&&!busy;
  $('random').textContent=finished?'Start a new campaign':busy?(attacker?'Spinning direction…':'Picking a team…'):attacker?'Spin the direction':'Pick a random team';
  const nextKey=finished&&!busy?`champion:${alive[0]}`:null;
  if(nextKey!==dialogKey){
    dialogKey=nextKey;$('winner-buttons').replaceChildren();
    if(nextKey){
      hideTooltip();$('round-label').textContent=nflEdition?'LAST TEAM STANDING':'National Championship';
      $('winner-title').textContent=nflEdition?byId[alive[0]].name:'National Champions';
      $('winner-description').textContent='One team holds every claimed territory.';
      const champion=document.createElement('div');champion.className='champion';
      if(nflEdition)champion.append(teamContent(alive[0]));
      else{
        const logo=document.createElement('img');logo.src=byId[alive[0]].logo;logo.alt=byId[alive[0]].name+' logo';
        const name=document.createElement('strong');name.textContent=byId[alive[0]].name;champion.append(logo,name);
      }
      $('winner-buttons').append(champion);
      $('close-winner').setAttribute('aria-label',finished?'Close champion announcement':'Cancel this matchup');
      if(!$('winner-dialog').open)$('winner-dialog').showModal();
    }else if($('winner-dialog').open)$('winner-dialog').close();
  }
}
function choose(id){
  if(busy||(nflEdition&&Empire.survivors(state).length===1)||!Empire.survivors(state).includes(id))return;
  if(id===attacker){clear();return;}
  if(id===defender){defender=null;lastRay=null;hideArrow();notice('');focusTerritory(attacker);render();return;}
  if(defender)return;
  if(!attacker){attacker=id;notice('');focusTerritory(id);}
  else{defender=id;lastRay=null;hideArrow();notice('');focusTerritory(attacker,id);}
  render();
}
function clear(){svg.interrupt();attacker=null;defender=null;lastRay=null;hideArrow();notice('');render();}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(duration,frame){return new Promise(resolve=>{if(reduced()){frame(1);resolve();return;}const start=performance.now();function tick(now){
  // A frame's shared timestamp can precede the time this animation was started.
  const progress=Math.max(0,Math.min(1,(now-start)/duration));
  frame(progress);if(progress<1)requestAnimationFrame(tick);else resolve();
}requestAnimationFrame(tick);});}
function animateCapture(winner,captured,oldColor,origin){
  clearMilestone();
  const geometry=activeCells().filter(cell=>captured.includes(cell.id)).flatMap(cell=>cell.geometry);
  const finish=()=>{busy=false;clear();};
  busy=true;hideArrow();$('winner-dialog').close();render();$('random').textContent='Claiming territory…';
  if(reduced()||!geometry.length){finish();return Promise.resolve();}
  const layer=viewport.insert('g','.state-lines').attr('class','capture-animation').attr('pointer-events','none');
  // Erase the old fill to expose the already-merged winner underneath. There is
  // no old-color stroke or separate winner patch to leave a seam behind.
  const mask=defs.append('mask').attr('id','capture-reveal').attr('maskUnits','userSpaceOnUse').attr('x',0).attr('y',0).attr('width',1060).attr('height',650).attr('mask-type','luminance');
  mask.append('rect').attr('width',1060).attr('height',650).attr('fill','white');
  const front=mask.append('path').attr('fill','black').attr('d',`M${origin[0]},${origin[1]}Z`);
  layer.append('path').attr('d',polygonPath(geometry)).attr('fill-rule','evenodd').attr('fill',oldColor).attr('stroke','none').attr('mask','url(#capture-reveal)');
  const radius=Math.max(...geometry.flat(2).map(p=>Math.hypot(p[0]-origin[0],p[1]-origin[1])))+2;
  const phase=[winner,...captured].join(':').split('').reduce((sum,c)=>sum+c.charCodeAt(0),0)*.17;
  const distances=Array(96).fill(0),curve=d3.line().curve(d3.curveCatmullRomClosed.alpha(.5));
  return animate(1800,p=>{
    if(p===0)return;
    if(p===1){front.attr('d','M0,0H1060V650H0Z');return;}
    const reach=radius*2.1*(1-Math.pow(1-p,2));
    const points=distances.map((previous,i)=>{
      const angle=i/distances.length*Math.PI*2;
      const ripple=.82+.16*Math.sin(angle*3+phase)+.09*Math.sin(angle*7-phase)+.04*Math.sin(angle*13+p*3);
      const distance=Math.max(previous,reach*ripple);distances[i]=distance;
      return [origin[0]+Math.cos(angle)*distance,origin[1]+Math.sin(angle)*distance];
    });
    front.attr('d',curve(points));
  }).finally(()=>{layer.remove();mask.remove();finish();});
}
async function drawContender(chosen,alive){
  const strip=$('draw-strip'),target=80,landing=.08+Math.random()*.84;
  strip.replaceChildren();
  for(let i=0;i<88;i++){
    const id=i===target?chosen:alive[Math.floor(Math.random()*alive.length)],card=document.createElement('div');
    card.className='draw-card';card.dataset.team=id;card.append(teamContent(id,''));strip.append(card);
  }
  $('draw-dialog').showModal();
  const move=p=>{const card=strip.children[target],step=strip.children[1].offsetLeft-strip.children[0].offsetLeft;
    const center=$('draw-window').clientWidth/2,start=2*step+card.offsetWidth/2,end=target*step+card.offsetWidth*landing;
    // A fast opening burst gives way to a long tail, with cards still passing near the end.
    const travel=.8*(1-Math.pow(1-p,8))+.2*(1-Math.pow(1-p,2));
    const offset=start+(end-start)*travel;
    strip.style.transform=`translateX(${center-offset}px)`;
  };
  await animate(6500,move);strip.children[target].classList.add('draw-chosen');
  await animate(700,()=>{});$('draw-dialog').close();
}
async function spin(){
  if(busy||!attacker||defender||Empire.survivors(state).length===1)return;
  busy=true;render();
  focusTerritory(attacker);
  if(!reduced())await animate(650,()=>{});
  const origin=byId[attacker].point;let angle,hit,attempts=0;
  while(attempts<256&&!hit){angle=Math.random()*Math.PI*2;hit=Empire.firstHit(origin,angle,attacker,activeCells(),state.owners);attempts++;}
  if(!hit){for(const t of teams.filter(t=>state.owners[t.id]!==attacker)){angle=Math.atan2(t.point[1]-origin[1],t.point[0]-origin[0]);hit=Empire.firstHit(origin,angle,attacker,activeCells(),state.owners);if(hit)break;}}
  if(!hit){busy=false;$('draw-preview').hidden=true;notice('No opposing or unclaimed land found. Click an opposing territory to choose a rival.');render();return;}
  const initialLength=Math.min(hit.distance,48/(d3.zoomTransform(svg.node()).k*Math.hypot(svg.node().getScreenCTM().a,svg.node().getScreenCTM().b)));
  const target=angle+Math.PI*8;await animate(2100,p=>drawArrow(target*(1-Math.pow(1-p,4)),initialLength));
  lastRay={angle,hit};if(hit.id!==null)focusTerritory(attacker,hit.id);else focusPoints([origin,hit.point]);
  await animate(850,p=>drawArrow(angle,initialLength+(hit.distance-initialLength)*(1-Math.pow(1-p,3))));
  if(hit.id===null){
    const winner=attacker,land=cells.find(cell=>cell.id===hit.territory);
    const previousAwards=campaignAwards();
    Empire.claim(state,winner,hit.territory);save();await animateCapture(winner,[hit.territory],'#c5c9c7',hit.point);announceAwards(previousAwards);
    notice(storageAvailable?`${byId[winner].name} claimed ${land.name}!`:'Territory claimed. Browser storage is unavailable; keep this tab open.');
    $('random').focus({preventScroll:true});return;
  }
  defender=hit.id;drawArrow(angle,hit.distance);busy=false;render();
  notice(`${byId[attacker].name} → ${byId[defender].name}. Inspect the landing, then choose the winner.`);
}
async function startRound(){
  if(busy)return;
  if(defender)return;
  const alive=Empire.survivors(state);
  if(alive.length===1){if(confirm('Start a new campaign?')){clearAwardToast();state=newCampaign();save();clear();}return;}
  if(attacker){await spin();return;}
  busy=true;notice('');render();const chosen=alive[Math.floor(Math.random()*alive.length)];
  await drawContender(chosen,alive);
  attacker=chosen;busy=false;focusTerritory(chosen);render();$('random').focus({preventScroll:true});
}
function win(id){
  if(busy||!attacker||!defender||![attacker,defender].includes(id))return;
  const loser=id===attacker?defender:attacker,captured=Object.keys(state.owners).filter(key=>state.owners[key]===loser),origin=lastRay?.hit.point||byId[id].point;
  const previousAwards=campaignAwards();
  Empire.resolve(state,id,loser);save();
  const remaining=Empire.survivors(state).length;
  const capture=animateCapture(id,captured,color(loser),origin);
  return capture.then(()=>{announceAwards(previousAwards);announceMilestone(remaining);notice(storageAvailable?`${byId[id].name} claimed ${byId[loser].name}’s territory.`:'Result applied. Browser storage is unavailable; keep this tab open.');if(!$('winner-dialog').open)$('random').focus({preventScroll:true});});
}
function undo(){if(busy)return;clearAwardToast();clearMilestone();const previous=Empire.undo(state);save();clear();if(previous)notice(previous.loser===null?'Claim undone. Territory is unclaimed again.':`Round restored. ${byId[previous.loser].name} is back on the map.`);}
$('random').onclick=startRound;
if(!nflEdition)$('include-fcs').onchange=()=>{
  if(busy||state.history.length){$('include-fcs').checked=includeFcs;return;}
  includeFcs=$('include-fcs').checked;
  teams.splice(0,teams.length,...allTeams.filter(t=>includeFcs||!fcsTeams.includes(t)));
  updateNeutralIds();buildCells();updateCellAreas();regionCache.clear();ownershipKey=null;markerLayout=null;
  awardTerritories=null;awardCacheKey=null;clearAwardToast();
  clearMilestone();state=newCampaign();save();clear();svg.call(zoom.transform,d3.zoomIdentity);
};
if(!nflEdition){
  $('awards').onclick=()=>{
    if(busy)return;
    renderAwards();$('settings-dialog').close();$('awards-dialog').showModal();
  };
  $('close-awards').onclick=()=>$('awards-dialog').close();
}
$('leaderboard').onclick=()=>{if(!busy){renderLeaderboard();$('leaderboard-dialog').showModal();}};
$('close-leaderboard').onclick=()=>$('leaderboard-dialog').close();
for(const tab of ['size','wins']){
  $(tab+'-tab').onclick=()=>{leaderboardTab=tab;renderLeaderboard();};
  $(tab+'-tab').onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    leaderboardTab=event.key==='Home'?'size':event.key==='End'?'wins':tab==='size'?'wins':'size';
    renderLeaderboard();$(leaderboardTab+'-tab').focus();
  };
}
$('reset-map').onclick=()=>{
  if(busy||!confirm('Reset the map? All campaign progress will be cleared.'))return;
  clearAwardToast();
  clearMilestone();state=newCampaign();save();clear();svg.call(zoom.transform,d3.zoomIdentity);
  $('settings-dialog').close();notice('Map reset. Every team is back in its starting territory.');$('random').focus({preventScroll:true});
};
function dismissMatchup(){if(Empire.survivors(state).length===1){$('winner-dialog').close();}else clear();$('random').focus({preventScroll:true});}
$('close-winner').onclick=dismissMatchup;
$('winner-dialog').addEventListener('cancel',event=>{event.preventDefault();dismissMatchup();});
$('draw-dialog').addEventListener('cancel',event=>event.preventDefault());
render();
window.empireApp={teams,cells,neutralIds,activeCells,projection,zoom,get state(){return state;},get attacker(){return attacker;},get defender(){return defender;},choose,win,clear,undo,spin};
if(testMode){const script=document.createElement('script');script.src=nflEdition?'dev/nfl-tests.js':'dev/tests.js';document.body.append(script);}
