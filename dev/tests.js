/* Open index.html?test=1. Runs in isolation from the player's saved campaign. */
(async function(){
  const output=document.createElement('pre');output.id='test-results';output.style.cssText='position:fixed;top:0;left:0;width:100%;max-height:30vh;overflow:auto;z-index:10;background:white;color:black;padding:20px;white-space:pre-wrap';document.body.prepend(output);
  let passed=0,failed=0;
  function assert(condition,message){if(!condition)throw new Error(message);}
  async function test(name,fn){try{await fn();passed++;output.textContent+=`PASS ${name}\n`;}catch(error){failed++;output.textContent+=`FAIL ${name}: ${error.message}\n`;}}
  const app=window.empireApp,E=Empire; const browserMatchMedia=window.matchMedia;window.matchMedia=()=>({matches:true});
  await test('Award roster covers every FBS team and all rivalry IDs are distinct',()=>{
    campaignAwards();
    assert(app.teams.every(t=>EmpireAwards.conferenceById[t.id]),'Missing conference');
    const games=EmpireAwards.games;
    assert(new Set(games.map(g=>g.id)).size===games.length,'Duplicate matchup');
    assert(games.every(g=>g.teams.length===2&&g.teams.every(id=>app.teams.some(t=>t.id===id))),'Invalid rivalry team');
  });
  await test('Rivalry awards require a direct win and stay with their earner; replay and undo agree',()=>{
    const s=E.fresh(app.teams,app.neutralIds),get=()=>EmpireAwards.evaluate(s,app.teams,awardTerritories),has=(id,name)=>get()[id].some(a=>a.id===name);
    E.resolve(s,'333','2');assert(has('333','rivalry:2:333')&&!has('2','rivalry:2:333'),'Iron Bowl winner');
    E.resolve(s,'23','333');assert(has('333','rivalry:2:333')&&!has('23','rivalry:2:333'),'Award transferred');
    assert(JSON.stringify(get())===JSON.stringify(EmpireAwards.evaluate(JSON.parse(JSON.stringify(s)),app.teams,awardTerritories)),'Reload differs');
    E.undo(s);E.undo(s);assert(!has('333','rivalry:2:333'),'Undo retained award');
    E.resolve(s,'23','2');E.resolve(s,'333','23');assert(!has('333','rivalry:2:333'),'Indirect rivalry win');
  });
  await test('Perfect Season unlocks at 12 actual wins; President only on the original DC claim',()=>{
    const s=E.fresh(app.teams,app.neutralIds),has=(id,key)=>EmpireAwards.evaluate(s,app.teams,awardTerritories)[id].some(a=>a.id===key);
    E.claim(s,'333','state:DC');assert(has('333','president')&&!has('333','perfect-season'),'DC claim');
    for(const t of app.teams.filter(t=>!['333','23'].includes(t.id)).slice(0,11))E.resolve(s,'333',t.id);
    assert(!has('333','perfect-season'),'Claim counted as win');
    const next=E.survivors(s).find(id=>!['333','23'].includes(id));E.resolve(s,'333',next);
    assert(has('333','perfect-season'),'Twelfth win');E.resolve(s,'23','333');
    assert(!has('23','president')&&has('333','president')&&has('333','perfect-season'),'Awards transferred or lost');
  });
  await test('Free real estate counts only personal neutral claims, with replay and undo',()=>{
    const teams=['a','b','c'].map(id=>({id})),s=E.fresh(teams,['x','y','z']);
    const get=()=>EmpireAwards.evaluate(s,teams,[]),has=id=>get()[id].some(a=>a.id==='free-real-estate');
    E.claim(s,'a','x');assert(!has('a'),'One claim unlocked award');
    E.claim(s,'a','y');assert(has('a')&&get().a.find(a=>a.id==='free-real-estate').round===2,'Second claim missing');
    E.undo(s);assert(!has('a'),'Undo retained award');E.claim(s,'a','y');
    E.resolve(s,'b','a');assert(has('a')&&!has('b'),'Conquest counted inherited claims');
    E.claim(s,'b','z');assert(!has('b'),'Inherited territory counted toward two claims');
    assert(JSON.stringify(get())===JSON.stringify(EmpireAwards.evaluate(JSON.parse(JSON.stringify(s)),teams,[])),'Reload differs');
  });
  await test('Pacific Hoarder requires all four states including inland cells and Hawaii',()=>{
    const teams=[{id:'a',state:'CA'},{id:'ca',state:'CA'},{id:'or',state:'OR'},{id:'wa',state:'WA'},{id:'inland',state:'WA'},{id:'hi',state:'HI'},{id:'b',state:'NY'}];
    const s=E.fresh(teams),get=()=>EmpireAwards.evaluate(s,teams,teams),has=id=>get()[id].some(a=>a.id==='pacific-hoarder');
    for(const id of ['ca','or','wa'])E.resolve(s,'a',id);
    assert(!has('a'),'Partial coast unlocked award');E.resolve(s,'a','hi');
    assert(!has('a'),'Missing inland land unlocked award');E.resolve(s,'a','inland');
    assert(has('a')&&get().a.find(a=>a.id==='pacific-hoarder').round===5,'Full ownership missing');
    for(const home of ['CA','OR','WA','HI','TX','NY']){
      const roster=teams.map(t=>t.id==='a'?{...t,state:home}:t);
      const eligible=EmpireAwards.evaluate(s,roster,teams).a.some(a=>a.id==='pacific-hoarder');
      assert(eligible===['CA','OR','WA','HI'].includes(home),'Incorrect home-state eligibility: '+home);
    }
    assert(!EmpireAwards.evaluate(s,teams,teams.filter(t=>t.state!=='HI')).a.some(a=>a.id==='pacific-hoarder'),'Missing state data qualifies');
    E.undo(s);assert(!has('a'),'Undo retained award');E.resolve(s,'a','inland');
    E.resolve(s,'b','a');assert(has('a')&&!has('b'),'Ineligible team earned award or original earner lost it');
    assert(JSON.stringify(get())===JSON.stringify(EmpireAwards.evaluate(JSON.parse(JSON.stringify(s)),teams,teams)),'Reload differs');
  });
  await test('Lone Star requires all Texas land and a Texas team',()=>{
    for(const winner of ['251','333']){
      const s=E.fresh(app.teams,app.neutralIds),texas=app.teams.filter(t=>t.state==='TX'&&t.id!==winner);
      for(const t of texas.slice(0,-1))E.resolve(s,winner,t.id);
      const has=()=>EmpireAwards.evaluate(s,app.teams,awardTerritories)[winner].some(a=>a.id==='lone-star');
      assert(!has(),'Partial Texas');E.resolve(s,winner,texas.at(-1).id);assert(has()===(winner==='251'),'Texas origin restriction');
    }
  });
  await test('Represent rewards the last conference survivor, excluding independents',()=>{
    const s=E.fresh(app.teams,app.neutralIds),sec=app.teams.filter(t=>EmpireAwards.conferenceById[t.id]==='SEC'&&t.id!=='333');
    for(const t of sec.slice(0,-1))E.resolve(s,'23',t.id);
    const awards=()=>EmpireAwards.evaluate(s,app.teams,awardTerritories);
    assert(!awards()['333'].some(a=>a.id==='conference:SEC'),'Premature representative');
    E.resolve(s,'23',sec.at(-1).id);assert(awards()['333'].some(a=>a.id==='conference:SEC'),'Nonwinning survivor not rewarded');
    E.resolve(s,'23','41');assert(!awards()['87'].some(a=>a.id==='conference:Independent'),'Independent award');
  });
  await test('Coast to Coast requires both shorelines at once and ignores inland Washington',()=>{
    campaignAwards();
    const east=awardTerritories.find(t=>t.coasts.includes('east')&&app.state.owners[t.id]),west=awardTerritories.find(t=>t.coasts.includes('west')&&app.state.owners[t.id]);
    assert(east&&west,'Missing coastline detection');
    assert(!awardTerritories.find(t=>t.id==='265').coasts.length,'Inland Washington State touches coast');
    const s=E.fresh(app.teams,app.neutralIds),has=()=>EmpireAwards.evaluate(s,app.teams,awardTerritories)[east.id].some(a=>a.id==='coast-to-coast');
    assert(!has(),'One coast');E.resolve(s,east.id,west.id);assert(has(),'Both coasts');E.undo(s);assert(!has(),'Undo coast');
  });
  await test('Dont mind me unlocks only for zero-win survivors at 5 teams remaining',()=>{
    const s=E.fresh(app.teams,app.neutralIds),awards=()=>EmpireAwards.evaluate(s,app.teams,awardTerritories),has=id=>awards()[id].some(a=>a.id==='dont-mind-me');
    assert(Object.values(awards()).every(list=>!list.some(a=>a.id==='dont-mind-me')),'Starting land ranks unlocked award');
    const opponents=app.teams.filter(t=>!['333','23'].includes(t.id));
    for(const t of opponents.slice(0,132))E.resolve(s,'333',t.id);
    assert(E.survivors(s).length===6&&!has('23'),'Award before 5 survivors');
    E.claim(s,'23','state:DC');assert(!has('23'),'Claim triggered early award');
    E.resolve(s,'333',opponents[132].id);
    assert(E.survivors(s).length===5&&has('23')&&!has('333'),'Incorrect qualifying teams');
    assert(Object.values(awards()).filter(list=>list.some(a=>a.id==='dont-mind-me')).length===4,'Missing zero-win survivors');
    E.undo(s);assert(!has('23'),'Undo retained award');E.resolve(s,'333',opponents[132].id);
    E.resolve(s,'23',E.survivors(s).find(id=>!['333','23'].includes(id)));assert(has('23'),'Later win lost award');
  });
  await test('Series awards are removed and Coast to Coast has only its first earner',()=>{
    assert(!EmpireAwards.catalog(app.teams).some(a=>a.id.startsWith('series:')),'Series remain');
    const teams=['a','b','c','d'].map(id=>({id})),territories=teams.map((t,i)=>({...t,coasts:[i%2?'west':'east']}));
    const s=E.fresh(teams),get=()=>EmpireAwards.evaluate(s,teams,territories),holders=()=>Object.keys(get()).filter(id=>get()[id].some(a=>a.id==='coast-to-coast'));
    E.resolve(s,'a','b');E.resolve(s,'c','d');
    assert(holders().join()==='a','Second coast owner earned award');
    E.resolve(s,'c','a');assert(holders().join()==='a','Award transferred after elimination');
    assert(JSON.stringify(get())===JSON.stringify(EmpireAwards.evaluate(JSON.parse(JSON.stringify(s)),teams,territories)),'Reload changed first earner');
    while(s.history.length)E.undo(s);
    assert(!holders().length,'Undo retained first earner');
    E.resolve(s,'c','d');assert(holders().join()==='c','Alternate first earner not awarded');
  });
  await test('Awards collection opens without a team filter and team badges name earned awards',()=>{
    document.getElementById('awards').click();
    assert(document.getElementById('awards-dialog').open&&!document.getElementById('settings-dialog').open,'Awards dialog');
    assert(document.querySelectorAll('.award-item.earned').length===0,'Premature awards');
    assert(document.querySelector('.awards-toggle').getBoundingClientRect().top>document.getElementById('leaderboard').getBoundingClientRect().top,'Awards icon order');
    E.resolve(app.state,'333','2');E.claim(app.state,'333','state:DC');
    assert(!document.getElementById('awards-team'),'Team dropdown remains');
    renderAwards();
    document.getElementById('close-awards').click();
    assert(document.querySelector('.award-item.earned:not(.rivalry-item) h3').textContent==='President','Major award style');
    assert(document.querySelector('.rivalry-item.earned h3').textContent==='Iron Bowl','Rivalry style');
    app.choose('333');
    assert(document.querySelector('#draw-preview .award-badge:not(.rivalry-badge)').textContent==='President','Major award name');
    assert(document.querySelector('#draw-preview .rivalry-badge').textContent==='Iron Bowl','Rivalry name');
    E.undo(app.state);E.undo(app.state);app.clear();
  });
  await test('Leaderboards rank current territory and list wins only after a victory',()=>{
    const get=id=>document.getElementById(id),rows=()=>[...get('leaderboard-panel').querySelectorAll('li')];
    get('leaderboard').click();
    assert(get('leaderboard-dialog').open&&rows().length===25,'Top 25 popup');
    const values=rows().map(row=>parseFloat(row.querySelector('strong').textContent));
    assert(values.every((value,i)=>!i||values[i-1]>=value),'Size order');
    get('wins-tab').click();assert(!rows().length&&get('leaderboard-panel').textContent.includes('No wins yet'),'Zero wins shown');
    try{
      E.resolve(app.state,'333','2');E.resolve(app.state,'333','62');E.resolve(app.state,'23','333');
      get('wins-tab').click();
      assert(rows().length===2,'Winning teams missing');
      assert(rows()[0].textContent.includes('Alabama')&&rows()[0].querySelector('strong').textContent==='2 wins','Eliminated leader or win order');
      assert(rows()[1].querySelector('strong').textContent==='1 win','First win missing');
      get('wins-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
      assert(get('size-tab').getAttribute('aria-selected')==='true'&&document.activeElement===get('size-tab'),'Keyboard tabs');
      assert(!rows().some(row=>row.querySelector('.leaderboard-name').textContent==='Alabama'),'Eliminated team in size ranking');
    }finally{while(app.state.history.length)E.undo(app.state);get('close-leaderboard').click();app.clear();}
    assert(!get('leaderboard-dialog').open,'Close popup');
  });
  await test('Team names spell out State and use plain San Jose',()=>{
    assert(app.teams.every(t=>!(/\bSt\b/.test(t.name))),'Abbreviated State name remains');
    const team=app.teams.find(t=>t.id==='23');
    assert(team.name==='San Jose State'&&team.fullName==='San Jose State Spartans','San Jose name still contains special characters');
  });
  await test('Roster: 138 unique teams, valid coordinates and logos',()=>{assert(app.teams.length===138,'Count');assert(new Set(app.teams.map(t=>t.id)).size===138,'Duplicate IDs');assert(app.teams.every(t=>t.point&&t.logo&&t.name&&Number.isFinite(t.lat)&&Number.isFinite(t.lon)),'Incomplete records');});
  await test('Every hometown lies in its own initial territory',()=>{for(const t of app.teams){assert(app.cells.some(c=>c.id===t.id&&E.inside(t.point,c.polygon)&&E.inRings(t.point,c.rings)),t.name+' outside owned land');}});
  await test('Hawaii and North Dakota each belong to their single FBS team',()=>{for(const [code,id] of [['HI','62'],['ND','2449']])assert(app.cells.filter(c=>c.state===code).every(c=>c.id===id),code);});
  await test('Teamless states start unclaimed and have targetable geometry',()=>{const unclaimed=[...document.querySelectorAll('.unclaimed-state')].map(el=>el.__data__.state);assert(!unclaimed.includes('AK')&&unclaimed.includes('MT'),'Missing unclaimed states');assert(unclaimed.every(code=>app.cells.some(c=>c.state===code&&app.state.owners[c.id]===null)&&!app.teams.some(t=>t.state===code)),'Unclaimed land assigned to a team');assert(new Set([...app.cells.map(c=>c.state),...unclaimed]).size===50,'Missing state');});
  await test('Chained conquest transfers all previous winnings; undo restores exactly',()=>{const s=E.fresh(app.teams,app.neutralIds);E.resolve(s,'333','2');const before=JSON.stringify(s);E.resolve(s,'62','333');assert(s.owners['333']==='62'&&s.owners['2']==='62','Missing captured land');assert(E.survivors(s).length===136,'Survivor count');E.undo(s);assert(JSON.stringify(s)===before,'Undo mismatch');assert(E.valid(s,app.teams,app.neutralIds),'Valid save rejected');s.owners['2']='62';assert(!E.valid(s,app.teams,app.neutralIds),'Tampered save accepted');});
  await test('Invalid and self matches rejected',()=>{for(const [a,b] of [['333','333'],['333','invalid']]){let threw=false;try{E.resolve(E.fresh(app.teams,app.neutralIds),a,b);}catch{threw=true;}assert(threw,'Invalid result accepted');}});
  await test('A complete campaign reaches one survivor, and all 137 rounds undo',()=>{const s=E.fresh(app.teams,app.neutralIds),winner=app.teams[0].id;for(const t of app.teams.slice(1))E.resolve(s,winner,t.id);assert(E.survivors(s).length===1&&s.history.length===137,'Endgame');assert(E.valid(s,app.teams,app.neutralIds),'Complete save');while(s.history.length)E.undo(s);assert(JSON.stringify(s)===JSON.stringify(E.fresh(app.teams,app.neutralIds)),'Full restore');});
  const rect=(id,x1,x2)=>({id,polygon:[[x1,-2],[x2,-2],[x2,2],[x1,2]],rings:[[[x1,-2],[x2,-2],[x2,2],[x1,2]]]});
  await test('Ray picks the first narrow enemy after water and friendly land',()=>{const hit=E.firstHit([0,0],0,'a',[rect('a',0,2),rect('c',10,12),rect('b',5,5.0001)],{a:'a',b:'b',c:'c'});assert(hit.id==='b'&&Math.abs(hit.distance-5)<1e-9,'Skipped first enemy');});
  await test('Ray skips conquered friendly territory and returns null over ocean',()=>{const cells=[rect('a',0,2),rect('b',5,6),rect('c',10,12)];assert(E.firstHit([0,0],0,'a',cells,{a:'a',b:'a',c:'c'}).id==='c','Friendly land');assert(E.firstHit([0,0],Math.PI/2,'a',cells,{a:'a',b:'b',c:'c'})===null,'Ocean');});
  await test('Ray respects state clipping and polygon holes',()=>{const c=rect('b',2,20);c.rings=[[[10,-2],[15,-2],[15,2],[10,2]],[[11,-1],[12,-1],[12,1],[11,1]]];assert(E.firstHit([0,0],0,'a',[c],{b:'b'}).distance===10,'Clipping');assert(!E.inRings([11.5,0],c.rings),'Hole');});
  await test('Hawaii can target mainland across displayed insets',()=>{const origin=app.teams.find(t=>t.id==='62').point;let hit;for(let angle=0;angle<Math.PI*2&&!hit;angle+=Math.PI/90)hit=E.firstHit(origin,angle,'62',app.cells,app.state.owners);assert(hit&&hit.id!=='62','Hawaii trapped');});
  await test('Every initial team can reach an opponent by a valid ray',()=>{for(const team of app.teams){let hit;for(const target of app.teams){if(target.id===team.id)continue;const angle=Math.atan2(target.point[1]-team.point[1],target.point[0]-team.point[0]);hit=E.firstHit(team.point,angle,team.id,app.cells,app.state.owners);if(hit)break;}assert(hit,team.name+' trapped');}});
  await test('Manual matchup, winner control, eliminated marker, and undo',()=>{app.choose('333');assert(app.attacker==='333','Attacker');app.choose('2');assert(app.defender==='2','Defender');document.querySelector('#draw-preview button').click();assert(app.state.owners['2']==='333','Winner button');assert(E.survivors(app.state).length===137,'Count UI');const marker=[...document.querySelectorAll('.team-marker')].find(el=>el.__data__.id==='2');assert(marker.style.display==='none','Eliminated logo');app.undo();assert(app.state.owners['2']==='2'&&app.state.history.length===0,'Undo UI');});
  await test('Clicking the selected marker deselects it',()=>{
    const marker=[...document.querySelectorAll('.team-marker')].find(el=>el.__data__.id==='333');
    marker.dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(app.attacker==='333','Not selected');
    marker.dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(!app.attacker&&!app.defender,'Not deselected');
    assert(document.getElementById('random').textContent==='Pick a random team','Random draw not restored');
  });
  await test('Either selected team can be toggled off during a matchup',()=>{
    app.choose('333');app.choose('2');app.choose('2');
    assert(app.attacker==='333'&&!app.defender,'Defender did not toggle off independently');
    assert(!document.querySelector('.attack-arrow'),'Arrow remains after deselection');
    assert(document.getElementById('random').textContent==='Spin the direction','Spin control not restored');
    app.choose('2');app.choose('333');
    assert(!app.attacker&&!app.defender,'Attacker did not clear the matchup');
  });
  await test('Settings reset supports cancellation and restores the campaign',()=>{
    app.choose('333');app.choose('2');app.win('333');app.choose('333');
    const before=JSON.stringify(app.state),originalConfirm=window.confirm;
    try{
      document.getElementById('settings').click();assert(document.getElementById('settings-dialog').open,'Settings not open');
      window.confirm=()=>false;document.getElementById('reset-map').click();assert(JSON.stringify(app.state)===before&&app.attacker==='333','Cancelled reset changed state');
      window.confirm=()=>true;document.getElementById('reset-map').click();
      assert(JSON.stringify(app.state)===JSON.stringify({...E.fresh(app.teams,app.neutralIds),includeFcs:false}),'Campaign not restored');
      assert(!app.attacker&&!app.defender&&!document.getElementById('settings-dialog').open,'Pending UI remains');
      assert(document.querySelectorAll('.territory').length===138,'Territories not restored');
    }finally{window.confirm=originalConfirm;app.clear();}
  });
  await test('Win totals and top 25 track captures, claims, saves and undo',()=>{
    const initial=teamStats(),ranked=Object.keys(initial).filter(id=>initial[id].rank).sort((a,b)=>initial[a].rank-initial[b].rank);
    assert(ranked.length===25&&initial[ranked[24]].rank===25,'Top 25 missing');
    assert(ranked.every((id,i)=>!i||initial[ranked[i-1]].area>=initial[id].area),'Area order');
    app.choose(ranked[0]);assert(document.querySelector('#draw-preview .territory-rank').textContent==='#1 ','Rank prefix');
    assert(document.querySelector('#draw-preview .team-wins').textContent==='0 wins','Initial wins');app.clear();
    app.choose('333');app.choose('2');app.win('333');app.choose('333');
    assert(document.querySelector('#draw-preview .team-wins').textContent==='1 win','Victory count');
    assert(Math.abs(teamStats()['333'].area-initial['333'].area-initial['2'].area)<1e-6,'Captured area');
    assert(teamStats()['2'].rank===null,'Eliminated team ranked');
    assert(E.valid(JSON.parse(JSON.stringify(app.state)),app.teams,app.neutralIds),'Save compatibility');
    app.undo();assert(teamStats()['333'].wins===0,'Undo wins');
    E.claim(app.state,'333',app.neutralIds[0]);assert(teamStats()['333'].wins===0&&teamStats()['333'].area>initial['333'].area,'Claim statistics');app.undo();
    assert(JSON.stringify(teamStats())===JSON.stringify(initial),'Statistics restored');
  });
  function region(id){return [...document.querySelectorAll('.territory')].find(el=>el.__data__.id===id);}
  function area(geometry){return geometry.reduce((sum,polygon)=>sum+Math.abs(d3.polygonArea(polygon[0]))-polygon.slice(1).reduce((holes,ring)=>holes+Math.abs(d3.polygonArea(ring)),0),0);}
  await test('Adjacent same-state holdings become one actual polygon without losing land',()=>{
    const before=region('12').getAttribute('d'),expected=area(region('12').__data__.geometry)+area(region('9').__data__.geometry);
    app.choose('12');app.choose('9');app.win('12');
    assert(!region('9')&&document.querySelectorAll('.territory').length===137,'Separate conquered path remains');
    assert(Math.abs(area(region('12').__data__.geometry)-expected)<1e-5,'Union changed land area');
    const original=app.cells.filter(c=>c.id==='12'||c.id==='9').flatMap(c=>c.geometry);
    assert(region('12').__data__.geometry.length<original.length,'Adjacent pieces were not dissolved');
    app.undo();assert(region('9')&&region('12').getAttribute('d')===before,'Undo did not restore geometry');
  });
  await test('Nebraska conquers Wyoming: state borders remain visible inside merged land',()=>{
    const borders=document.querySelector('.state-lines').innerHTML;
    const expected=area(region('158').__data__.geometry)+area(region('2751').__data__.geometry);
    app.choose('158');app.choose('2751');app.win('158');
    const geometry=region('158').__data__.geometry;
    assert(geometry.length===1,'Adjacent states remain separate polygons');
    assert(Math.abs(area(geometry)-expected)<1e-5,'State union changed land area');
    const point=app.projection([-104.053,42]);
    assert(E.inRings(point,geometry.flat()),'Former border is not inside merged land');
    const lines=document.querySelector('.state-lines');
    assert(lines.innerHTML===borders&&!lines.hasAttribute('mask')&&getComputedStyle(lines).display!=='none','State borders removed or hidden');
    app.undo();assert(region('2751'),'Undo did not restore Wyoming');
  });
  await test('Disconnected captures keep their coastline without connecting across unclaimed land',()=>{
    const neutral=document.querySelector('.unclaimed-state').getAttribute('d');
    app.choose('333');app.choose('62');app.win('333');
    const geometry=region('333').__data__.geometry;
    assert(geometry.length>1,'Island joined by artificial land');
    assert(E.inRings(app.teams.find(t=>t.id==='62').point,geometry.flat()),'Hawaii lost');
    assert(document.querySelector('.unclaimed-state').getAttribute('d')===neutral,'Neutral state changed');
    app.undo();
  });
  // Reduced motion makes animation endpoints deterministic for this smoke check.
  await test('State lines toggle independently of conquest and reset',()=>{
    const toggle=document.getElementById('show-state-lines'),lines=document.querySelector('.state-lines'),originalConfirm=window.confirm;
    try{
      toggle.click();assert(!toggle.checked&&getComputedStyle(lines).display==='none','Lines not hidden');
      app.choose('158');app.choose('2751');app.win('158');assert(getComputedStyle(lines).display==='none','Conquest restored lines');
      window.confirm=()=>true;document.getElementById('reset-map').click();assert(!toggle.checked&&getComputedStyle(lines).display==='none','Reset changed preference');
      toggle.click();assert(toggle.checked&&getComputedStyle(lines).display!=='none'&&lines.querySelectorAll('path').length===50,'Lines not restored');
    }finally{window.confirm=originalConfirm;if(!toggle.checked)toggle.click();app.clear();}
  });
  const originalMatchMedia=window.matchMedia;window.matchMedia=()=>({matches:true});
  await test('Random draw waits before spinning, then resolves land or an opponent',async()=>{await document.getElementById('random').onclick();assert(app.attacker,'No draw');assert(!app.defender&&!document.getElementById('winner-dialog').open,'Draw spun automatically');assert(document.getElementById('random').textContent==='Spin the direction','Missing spin prompt');await document.getElementById('random').onclick();if(app.defender){assert(app.defender!==app.attacker,'Self matchup');assert(!document.getElementById('winner-dialog').open,'Winner opened before confirmation');assert(document.querySelectorAll('#draw-preview button').length===2,'Winner options');app.win(app.defender);}else{assert(app.state.history.at(-1)?.loser===null,'No automatic claim');}assert(app.state.history.length===1,'Result missing');app.undo();});
  await test('Unclaimed land stops a ray before an enemy and claims transfer and undo',()=>{
    const hit=E.firstHit([0,0],0,'a',[rect('a',0,2),rect('neutral',4,6),rect('b',8,10)],{a:'a',neutral:null,b:'b'});
    assert(hit.id===null&&hit.territory==='neutral'&&hit.distance===4,'Neutral land skipped');
    const s=E.fresh(app.teams,app.neutralIds);E.claim(s,'333','state:MT');E.resolve(s,'2','333');
    assert(s.owners['state:MT']==='2'&&E.valid(s,app.teams,app.neutralIds),'Claim not transferred or saved');
    E.undo(s);assert(s.owners['state:MT']==='333','Conquest undo lost claim');E.undo(s);assert(s.owners['state:MT']===null,'Claim undo failed');
    const legacy=E.fresh(app.teams);E.resolve(legacy,'333','2');assert(E.valid(legacy,app.teams),'Legacy save rejected');
    const migrated={...legacy,owners:{...E.fresh(app.teams,app.neutralIds).owners,...legacy.owners}};
    assert(E.valid(migrated,app.teams,app.neutralIds),'Legacy migration failed');
  });
  await test('Arrow automatically claims Montana without a winner prompt',async()=>{
    const originalRandom=Math.random;let shot;
    for(const team of app.teams){for(let a=0;a<Math.PI*2;a+=Math.PI/360){const hit=E.firstHit(team.point,a,team.id,app.activeCells(),app.state.owners);if(hit?.territory==='state:MT'){shot={id:team.id,angle:a};break;}}if(shot)break;}
    assert(shot,'Montana unreachable');
    try{app.choose(shot.id);Math.random=()=>shot.angle/(Math.PI*2);await app.spin();
      assert(app.state.owners['state:MT']===shot.id,'Montana not claimed');
      assert(!app.defender&&!document.getElementById('winner-dialog').open,'Claim opened matchup');
      assert(![...document.querySelectorAll('.unclaimed-state')].some(el=>el.__data__.state==='MT'),'Claim still gray');
      assert(E.valid(app.state,app.teams,app.neutralIds),'Claim save invalid');app.undo();
    }finally{Math.random=originalRandom;app.clear();}
  });
  await test('Alaska is removed and old saves retain their other conquests',()=>{
    assert(!document.getElementById('show-alaska')&&!app.cells.some(c=>c.state==='AK')&&!app.neutralIds.includes('state:AK'),'Alaska remains');
    assert(![...document.querySelectorAll('.state-line')].some(el=>+el.__data__.id===2),'Alaska outline remains');
    const legacy=E.fresh(app.teams,['state:AK',...app.neutralIds]);
    E.claim(legacy,'333','state:AK');E.claim(legacy,'333','state:MT');E.resolve(legacy,'2','333');
    const migrated=E.loadCampaign(legacy,app.teams,app.neutralIds);
    assert(migrated&&E.valid(migrated,app.teams,app.neutralIds),'Old save rejected');
    assert(!Object.hasOwn(migrated.owners,'state:AK')&&migrated.owners['state:MT']==='2'&&migrated.owners['333']==='2','Migration lost other conquests');
    E.undo(migrated);assert(migrated.owners['state:MT']==='333','Migrated undo lost claim');
    E.undo(migrated);assert(migrated.owners['state:MT']===null&&migrated.history.length===0,'Claim undo failed');
  });
  await test('Hawaii stays southwest of the mainland and all land fits',()=>{
    const hi=app.projection([-157,20]),ca=app.projection([-120,37]);
    assert(hi[0]<ca[0]&&hi[1]>ca[1],'Hawaii position');
    for(const c of app.cells)assert(c.geometry.flat(2).every(p=>p[0]>=0&&p[0]<=1060&&p[1]>=0&&p[1]<=650),'Land out of view: '+c.state);
  });
  window.matchMedia=originalMatchMedia;
  await test('Preview offers accessible winner buttons when both teams are selected',()=>{
    const before=JSON.stringify(app.state);app.choose('333');
    assert(!document.querySelector('#draw-preview button'),'Single team can win');app.choose('2');
    assert(!document.getElementById('winner-dialog').open,'Overlay opened');
    assert(document.getElementById('random').hidden,'Extra winner step');
    const choices=[...document.querySelectorAll('#draw-preview button')];
    assert(choices.length===2&&choices.every(button=>!button.disabled&&button.querySelector('img')&&button.getAttribute('aria-label').includes('wins')),'Missing accessible choices');
    app.clear();assert(JSON.stringify(app.state)===before,'Clearing changed ownership');
  });
  await test('Map fills viewport with no page scroll and compact idle controls',()=>{
    app.clear();const bounds=document.getElementById('map').getBoundingClientRect();
    assert(bounds.top===0&&bounds.left===0&&Math.abs(bounds.width-innerWidth)<1&&Math.abs(bounds.height-innerHeight)<1,'Map does not fill viewport');
    assert(document.documentElement.scrollHeight<=innerHeight,'Page has vertical overflow');
    const visible=[...document.querySelectorAll('button')].filter(button=>button.getClientRects().length);
    assert(visible.length===4&&['random','settings','leaderboard','awards'].every(id=>visible.some(button=>button.id===id)),'Unexpected idle controls');
    const settings=document.getElementById('settings').getBoundingClientRect(),leaderboard=document.getElementById('leaderboard').getBoundingClientRect();
    assert(leaderboard.top>settings.bottom&&leaderboard.right===settings.right,'Leaderboard icon is not below settings');
  });
  await test('Wheel zooms map without scrolling, including at minimum zoom',()=>{
    const map=document.getElementById('map');
    const out=new WheelEvent('wheel',{deltaY:100,clientX:innerWidth/2,clientY:innerHeight/2,bubbles:true,cancelable:true});map.dispatchEvent(out);assert(out.defaultPrevented,'Wheel escaped at zoom limit');
    const zoomIn=new WheelEvent('wheel',{deltaY:-100,clientX:innerWidth/2,clientY:innerHeight/2,bubbles:true,cancelable:true});map.dispatchEvent(zoomIn);
    assert(zoomIn.defaultPrevented&&map.__zoom.k>1,'Map did not zoom');assert(window.scrollY===0,'Page scrolled');
  });
  await test('Layout fits viewport without horizontal overflow',()=>assert(document.documentElement.scrollWidth<=window.innerWidth,`Page ${document.documentElement.scrollWidth}px exceeds viewport ${window.innerWidth}px`));
  await test('Logos stay screen-sized and separate at maximum zoom in South Florida',()=>{
    const map=d3.select('#map'),center=app.projection([-80.3,26]);
    const visible=()=>[...document.querySelectorAll('.team-marker')].filter(el=>{const r=el.getBoundingClientRect();return el.style.display!=='none'&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;});
    const circles=()=>visible().map(el=>el.querySelector('circle').getBoundingClientRect());
    function checkSpacing(){const bounds=circles();for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
      const a=bounds[i],b=bounds[j];assert(Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2)>=(a.width+b.width)/2+3,'Overlapping badges');
    }}
    try{
      map.call(app.zoom.transform,d3.zoomIdentity);const width=circles()[0].width;
      assert(!document.querySelector('.marker-links'),'Location dots or connectors remain');
      for(const k of [3,9]){map.call(app.zoom.transform,d3.zoomIdentity.translate(530-k*center[0],325-k*center[1]).scale(k));
        if(k===9)checkSpacing();assert(circles().every(b=>Math.abs(b.width-width)<.1),'Zoom enlarged logos');
        const florida=app.teams.filter(t=>t.state==='FL'&&t.lat<27&&t.lat>25);
        assert(florida.length>=3&&florida.every(t=>visible().some(el=>el.__data__.id===t.id)),'South Florida logos missing');
      }
      const marker=visible().find(el=>el.__data__.state==='FL');marker.dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(app.attacker===marker.__data__.id,'Offset badge not clickable');app.clear();
    }finally{map.call(app.zoom.transform,d3.zoomIdentity);app.clear();}
  });
  await test('Hawaii has no label and does not overlap mainland land',()=>{
    assert(!document.querySelector('.inset-label'),'Inset labels remain');
    const hi=app.cells.find(c=>c.state==='HI').geometry;
    const mainland=app.cells.filter(c=>c.state!=='HI');
    assert(mainland.every(c=>!polygonClipping.intersection(c.geometry,hi).length),'Inset overlaps mainland');
    assert(Math.hypot(...app.projection([-157,20]).map((v,i)=>v-app.projection([-120,37])[i]))<220,'Hawaii too distant');
  });
  await test('Background clears selection while team selection focuses the camera',()=>{
    app.choose('333');const map=document.getElementById('map'),bounds=region('333').getBBox(),point=d3.zoomTransform(map).apply([bounds.x+bounds.width/2,bounds.y+bounds.height/2]);
    assert(map.__zoom.k>1&&Math.abs(point[0]-530)<1&&Math.abs(point[1]-310)<1,'Camera did not focus');
    map.dispatchEvent(new MouseEvent('click',{bubbles:true}));assert(!app.attacker&&!app.defender,'Background did not clear');
  });
  await test('Territory focus zooms out as holdings grow and includes detached and claimed land',()=>{
    const map=document.getElementById('map'),originalOwners={...app.state.owners};
    function checkFit(){
      const transform=d3.zoomTransform(map);
      for(const cell of app.cells.filter(c=>app.state.owners[c.id]==='333')){
        for(const point of cell.geometry.flat(2)){
          const [x,y]=transform.apply(point);
          assert(x>=0&&x<=1060&&y>=0&&y<=650,'Owned land outside view');
        }
      }
    }
    try{
      app.choose('333');const small=map.__zoom.k;checkFit();app.clear();
      app.state.owners['62']='333';app.state.owners['state:MT']='333';
      app.choose('333');assert(map.__zoom.k<small,'Expanded territory did not zoom out');checkFit();app.clear();
      for(const id of Object.keys(app.state.owners))if(id!=='2')app.state.owners[id]='333';
      app.choose('333');assert(map.__zoom.k===1,'Late-game empire did not return to overview');checkFit();
    }finally{app.state.owners=originalOwners;app.clear();}
  });
  function checkMatchupFocus(){
    const ids=[app.attacker,app.defender],transform=d3.zoomTransform(document.getElementById('map'));
    const points=app.cells.filter(c=>ids.includes(app.state.owners[c.id])).flatMap(c=>c.geometry.flat(2)).map(p=>transform.apply(p));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    assert(Math.min(...xs)>=0&&Math.max(...xs)<=1060&&Math.min(...ys)>=0&&Math.max(...ys)<=650,'Matchup territory outside view');
    assert(transform.k===9||transform.k===1||Math.max(...xs)-Math.min(...xs)>859||Math.max(...ys)-Math.min(...ys)>499,'Matchup zoomed out too far');
  }
  await test('Manual matchup tightly fits both teams including conquered land',()=>{
    const originalOwners={...app.state.owners};
    try{
      app.choose('333');app.choose('2');checkMatchupFocus();app.clear();
      app.state.owners['62']='2';app.state.owners['state:MT']='333';
      app.choose('333');app.choose('2');checkMatchupFocus();
    }finally{app.state.owners=originalOwners;app.clear();}
  });
  await test('Sliding draw lands on the actual selected team',async()=>{
    await document.getElementById('random').onclick();
    assert(document.querySelector('.draw-chosen')?.dataset.team===app.attacker,'Reel winner differs from selected team');
    assert(document.querySelectorAll('.draw-card').length===88&&!document.getElementById('draw-dialog').open,'Reel did not finish');app.clear();
  });
  await test('Wavy cells cover each original state without overlap',()=>{
    for(const group of d3.group(app.cells,c=>c.state).values()){
      if(group.length<2)continue;
      const merged=polygonClipping.union(...group.map(c=>c.geometry)),sum=group.reduce((n,c)=>n+area(c.geometry),0);
      assert(Math.abs(sum-area(merged))<.01,'Overlapping land in '+group[0].state);
      const stateArea=(group[0].stateRings||group[0].rings).reduce((sum,ring)=>sum+d3.polygonArea(ring),0);
      assert(Math.abs(Math.abs(stateArea)-area(merged))<.03,'Missing land in '+group[0].state);
    }
  });
  await test('Arrow remains visible for inspection until a preview team is clicked',async()=>{
    const team=app.teams.find(t=>t.id==='333'),originalRandom=Math.random;let angle;
    for(let a=0;a<Math.PI*2;a+=Math.PI/180){const hit=E.firstHit(team.point,a,team.id,app.activeCells(),app.state.owners);if(hit?.id){angle=a;break;}}
    assert(angle!==undefined,'No opponent ray');
    try{app.choose(team.id);Math.random=()=>angle/(2*Math.PI);await app.spin();
      assert(app.defender&&!document.getElementById('winner-dialog').open,'Winner prompt opened too early');
      checkMatchupFocus();
      assert(!document.getElementById('draw-preview').hidden&&document.querySelectorAll('#draw-preview .preview-team').length===2,'Matchup logos not shown');
      assert(document.getElementById('random').hidden,'Extra confirmation button');
      assert(document.querySelectorAll('.attack-arrow').length===1&&!document.querySelector('#arrowhead'),'Arrow is not a single joined shape');
      const hit=E.firstHit(team.point,angle,team.id,app.activeCells(),app.state.owners),target=d3.zoomTransform(document.getElementById('map')).apply(hit.point);
      assert(target[0]>0&&target[0]<1060&&target[1]>0&&target[1]<650,'Landing outside view');
      await document.querySelectorAll('#draw-preview button')[1].onclick();assert(app.state.history.at(-1).loser===team.id,'Preview defender did not win');app.undo();
      assert(!document.querySelector('.attack-arrow'),'Arrow remains after choosing winner');
      d3.select('#map').call(app.zoom.scaleBy,1.1);assert(!document.querySelector('.attack-arrow'),'Zoom brought hidden arrow back');
    }finally{Math.random=originalRandom;app.clear();}
  });
  await test('Flood reveal handles early frames, removes old borders, and cleans up',async()=>{
    app.choose('333');app.choose('2');
    const savedRAF=window.requestAnimationFrame,frames=[];window.matchMedia=()=>({matches:false});window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};
    try{
      const earlyTimestamp=performance.now()-16;
      const completed=app.win('333');
      assert(app.state.owners['2']==='333'&&document.getElementById('random').disabled,'Capture not committed or controls not locked');
      const oldLand=document.querySelector('.capture-animation path'),front=document.querySelector('#capture-reveal path');
      assert(oldLand&&front&&!document.querySelector('#capture-reveal circle'),'Flood reveal did not start');
      assert(oldLand.getAttribute('stroke')==='none'&&oldLand.getAttribute('mask')==='url(#capture-reveal)','Old border remains');
      assert(document.querySelectorAll('.capture-animation path').length===1,'Separate winner patch could leave a seam');
      const initial=front.getAttribute('d');
      frames.shift()(earlyTimestamp);
      assert(front.getAttribute('d')===initial,'Early frame changed the reveal');
      const start=performance.now();frames.shift()(start+500);
      assert(front.getAttribute('d')!==initial&&front.getAttribute('d').includes('C')&&!/NaN|Infinity/.test(front.getAttribute('d')),'Flood front did not develop smooth irregular edges');
      frames.shift()(start+2000);await completed;
      assert(!document.querySelector('.capture-animation')&&!document.querySelector('#capture-reveal')&&!document.getElementById('random').disabled,'Capture did not clean up');
    }finally{window.requestAnimationFrame=savedRAF;window.matchMedia=()=>({matches:true});app.undo();app.clear();}
  });
  await test('Remaining-team milestones appear only after claiming finishes',async()=>{
    const popup=document.getElementById('milestone'),savedRAF=window.requestAnimationFrame;
    try{
      for(const remaining of [100,75,50,25,10,5]){
        while(E.survivors(app.state).length>remaining+1)E.resolve(app.state,'333',E.survivors(app.state).find(id=>id!=='333'));
        app.clear();app.choose('333');app.choose(E.survivors(app.state).find(id=>id!=='333'));
        const frames=[];window.matchMedia=()=>({matches:false});window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};
        const completed=app.win('333');
        assert(E.survivors(app.state).length===remaining&&popup.hidden,'Popup appeared during claiming');
        frames.shift()(performance.now()+2000);await completed;
        assert(!popup.hidden&&document.getElementById('milestone-message').textContent===`${remaining} teams remaining`&&!document.querySelector('.capture-animation'),'Missing milestone after claiming');
        window.requestAnimationFrame=savedRAF;window.matchMedia=()=>({matches:true});
        assert(document.activeElement===document.getElementById('random')&&!document.getElementById('random').disabled,'Milestone blocked the next round or stole focus');
        app.choose('333');assert(app.attacker==='333','Milestone blocked team selection');
        if(remaining===100){await new Promise(resolve=>setTimeout(resolve,3400));assert(popup.hidden,'Milestone did not automatically dismiss');}
        document.getElementById('close-milestone').click();
        assert(popup.hidden&&!document.getElementById('random').disabled&&document.activeElement===document.getElementById('random'),'Close did not restore play');
        app.choose('333');app.choose(E.survivors(app.state).find(id=>id!=='333'));await app.win('333');
        assert(popup.hidden,'Non-milestone elimination showed popup');
        app.undo();app.undo();assert(popup.hidden,'Undo retained popup');
      }
    }finally{
      window.requestAnimationFrame=savedRAF;window.matchMedia=()=>({matches:true});
      while(app.state.history.length)app.undo();app.clear();
    }
  });
  await test('College championship theme follows the final two, winner, and undo',async()=>{
    try{
      while(E.survivors(app.state).length>2)E.resolve(app.state,'333',E.survivors(app.state).find(id=>id!=='333'));
      app.clear();
      assert(document.body.classList.contains('championship-mode'),'Final two theme missing');
      assert(getComputedStyle(document.querySelector('.map-wrap')).backgroundColor==='rgb(51, 51, 51)','Background is not button charcoal');
      assert(getComputedStyle(document.getElementById('random')).backgroundColor==='rgb(229, 189, 98)','Final button is not gold');
      app.choose('333');app.choose(E.survivors(app.state).find(id=>id!=='333'));
      assert(document.querySelector('#draw-preview .championship-heading').textContent==='National Championship','Final matchup heading missing');
      await app.win('333');
      assert(document.getElementById('winner-dialog').open,'Champion announcement missing');
      assert(document.getElementById('winner-title').textContent==='National Champions','Champion title missing');
      assert(document.querySelector('.champion strong').textContent===app.teams.find(t=>t.id==='333').name&&document.querySelector('.champion img').src===app.teams.find(t=>t.id==='333').logo,'Champion identity wrong');
      document.getElementById('close-winner').click();
      const championMarker=[...document.querySelectorAll('.team-marker')].find(el=>el.__data__.id==='333');
      championMarker.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      assert(app.attacker==='333'&&!document.getElementById('draw-preview').hidden&&!document.getElementById('winner-dialog').open,'Champion cannot be selected after dismissing announcement');
      assert(document.querySelector('#draw-preview .award-badge:not(.rivalry-badge)')&&document.querySelector('#draw-preview .rivalry-badge'),'Champion awards and rivalries missing');
      const finalHistory=app.state.history.length;await app.spin();assert(app.state.history.length===finalHistory,'Champion selection started another round');
      assert(document.getElementById('random').textContent==='Start a new campaign','Champion selection changed restart button');
      app.choose('333');assert(!app.attacker,'Champion cannot be deselected');
      app.undo();assert(document.body.classList.contains('championship-mode')&&!document.getElementById('winner-dialog').open,'Undo final did not restore final two');
      app.undo();assert(!document.body.classList.contains('championship-mode'),'Theme persisted with three teams');
    }finally{while(app.state.history.length)app.undo();app.clear();}
  });
  await test('Selector can land near either edge of the selected card',async()=>{
    const originalRandom=Math.random;
    try{for(const value of [0,.999]){
      Math.random=()=>value;await document.getElementById('random').onclick();
      const dialog=document.getElementById('draw-dialog');dialog.showModal();
      const card=document.querySelector('.draw-chosen').getBoundingClientRect(),windowBounds=document.getElementById('draw-window').getBoundingClientRect();
      const fraction=(windowBounds.x+windowBounds.width/2-card.x)/card.width;
      assert(Math.abs(fraction-(.08+value*.84))<.02,'Landing is centered or outside chosen card');
      dialog.close();app.clear();
    }}finally{Math.random=originalRandom;document.getElementById('draw-dialog').close();app.clear();}
  });
  await test('Selected-team panel survives spinning and notifications stay invisible',async()=>{
    app.choose('333');assert(!document.getElementById('draw-preview').hidden,'Selected team missing');
    const pending=app.spin();assert(!document.getElementById('draw-preview').hidden,'Spin hid selected team');await pending;
    const box=document.getElementById('notice').getBoundingClientRect();assert(box.width<=1&&box.height<=1,'Visible notification remains');
    if(app.state.history.length)app.undo();app.clear();
  });
  await test('Territory rendering seals antialiasing seams at shared edges',async()=>{
    const edges=new Map(),samples=[];
    for(const cell of app.cells){const polygon=cell.polygon;
      for(let i=0;i<polygon.length-1;i++){
        const a=polygon[i],b=polygon[i+1],key=[a.join(','),b.join(',')].sort().join('|');
        if(edges.has(key)){
          const p=[(a[0]+b[0])/2,(a[1]+b[1])/2];
          if(Math.hypot(a[0]-b[0],a[1]-b[1])>2&&[[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(d=>E.inRings([p[0]+d[0],p[1]+d[1]],cell.rings)))samples.push(p);
        }else edges.set(key,true);
      }
    }
    assert(samples.length>50,'Insufficient shared-edge samples');
    const layer=document.querySelector('.territories').cloneNode(true),canvas=document.createElement('canvas');canvas.width=3180;canvas.height=1950;
    const context=canvas.getContext('2d'),img=new Image(),url=URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="3180" height="1950" viewBox="0 0 1060 650">${layer.outerHTML}</svg>`],{type:'image/svg+xml'}));
    try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});context.drawImage(img,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
      const gaps=samples.filter(p=>pixels[(Math.floor(p[1]*3)*canvas.width+Math.floor(p[0]*3))*4+3]<245);
      assert(gaps.length<samples.length*.01,`${gaps.length} of ${samples.length} shared edges show background`);
    }finally{URL.revokeObjectURL(url);}
  });
  await test('Zoomed-out logos stay within three quarters of their radius of home',()=>{
    const map=d3.select('#map');map.call(app.zoom.transform,d3.zoomIdentity);app.clear();
    const matrix=map.node().getScreenCTM();
    for(const marker of document.querySelectorAll('.team-marker')){
      if(marker.style.display==='none')continue;
      const home=new DOMPoint(...marker.__data__.point).matrixTransform(matrix),badge=marker.getScreenCTM();
      const width=marker.querySelector('circle').getBoundingClientRect().width;
      assert(Math.hypot(home.x-badge.e,home.y-badge.f)<=width*.375+.1,'Logo drifted from '+marker.__data__.name);
    }
  });
  await test('Oklahoma hometown territories remain connected and own the panhandle accurately',()=>{
    const ok=app.cells.filter(c=>c.state==='OK');
    assert(ok.every(c=>c.geometry.length===1),'Disconnected Oklahoma territory');
    const panhandle=app.projection([-102.5,36.7]);
    const owner=ok.find(c=>E.inRings(panhandle,c.rings));
    assert(owner?.id==='197','Panhandle not connected to Oklahoma State');
    const hit=E.firstHit(panhandle,0,'201',ok,app.state.owners);
    assert(hit?.id==='197'&&hit.distance===0,'Arrow disagrees with repaired ownership');
    assert(ok.every(c=>E.inRings(app.teams.find(t=>t.id===c.id).point,c.rings)),'Hometown lost in repair');
  });
  await test('Panning moves every logo with the map without an artificial edge zone',()=>{
    const map=d3.select('#map'),start=d3.zoomIdentity.translate(-600,-400).scale(3);
    const positions=()=>new Map([...document.querySelectorAll('.team-marker')].filter(el=>el.style.display!=='none').map(el=>{const m=map.node().getScreenCTM().inverse().multiply(el.getScreenCTM());return [el.__data__.id,[m.e,m.f]];}));
    const observer=new MutationObserver(()=>{});
    try{
      map.call(app.zoom.transform,start);const before=positions();
      observer.observe(document.querySelector('.markers'),{subtree:true,attributes:true});
      assert(before.size===E.survivors(app.state).length,'Offscreen logos prematurely hidden');
      for(const [dx,dy] of [[-700,0],[700,0],[0,-700],[0,700]]){
        map.call(app.zoom.transform,d3.zoomIdentity.translate(start.x+dx,start.y+dy).scale(start.k));
        const after=positions();assert(after.size===before.size,'Panning removed logos');
        for(const [id,p] of before){const q=after.get(id);assert(Math.abs(q[0]-p[0]-dx)<.01&&Math.abs(q[1]-p[1]-dy)<.01,'Edge pushed logo away from '+id);}
        assert(observer.takeRecords().every(record=>record.target===document.querySelector('.markers')),'Panning rewrote individual badge layouts');
      }
    }finally{observer.disconnect();map.call(app.zoom.transform,d3.zoomIdentity);}
  });
  await test('Hover leaves territory paint order and selection unchanged',()=>{
    const territory=document.querySelector('.territory');
    const next=territory.nextElementSibling,selection=document.querySelector('.territory-selection').innerHTML;
    territory.dispatchEvent(new Event('pointerenter'));
    assert(territory.nextElementSibling===next,'Hover changed territory paint order');
    assert(document.querySelector('.territory-selection').innerHTML===selection,'Hover changed selection effects');
  });
  await test('FCS toggle rebuilds empty states, caps representatives and preserves hometowns',()=>{
    const originalConfirm=window.confirm;window.confirm=()=>true;
    try{
      document.getElementById('reset-map').click();
      const toggle=document.getElementById('include-fcs');
      assert(!document.getElementById('fcs-option').hidden,'Hidden before first round');
      toggle.checked=true;toggle.dispatchEvent(new Event('change'));
      assert(app.teams.length===144&&app.state.includeFcs,'FCS roster not enabled');
      for(const [code,count] of [['ME',1],['NH',1],['RI',1],['SD',1],['MT',2]]){
        assert(app.teams.filter(t=>t.state===code).length===count,code+' roster count');
        assert(!app.neutralIds.includes('state:'+code),code+' still neutral');
      }
      assert(app.neutralIds.includes('state:VT'),'Vermont must remain neutral');
      for(const t of app.teams)assert(app.cells.some(c=>c.id===t.id&&E.inside(t.point,c.polygon)&&E.inRings(t.point,c.rings)),t.name+' outside own territory');
      assert(E.valid(app.state,app.teams,app.neutralIds),'Invalid fresh FCS save');
      toggle.checked=false;toggle.dispatchEvent(new Event('change'));
      assert(app.teams.length===138&&app.neutralIds.includes('state:MT'),'FBS map not restored');
      toggle.checked=true;toggle.dispatchEvent(new Event('change'));
    }finally{window.confirm=originalConfirm;}
  });
  await test('FCS option locks after a result, saves results and returns on reset',async()=>{
    app.choose('149');app.choose('147');await app.win('149');
    assert(document.getElementById('fcs-option').hidden,'Option visible after round');
    const saved=JSON.parse(JSON.stringify(app.state));
    assert(saved.includeFcs&&E.loadCampaign(saved,app.teams,app.neutralIds)?.owners['147']==='149','FCS result not reloadable');
    const toggle=document.getElementById('include-fcs');toggle.checked=false;toggle.dispatchEvent(new Event('change'));
    assert(toggle.checked&&app.state.history.length===1&&app.teams.length===144,'Mid-campaign change accepted');
    const originalConfirm=window.confirm;window.confirm=()=>true;
    try{document.getElementById('reset-map').click();}finally{window.confirm=originalConfirm;}
    assert(!document.getElementById('fcs-option').hidden&&toggle.checked,'Reset did not restore option');
    E.claim(app.state,'149','state:VT');app.clear();
    assert(document.getElementById('fcs-option').hidden,'Option visible after neutral claim');
    app.undo();
    toggle.checked=false;toggle.dispatchEvent(new Event('change'));
    assert(E.valid(app.state,app.teams,app.neutralIds)&&app.teams.length===138,'Invalid restored FBS campaign');
  });
  window.matchMedia=browserMatchMedia;
  output.textContent+=`\n${passed} passed; ${failed} failed.`;output.dataset.failed=failed;document.title=`Tests: ${passed} passed, ${failed} failed`;
})();
