/* NFL roster: https://www.nfl.com/teams/
 * Approximate stadium-area anchors; shared-market teams use separate nearby
 * anchors to give both teams land. These are game seeds, not fan boundaries.
 * Logos are ESPN assets and belong to their respective owners.
 */
window.MAP_EDITION = 'nfl';
// Home-stadium states: both New York teams play in NJ; Washington plays in MD.
const nflHomeStates = {
  ari:'AZ',atl:'GA',bal:'MD',buf:'NY',car:'NC',chi:'IL',cin:'OH',cle:'OH',
  dal:'TX',den:'CO',det:'MI',gb:'WI',hou:'TX',ind:'IN',jax:'FL',kc:'MO',
  lv:'NV',lac:'CA',lar:'CA',mia:'FL',min:'MN',ne:'MA',no:'LA',nyg:'NJ',
  nyj:'NJ',phi:'PA',pit:'PA',sf:'CA',sea:'WA',tb:'FL',ten:'TN',wsh:'MD'
};
const nflTerritoryStates = {
  ne:['MA','ME','NH','VT','RI','CT'],
  car:['NC','SC'],
  kc:['MO','KS'],
  wsh:['MD','DC']
};
const nflCities = {
  ari:'Glendale',atl:'Atlanta',bal:'Baltimore',buf:'Orchard Park',car:'Charlotte',
  chi:'Chicago',cin:'Cincinnati',cle:'Cleveland',dal:'Arlington',den:'Denver',
  det:'Detroit',gb:'Green Bay',hou:'Houston',ind:'Indianapolis',jax:'Jacksonville',
  kc:'Kansas City',lv:'Las Vegas',lac:'Los Angeles',lar:'Los Angeles',
  mia:'Miami Gardens',min:'Minneapolis',ne:'Foxborough',no:'New Orleans',
  nyg:'East Rutherford',nyj:'East Rutherford',phi:'Philadelphia',pit:'Pittsburgh',
  sf:'Santa Clara',sea:'Seattle',tb:'Tampa',ten:'Nashville',wsh:'Landover'
};
window.TEAMS = [
  ['ari','Arizona Cardinals','#97233f',33.528,-112.263],
  ['atl','Atlanta Falcons','#a71930',33.755,-84.401],
  ['bal','Baltimore Ravens','#241773',39.278,-76.623],
  ['buf','Buffalo Bills','#00338d',42.774,-78.787],
  ['car','Carolina Panthers','#0085ca',35.226,-80.853],
  ['chi','Chicago Bears','#0b162a',41.862,-87.617],
  ['cin','Cincinnati Bengals','#fb4f14',39.105,-84.516],
  ['cle','Cleveland Browns','#311d00',41.506,-81.699],
  ['dal','Dallas Cowboys','#003594',32.748,-97.093],
  ['den','Denver Broncos','#fb4f14',39.744,-105.020],
  ['det','Detroit Lions','#0076b6',42.340,-83.046],
  ['gb','Green Bay Packers','#203731',44.501,-88.062],
  ['hou','Houston Texans','#03202f',29.685,-95.411],
  ['ind','Indianapolis Colts','#002c5f',39.760,-86.164],
  ['jax','Jacksonville Jaguars','#006778',30.324,-81.638],
  ['kc','Kansas City Chiefs','#e31837',39.049,-94.484],
  ['lv','Las Vegas Raiders','#000000',36.090,-115.183],
  ['lac','Los Angeles Chargers','#0080c6',33.820,-118.300],
  ['lar','Los Angeles Rams','#003594',34.160,-118.300],
  ['mia','Miami Dolphins','#008e97',25.958,-80.239],
  ['min','Minnesota Vikings','#4f2683',44.974,-93.258],
  ['ne','New England Patriots','#002244',42.091,-71.264],
  ['no','New Orleans Saints','#d3bc8d',29.951,-90.081],
  ['nyg','New York Giants','#0b2265',40.850,-74.080],
  ['nyj','New York Jets','#125740',40.720,-74.100],
  ['phi','Philadelphia Eagles','#004c54',39.901,-75.168],
  ['pit','Pittsburgh Steelers','#ffb612',40.447,-80.016],
  ['sf','San Francisco 49ers','#aa0000',37.403,-121.970],
  ['sea','Seattle Seahawks','#002244',47.595,-122.332],
  ['tb','Tampa Bay Buccaneers','#d50a0a',27.976,-82.503],
  ['ten','Tennessee Titans','#4b92db',36.166,-86.771],
  ['wsh','Washington Commanders','#5a1414',38.908,-76.864]
].map(([id,name,color,lat,lon])=>({id,name,fullName:name,abbr:id.toUpperCase(),color,city:nflCities[id],state:nflHomeStates[id],territoryStates:nflTerritoryStates[id]||[nflHomeStates[id]],lat,lon,logo:`https://a.espncdn.com/i/teamlogos/nfl/500/${id}.png`}));

// Original vector variants, including their built-in brand colors.
window.TEAMS.find(t=>t.id==='lar').logo='assets/logos/rams-yellow.svg';
window.TEAMS.find(t=>t.id==='nyg').logo='assets/logos/giants.svg';
window.TEAMS.find(t=>t.id==='nyj').logo='assets/logos/jets-white.svg';
