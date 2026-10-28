export const gamingPlatforms = [
  {id:"discord",name:"Discord",example:"username"},
  {id:"activision",name:"Activision",example:"Player#1234567"},
  {id:"riot",name:"Riot Games",example:"Player#NA1"},
  {id:"steam",name:"Steam",example:"Steam ID or friend code"},
  {id:"xbox",name:"Xbox",example:"Gamertag"},
  {id:"playstation",name:"PlayStation",example:"Online ID"},
  {id:"battlenet",name:"Battle.net",example:"Player#1234"},
  {id:"epic",name:"Epic Games",example:"Display name"},
  {id:"ea",name:"EA",example:"EA ID"},
  {id:"ubisoft",name:"Ubisoft",example:"Username"},
  {id:"nintendo",name:"Nintendo",example:"SW-1234-5678-9012"},
] as const;
export function cleanGamingAccounts(accounts:Record<string,string>):Record<string,string>{
 return Object.fromEntries(gamingPlatforms.map(p=>[p.id,(accounts[p.id]??"").trim()]).filter(([,value])=>value));
}
