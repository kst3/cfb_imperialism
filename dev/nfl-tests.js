/* Open nfl.html?test=1; isolated from saved campaigns. */
(async function(){
  const output=document.createElement('pre');output.id='test-results';
  output.style.cssText='position:fixed;top:0;left:0;max-height:40vh;overflow:auto;z-index:100;background:white;color:black;padding:16px';document.body.prepend(output);
  let passed=0,failed=0;
  const app=window.empireApp;
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  async function test(name,fn){try{await fn();passed++;output.textContent+=`PASS ${name}\n`;}catch(e){failed++;output.textContent+=`FAIL ${name}: ${e.message}\n`;}}
  const area=geometry=>geometry.reduce((sum,p)=>sum+Math.abs(d3.polygonArea(p[0]))-p.slice(1).reduce((s,r)=>s+Math.abs(d3.polygonArea(r)),0),0);
  await test('College awards are absent from NFL',()=>{
    assert(!window.EmpireAwards&&!document.getElementById('awards')&&!document.getElementById('awards-dialog')&&!document.getElementById('award-toast'),'College award UI or data loaded');
    app.choose(app.teams[0].id);assert(!document.querySelector('.team-awards'),'College badges shown');app.clear();
    assert(Object.keys(campaignAwards()).length===0,'College award tracking active');
  });
  await test('32 unique teams, each with territory containing its anchor',()=>{
    assert(app.teams.length===32&&new Set(app.teams.map(t=>t.id)).size===32,'Roster');
    assert(app.cells.length===32+app.neutralIds.length&&app.neutralIds.length>0,'Territory count');
    for(const team of app.teams){const cell=app.cells.find(c=>c.id===team.id);assert(area(cell.geometry)>0&&Empire.inside(team.point,cell.polygon)&&Empire.inRings(team.point,cell.rings),team.name);}
  });
  await test('All displayed land covered without overlapping territories',()=>{
    const land=polygonClipping.union(...states.map(projectedGeometry));
    const owned=polygonClipping.union(...app.cells.map(c=>c.geometry));
    assert(area(polygonClipping.difference(land,owned))<0.01,'Missing land');
    assert(area(polygonClipping.difference(owned,land))<0.01,'Land outside map');
    assert(Math.abs(app.cells.reduce((s,c)=>s+area(c.geometry),0)-area(owned))<0.01,'Overlapping land');
  });
  await test('Starting territories stay within their home states',()=>{
    for(const team of app.teams){
      const cell=app.cells.find(c=>c.id===team.id);
      const home=polygonClipping.union(...states.filter(f=>team.territoryStates.includes(stateCodes[String(f.id).padStart(2,'0')])).map(projectedGeometry));
      assert(area(polygonClipping.difference(cell.geometry,home))<0.01,team.name+' crosses state line');
    }
  });
  await test('Teamless states start unclaimed and support claims and undo',()=>{
    const expected=states.filter(f=>!app.teams.some(t=>t.territoryStates.includes(stateCodes[String(f.id).padStart(2,'0')])));
    assert(app.neutralIds.length===expected.length,'Neutral count');
    for(const f of expected)assert(app.state.owners['state:'+stateCodes[String(f.id).padStart(2,'0')]]===null,'State already owned');
    assert(app.state.owners['state:HI']===null&&app.state.owners['state:OK']===null,'Hawaii or Oklahoma owned');
    const s=Empire.fresh(app.teams,app.neutralIds),initial=JSON.stringify(s);
    Empire.claim(s,'den','state:WY');assert(s.owners['state:WY']==='den','Claim failed');
    assert(Empire.valid(s,app.teams,app.neutralIds),'Claim save invalid');
    Empire.undo(s);assert(JSON.stringify(s)===initial,'Claim undo');
  });
  await test('Single-team states belong entirely to their home team',()=>{
    for(const feature of states){
      const code=stateCodes[String(feature.id).padStart(2,'0')];
      const local=app.teams.filter(t=>t.territoryStates.includes(code));
      if(local.length!==1)continue;
      const cell=app.cells.find(c=>c.id===local[0].id);
      assert(area(polygonClipping.difference(projectedGeometry(feature),cell.geometry))<0.01,code+' not fully owned by '+local[0].name);
    }
    assert(app.teams.find(t=>t.id==='buf').state==='NY'&&app.teams.filter(t=>t.state==='NJ').length===2,'Home-stadium states');
  });
  await test('Rams own northern LA and Chargers own southern LA',()=>{
    for(const [id,lat] of [['lar',34.3],['lac',33.85]]){
      const cell=app.cells.find(c=>c.id===id);
      for(const lon of [-118.3,-118.1,-117.9])assert(Empire.inRings(app.projection([lon,lat]),cell.geometry.flat()),id+' wrong side at '+lon);
    }
  });
  await test('Regional teams own all requested states',()=>{
    for(const [id,codes] of [['ne',['MA','ME','NH','VT','RI','CT']],['car',['NC','SC']],['kc',['MO','KS']],['wsh',['DC']]]){
      const cell=app.cells.find(c=>c.id===id);
      for(const code of codes){
        const feature=states.find(f=>stateCodes[String(f.id).padStart(2,'0')]===code);
        assert(area(polygonClipping.difference(projectedGeometry(feature),cell.geometry))<0.01,id+' missing '+code);
        assert(!app.neutralIds.includes('state:'+code),code+' still neutral');
      }
    }
  });
  await test('Florida mainland fragments connect to their team territory',()=>{
    const florida=projectedGeometry(states.find(f=>+f.id===12));
    const mainlandOutline=[florida.reduce((a,b)=>area([a])>area([b])?a:b)];
    for(const id of ['jax','tb','mia']){
      const cell=app.cells.find(c=>c.id===id),team=app.teams.find(t=>t.id===id);
      const mainland=polygonClipping.intersection(cell.geometry,mainlandOutline);
      assert(mainland.length===1&&Empire.inRings(team.point,mainland[0]),id+' disconnected mainland');
      assert(JSON.stringify(cell.rings)===JSON.stringify(cell.geometry.flat()),id+' stale hit geometry');
    }
  });
  await test('NFL has no ranking controls or team-card ranks',()=>{
    assert(!document.getElementById('show-territory-ranks'),'Rank setting remains');
    app.choose('ne');
    assert(!document.querySelector('.territory-rank'),'Rendered rank');
    assert(Object.values(teamStats()).every(stats=>stats.rank===null),'Ranks still calculated');
    app.clear();
  });
  await test('Every team can hit opposing territory',()=>{
    for(const team of app.teams)assert(app.teams.some(other=>other!==team&&Empire.firstHit(team.point,Math.atan2(other.point[1]-team.point[1],other.point[0]-team.point[0]),team.id,app.cells,app.state.owners)),team.name);
  });
  await test('Full campaign, save validation and undo',()=>{
    const s=Empire.fresh(app.teams,app.neutralIds),initial=JSON.stringify(s),winner=app.teams[0].id;
    for(const t of app.teams.slice(1))Empire.resolve(s,winner,t.id);
    assert(Empire.survivors(s).length===1&&s.history.length===31,'Champion');
    assert(Empire.valid(s,app.teams,app.neutralIds),'Save invalid');
    while(s.history.length)Empire.undo(s);
    assert(JSON.stringify(s)===initial,'Undo mismatch');
  });
  await test('Manual matchup captures and redraws territory',async()=>{
    const original=window.matchMedia;window.matchMedia=()=>({matches:true});
    try{app.choose('den');app.choose('kc');await app.win('den');assert(app.state.owners.kc==='den','Capture');assert(document.querySelectorAll('.territory').length===31,'Render');app.undo();assert(document.querySelectorAll('.territory').length===32,'Restore');}finally{window.matchMedia=original;}
  });
  output.textContent+=`${passed} passed, ${failed} failed`;
  document.documentElement.dataset.tests=failed?'failed':'passed';
})();
