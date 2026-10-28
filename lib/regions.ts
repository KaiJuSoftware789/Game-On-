export function regionFromTimeZone(zone: string): string {
  if (zone.startsWith("US/") || zone.startsWith("Canada/") || zone.startsWith("Mexico/")) return "North America";
  if (zone.startsWith("America/")) {
    const location = zone.slice(8);
    if (/^(Argentina\/|Brazil\/|Araguaina$|Asuncion$|Bahia$|Belem$|Boa_Vista$|Bogota$|Campo_Grande$|Caracas$|Cayenne$|Cuiaba$|Eirunepe$|Fortaleza$|Guayaquil$|Guyana$|La_Paz$|Lima$|Maceio$|Manaus$|Montevideo$|Noronha$|Paramaribo$|Porto_Acre$|Porto_Velho$|Punta_Arenas$|Recife$|Rio_Branco$|Santarem$|Santiago$|Sao_Paulo$)/.test(location)) return "South America";
    return "North America";
  }
  if (zone.startsWith("Europe/") || ["Atlantic/Azores", "Atlantic/Canary", "Atlantic/Faeroe", "Atlantic/Faroe", "Atlantic/Madeira", "Atlantic/Reykjavik"].includes(zone)) return "Europe";
  if (zone.startsWith("Asia/")) return "Asia";
  if (zone.startsWith("Africa/")) return "Africa";
  if (zone.startsWith("Australia/") || zone.startsWith("Pacific/") || zone === "NZ" || zone === "NZ-CHAT") return "Oceania";
  return "Any region";
}
