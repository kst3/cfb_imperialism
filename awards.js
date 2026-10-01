/* 2026 football conferences and named FBS games. Sources and scope: dev/README.md. */
(function(root){
  'use strict';
  const conferences={
    ACC:'103 25 228 150 52 59 97 2390 152 153 221 2567 24 183 258 259 154',
    'Big Ten':'356 84 2294 120 130 127 135 158 77 194 2483 213 2509 164 26 30 264 275',
    'Big 12':'12 9 239 252 2132 38 248 66 2305 2306 197 2628 2641 2116 254 277',
    SEC:'333 8 2 57 61 96 99 344 142 201 145 2579 2633 251 245 238',
    American:'349 2429 151 2226 235 2426 249 242 58 218 2655 202 5 2636',
    'Conference USA':'48 2229 55 338 2335 2393 2623 166 2534 98',
    MAC:'2006 2050 189 2084 2117 2199 2309 193 195 16 2649 113 2711',
    'Mountain West':'2005 62 2440 167 2449 2459 23 2439 2638 2751',
    'Pac-12':'68 36 278 204 21 326 328 265',
    'Sun Belt':'2026 2032 324 290 2247 256 309 2348 2433 276 295 6 2572 2653',
    Independent:'41 87',
    'CAA Football':'311 160 227',
    'Big Sky':'149 147',
    'Missouri Valley':'2571'
  };
  const conferenceById=Object.fromEntries(Object.entries(conferences).flatMap(([name,ids])=>ids.split(' ').map(id=>[id,name])));
  // One award per matchup; use the game name, or its named trophy when no nickname exists.
  const games=[
    ['100 Miles of Hate','2393','98'],['Ram-Falcon Trophy','2005','36'],['Kuter Trophy','2005','62'],['Wagon Wheel','2006','2309'],
    ['Apple Cup','264','265'],['Arch Rivalry','356','142'],['Golden Boot','8','99'],['Southwest Classic','8','245'],['Army-Navy Game','349','2426'],
    ['Backyard Brawl','221','277'],['Bronze Stalk Trophy','2050','2459'],['Battle for Highway 82','333','344'],['Battle for Nevada','2440','2439'],
    ['Battle for the Bell','2132','193'],['Battle for the Bell','276','195'],['Battle for the Bell','2572','2655'],['Battle for the Belt','6','2653'],
    ['Battle for the Bones','235','5'],['Battle for the Iron Skillet','2567','2628'],['Battle for the Land Grant','127','213'],
    ["Battle for the Ol' School Bell",'55','2653'],['Battle for the Palladium','2393','2653'],['Battle for the Rag','99','2655'],
    ['Battle for the Valley','278','23'],['Battle Line Rivalry','8','142'],['Battle of I-10','166','2638'],['Battle of the Blue Ridge','256','2335'],
    ['Battle of the Brazos','239','245'],['Battle of the Bricks','193','195'],['Battle of the Brothers','254','328'],['Battle of the Carolinas','153','2579'],
    ['Battle on the Bayou','309','2433'],['Bedlam','201','197'],['Big Game','25','24'],['Bill Walsh Legacy Game','23','24'],
    ['Black and Blue Bowl','235','2572'],['Bluebonnet Battle','239','2628'],['Milk Can','68','278'],['Border War','36','2751'],['Border War','2305','142'],
    ["O'Rourke-McFadden Trophy",'103','228'],['Anniversary Award','189','2309'],['Battle of I-75','189','2649'],["Bridger's Battle",'328','2751'],
    ['Flagship Cup','2084','113'],['Old Wagon Wheel','252','328'],['Victory Cannon','2117','2711'],['Keg of Nails','2132','97'],
    ['Clean, Old-Fashioned Hate','61','59'],['Crab Bowl Classic','120','2426'],['Deeper than Hate','2026','290'],["Deep South's Oldest Rivalry",'2','61'],
    ['Dick Tomey Legacy Game','62','23'],['Duel in the Desert','12','9'],['Victory Bell','150','153'],['Victory Barrel','151','152'],['Egg Bowl','344','145'],
    ['Farmageddon','66','2306'],['Makala Trophy','57','52'],["World's Largest Outdoor Cocktail Party",'57','61'],['Seminole War Canoe','57','2390'],
    ['Jefferson-Eppes Trophy','52','258'],['Frank Leahy Memorial Bowl','103','87'],['Golden Screwdriver','278','62'],['Oil Can','278','21'],
    ['Friends of Coal Bowl','276','277'],['Gold Cowbell','59','238'],['Paniolo Trophy','62','2751'],['Holy War','252','254'],['Bayou Bucket','248','242'],
    ['I-35 Rivalry','326','2636'],['Land of Lincoln Trophy','356','77'],['Illibuck','356','194'],['Purdue Cannon','356','2509'],
    ['Bourbon Barrel','84','96'],['Old Brass Spittoon','84','127'],['Old Oaken Bucket','84','2509'],['Cy-Hawk Trophy','2294','66'],
    ['Floyd of Rosedale','2294','135'],['Heroes Game','2294','158'],['Heartland Trophy','2294','275'],['Telephone Trophy','66','142'],['Iron Bowl','333','2'],
    ["Governor's Cup",'96','97'],['Keystone Classic','213','221'],['Lone Star Showdown','251','245'],['Schnellenberger Trophy','97','2390'],
    ['Magnolia Bowl','99','145'],['Paul Bunyan Trophy','130','127'],['Little Brown Jug','130','135'],['George Jewitt Trophy','130','77'],
    ['Megaphone Trophy','127','87'],['Mid-South Rivalry','235','145'],['$5 Bits of Broken Chair Trophy','135','158'],["Governor's Victory Bell",'135','213'],
    ["Paul Bunyan's Axe",'135','275'],['Victory Bell','142','158'],['Tiger-Sooner Peace Pipe','142','201'],["Mayor's Cup",'142','2579'],
    ['Modern Day Hate','290','2247'],['Gansz Trophy','2426','2567'],['Rip Miller Trophy','2426','87'],['Freedom Trophy','158','275'],
    ['Shillelagh Trophy','87','2509'],['Legends Trophy','87','24'],['Jeweled Shillelagh','87','30'],['Platypus Trophy','2483','204'],
    ['Paint Bucket Bowl','2032','235'],['Palmetto Bowl','228','2579'],['Red River Rivalry','201','251'],["Mayor's Cup",'242','2567'],
    ['Rio Grande Rivalry','167','166'],['Rivalry in Dixie','2348','2572'],['Rocky Mountain Showdown','38','36'],['Royal Rivalry','256','295'],
    ['Rumble in the Rockies','38','254'],['Safeway Bowl','249','2567'],['Shula Bowl','2226','2229'],["South's Oldest Rivalry",'153','258'],
    ['Sunflower Showdown','2305','2306'],['Ben Schwartzwalder Trophy','183','277'],['Saddle Trophy','2628','2641'],['Techmo Bowl','59','259'],
    ["Chancellor's Spurs",'251','2641'],['Textile Bowl','228','152'],['The Game','130','194'],['The Old Mountain Feud','2026','276'],
    ['Third Saturday in October','333','2633'],['Tiger Bowl','2','99'],['Victory Bell','26','30'],['Black Diamond Trophy','259','277'],
    ['Commonwealth Cup','258','259'],['War on I-4','58','2116'],['Civil ConFLiCT','41','2116'],['Texas Shootout','239','2641']
  ].map(([name,...teams])=>({id:'rivalry:'+teams.slice().sort().join(':'),name,teams}));
  const specials=[
    ['free-real-estate','Free real estate','Personally claim two previously unowned territories. Taking land from another team does not count.'],
    ['pacific-hoarder','Pacific Hoarder','As a team from California, Oregon, Washington, or Hawaii, own every territory in all four states at the same time.'],
    ['coast-to-coast','Coast to Coast','Be the first team to own territory touching both the Atlantic and Pacific coasts at the same time.'],
    ['perfect-season','Perfect Season','Win 12 games in one campaign. Unclaimed land does not count as a win.'],
    ['dont-mind-me',"Don't mind me",'Still be on the map with zero wins when only 5 teams remain.'],
    ['lone-star','Lone Star','As a Texas team, own every starting territory in Texas.'],
    ['president','President','Be the team that first claims unclaimed Washington, D.C.']
  ].map(([id,name,description])=>({id,name,description}));
  function catalog(teams){
    const byId=Object.fromEntries(teams.map(t=>[t.id,t]));
    return [...specials,...[...new Set(teams.map(t=>conferenceById[t.id]).filter(c=>c&&c!=='Independent'))].map(c=>({id:'conference:'+c,name:'Represent '+c,description:'Be the last surviving '+c+' team in this campaign.'})),
      ...games.filter(g=>g.teams.every(id=>byId[id])).map(g=>({...g,description:g.teams.map(id=>byId[id].name).join(' vs. ')+': win their head-to-head game.'}))];
  }
  // Replay keeps awards with their earner, even after elimination; no save migration needed.
  function evaluate(state,teams,territories){
    const byId=Object.fromEntries(teams.map(t=>[t.id,t])),earned=Object.fromEntries(teams.map(t=>[t.id,[]]));
    const wins=Object.fromEntries(teams.map(t=>[t.id,0]));
    const claims=Object.fromEntries(teams.map(t=>[t.id,new Set()]));
    const pacificStates=['CA','OR','WA','HI'],pacific=territories.filter(t=>pacificStates.includes(t.state));
    const hasPacificStates=pacificStates.every(state=>pacific.some(t=>t.state===state));
    let coastWinner=null;
    const owners=Object.fromEntries(Object.keys(state.owners).map(id=>[id,byId[id]?id:null]));
    const grant=(team,id,round)=>{if(!earned[team].some(a=>a.id===id))earned[team].push({id,round});};
    function check(round){
      const alive=[...new Set(Object.values(owners).filter(Boolean))],coasts={},conference={};
      for(const id of alive){coasts[id]=new Set();const c=conferenceById[id];if(c&&c!=='Independent')(conference[c]??=[]).push(id);}
      for(const t of territories){const id=owners[t.id];if(!id)continue;for(const coast of t.coasts||[])coasts[id].add(coast);}
      if(alive.length===5)for(const id of alive)if(!wins[id])grant(id,'dont-mind-me',round);
      for(const id of alive){
        if(wins[id]>=12)grant(id,'perfect-season',round);
        if(claims[id].size>=2)grant(id,'free-real-estate',round);
        if(pacificStates.includes(byId[id].state)&&hasPacificStates&&pacific.every(t=>owners[t.id]===id))grant(id,'pacific-hoarder',round);
        if(coastWinner===null&&coasts[id].has('east')&&coasts[id].has('west')){coastWinner=id;grant(id,'coast-to-coast',round);}
        const texas=territories.filter(t=>t.state==='TX');
        if(byId[id].state==='TX'&&texas.length&&texas.every(t=>owners[t.id]===id))grant(id,'lone-star',round);
      }
      for(const [c,ids] of Object.entries(conference))if(ids.length===1)grant(ids[0],'conference:'+c,round);
    }
    check(0);
    state.history.forEach((entry,index)=>{
      const round=index+1;
      if(entry.loser===null)for(const id of entry.captured)if(owners[id]===null)claims[entry.winner].add(id);
      for(const id of entry.captured)owners[id]=entry.winner;
      if(entry.loser===null){if(entry.captured.includes('state:DC'))grant(entry.winner,'president',round);}
      else{
        wins[entry.winner]++;
        for(const g of games)if(g.teams.includes(entry.winner)&&g.teams.includes(entry.loser))grant(entry.winner,g.id,round);
      }
      check(round);
    });
    return earned;
  }
  root.EmpireAwards={conferenceById,games,catalog,evaluate};
})(globalThis);
