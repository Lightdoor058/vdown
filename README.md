# VDown

Ett 3D-överlevnadsspel i webbläsaren (Three.js + Vite).

**Ladda ner:** [zip](https://github.com/Lightdoor058/vdown/archive/refs/heads/main.zip) · [sida](https://lightdoor058.github.io/vdown/) · [GitHub](https://github.com/Lightdoor058/vdown)

**Story:** Du är Ciro, ingenjör på fraktskeppet Sparven. Du och din pilot Mikko gör sysslor ombord: ni kalibrerar navigeringen, testar generatorn, hämtar hans köttbullar och pratar om fotot på väggen. Sedan kommer en asteroid som *svänger* rakt mot er. Ni kraschar på Veyra och Mikko dör. Fyren är trasig, så du bygger en bas och ett minilabb. Du fångar en spindel, gör antigift, lagar pistolen och får igång rovern. Därefter hämtar du en sändare från Helions övergivna station och bygger om Fyren för att överleva.

## Starta

```bash
npm install
npm run dev
```

Öppna sedan adressen som visas (oftast http://localhost:5173).

## Dina modeller

Ligger i `public/models/` och laddas när spelet startar (`src/core/assets.js`):

| Fil | Används till |
|---|---|
| `mikko.fbx` | Mikko (blå), samt döda kroppar i andra färger |
| `ciro.fbx` | Ciro (röd), syns i mellansekvenserna |
| `spider.fbx` | Spindlarna (benen animeras med kod) |
| `plasma.fbx` | Plasmapistolen (i handen och på marken) |
| `medkit.fbx` | Medkit |

`public/textures/photo.webp` är fotot som hänger inramat i skeppet.
Byt en modell genom att ersätta filen med samma namn. Om skelettet får nya benamn uppdaterar du `HUMAN_BONES` / `SPIDER_BONES` i `src/entities/rig.js`.

## Var finns vad?

| Fil | Vad den gör |
|---|---|
| `src/main.js` | Startpunkt: laddar modeller, bygger världen, knappar/tangenter, spel-loopen, ljudmiljö |
| `src/core/` | Renderare + bloom (`render.js`), ljud (`audio.js`), modell-laddning (`assets.js`), hjälpfunktioner (`utils.js`) |
| `src/entities/rig.js` | Animationssystemet: poser och gångcykler för astronauter och spindlar |
| `src/entities/astronaut.js` | Astronauterna, gång längs vägpunkter, gester när de pratar |
| `src/entities/creatures.js` | Spindlarna: jakt, giftbett, bedövning, spawning |
| `src/entities/critters.js` | Små critters: greppa i huvudet, knäck nacken, grilla eller skjut |
| `src/entities/items.js` | Alla föremål (definitioner i `IDEF`) och deras fysik |
| `src/world/ship.js` | Sparven: cockpit, vardagsrum, minilabb, maskinrum, roverlåda |
| `src/world/planet.js` | Terräng och alla platser: Fyren, Ödla-lägret, boet, landaren Ikaros, gruvstation K-4, Helion Theta, radiomasten |
| `src/world/rover.js` | Rovern: lyfta ut, montera hjul, vrida nyckeln, köra |
| `src/world/props.js` | Lådor (dra upp locket), dörrar, spakar, syrestationer |
| `src/game/preflight.js` | Akt 1: uppgifterna med Mikko innan kraschen |
| `src/game/cutscenes.js` | Öppningen, asteroiden + kraschen + uppvaknandet, Mikko-ögonblicket, slutet |
| `src/game/objectives.js` | Uppdragskedjan på planeten + sidouppdrag |
| `src/game/lab.js` | Minilabbet: recept (blodanalys, antigift, sprutor, laga pistolen) |
| `src/game/burial.js` | Begrava Mikko: dra kroppen, gräva, fylla igen |
| `src/game/player.js` | Spelarens rörelse, överlevnad, interaktioner, vapnet |
| `src/game/story.js` | Loggar och lore |
| `src/ui/ui.js`, `src/ui/invui.js` | Pratbubblor, HUD, val, labbmeny, ryggsäcken |

## Kontroller

WASD gå · Shift spring · Mellanslag hoppa · E interagera · F lägg i ryggsäcken · TAB ryggsäck ·
håll vänster mus = greppa / dra lådlock (upp) / dra spakar (ner) / dra kroppar / gräv / vrid rovernyckeln (höger) ·
högerklick = kasta · G släpp · Q pistol · L ficklampa · Esc paus · Enter hoppa över mellansekvens.
Rovern: W/S gas/back, A/D sväng, mellanslag broms, E kliv ur.

## Felsökning

I webbläsarens konsol: `VDOWN.P` (spelaren), `VDOWN.S` (spelet), `VDOWN.F` (storyflaggor), `VDOWN.step(60)` (kör spelet 1 sekund framåt), `VDOWN.invAdd('wheel')` (lägg något i ryggsäcken).
