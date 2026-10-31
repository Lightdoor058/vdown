// Loretexter som hittas i världen (datapads och terminaler).
export const LORE = {
  mikko: {
    title: 'PERSONLIG LOGG — M. LIND',
    text: `Dag 61.

Helion ändrade vår rutt igen. Rakt förbi Veyra, genom kanten av asteroidbältet. "Bränsleoptimering", säger de.

Ingen optimerar bränsle genom ett asteroidbälte.

Jag har inte sagt något till Ciro än. Vill inte oroa i onödan. Det är säkert inget.

PS. Om någon läser det här: köttbullarna i kylen är MINA.`,
  },
  camp1: {
    title: 'EXPEDITION ÖDLA — DR. HANNA EK, DAG 14',
    text: `Kristallerna sjunger efter solnedgången. Ett lågt, nästan musikaliskt brum.

Skärvarna samlas kring dem som malar kring en lampa. De dras till energi och till ljud.

Vi har slutat använda Fyren på nätterna. Varje gång vi sänder kommer de.

Energicellerna förvarar vi i lådorna. Servona dog förra veckan, så nu får man bända upp locken för hand.`,
  },
  camp2: {
    title: 'EXPEDITION ÖDLA — DR. HANNA EK, DAG 31',
    text: `Helion svarar inte. Leveransen skulle ha kommit för tre veckor sedan.

Jonas säger att han såg ett skepp i omloppsbana i går natt. Det landade aldrig. Det bara... tittade.

Och mätarna. Gravitationen under oss pulserar, som om något därnere drar.

Jag tror inte att vi är de första Helion har skickat hit.

Jag tror inte att vi blir de sista.`,
  },
  nest: {
    title: 'KLOTTRAD ANTECKNING',
    text: `Om någon hittar det här:

Cellen fungerar fortfarande. Skärvarna har byggt sitt bo runt den. De ÄLSKAR energin.

Ta den och SPRING. Skjut inte om du inte måste, ljudet drar dit fler.

Säg till Hanna att jag försökte.

— J.`,
  },
  lander: {
    title: 'LANDARE IKAROS — SVART LÅDA',
    text: `PILOT: K. Okafor, Helion Logistik.

"Kontrollen, vi tappar höjd. Instrumenten säger att gravitationen ökar. Det är inte möjligt."

"Det drar i oss. Något DRAR i oss."

[SIGNAL BRUTEN]

Sista koordinat sparad. Last: tre energiceller till Theta-stationen.`,
  },
  mine: {
    title: 'GRUVSTATION K-4 — SKIFTRAPPORT',
    text: `Dag 112. Borren slog i något under kristallagret i morse. Metall. Inte vår.

Formann Lindqvist säger att vi ska fortsätta. Helion betalar dubbelt för varje meter.

Spindlarna har börjat komma upp ur borrhålet. Stora. Snabba.

Om du hittar min verktygslåda: den är din. Jag behöver den inte längre.`,
  },
  radio: {
    title: 'ÖDLA — DR. JONAS BERG, SISTA SÄNDNINGEN',
    text: `Den här masten var vår sista chans. Helion stängde ner den inifrån — fjärrkommando från omloppsbana.

De vill inte att någon ringer hem från Veyra.

Hanna, om du läser det här: Theta-stationen har en egen sändare. Helions. Den går inte att stänga av härifrån.

Ta den. Bygg om Fyren. Låt hela systemet höra oss.`,
  },
  theta: {
    title: 'HELION STATION THETA — INTERN LOGG',
    text: `Evakuering begärd: NEKAD.
Motivering: "Projekt MAGNET får inte avbrytas."

Gravitationsankaret har vaknat. Spindlarna verkar dras till det. Eller vakta det.

Vi har tre fungerande sändarmoduler. Kommendör Vale har beordrat att de ska förstöras.

Jag har gömt en i förrådslådan. Om någon som inte jobbar för Helion hittar den: använd den väl.

— Tekniker R. Amari`,
  },
  terminal: {
    title: 'HELION DYNAMICS — KONFIDENTIELLT',
    text: `PROJEKT MAGNET // STATUSRAPPORT

Gravitationsankaret under Veyras skorpa är fullt operativt. Mindre himlakroppar kan nu styras med 94 % precision.

TEST 6: Ödla-expeditionen. Överlevnad: 0 %. Data otillräcklig.

TEST 7: Fraktskeppet SV-7 "SPARVEN". Besättning: 2.
Omdirigerat via asteroid SK-1182.

MÅL: Verifiera om en besättning kan överleva landningen och återaktivera Fyren.
Om subjektet överlever: HÄMTA.
Om inte: skriv av som olycka.

— Kommendör R. Vale, Helion Säkerhet`,
  },
};

const NOTE_NAME = { red: 'RÖD', blue: 'BLÅ', green: 'GRÖN' };
export function noteDoc(extra = {}) {
  const seq = extra.seq || [];
  const lines = seq.map((c, i) => `${i + 1}.  ${NOTE_NAME[c] || c}`);
  return {
    title: 'NAV-KALIBRERING — STARTRUTIN',
    text: `SPARVEN SV-7  ·  Helion-manual 7-C
Handskriven kopia — M. Lind

Gör i exakt ordning. Missar du en, börja om från 1.

${lines.join('\n') || '(tom)'}

Knapparna sitter mitt på instrumentbrädan.
Röd / Blå / Grön.

Om du tappar lappen: fråga mig.`,
  };
}
