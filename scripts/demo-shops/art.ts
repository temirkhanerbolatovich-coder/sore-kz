// Плоские иллюстрации товаров демо-магазинов в стиле public/demo/*.svg: 600×600, фон, «тарелка», простые фигуры.
// Без текста и шрифтов: sharp (librsvg) рисует их одинаково на любой машине.

export type Art =
  | "baursak" | "samsa" | "flatbread" | "chakchak" | "layercake" | "gift"
  | "roses" | "tulips" | "wildflowers" | "flowerbox" | "plant"
  | "cups" | "slippers" | "dombra" | "shanyrak" | "rug"
  | "bucket" | "sofa" | "window" | "carpet"
  | "soap" | "tube" | "jar" | "balm" | "bottle"
  | "kazy" | "kurt" | "kumys" | "honey" | "smetana" | "irimshik" | "shuzhuk";

type Palette = { bg: string; accent?: string };

const plate = (y = 470, w = 230) =>
  `<ellipse cx="300" cy="${y}" rx="${w}" ry="48" fill="#ffffff" opacity=".9"/><ellipse cx="300" cy="${y - 8}" rx="${w - 30}" ry="38" fill="#f4ede4"/>`;
const shadow = (y = 500, w = 200) => `<ellipse cx="300" cy="${y}" rx="${w}" ry="26" fill="#000" opacity=".08"/>`;

/** Круглые «шарики»: баурсаки, курт, ірімшік. */
const pile = (fill: string, dark: string, r = 34) => {
  const pts = [[200, 410], [270, 418], [340, 414], [410, 408], [235, 360], [305, 362], [375, 358], [270, 308], [340, 306], [305, 258]];
  return plate() + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/><circle cx="${x - 9}" cy="${y - 10}" r="${r / 3.5}" fill="#fff" opacity=".35"/><path d="M${x - r + 6} ${y + 8}a${r - 6} ${r - 6} 0 0 0 ${2 * (r - 6)} 0" fill="none" stroke="${dark}" stroke-width="5" opacity=".35"/>`).join("");
};

const jar = (body: string, lid: string, label = "#ffffff") =>
  shadow(498, 150) +
  `<rect x="190" y="200" width="220" height="300" rx="40" fill="${body}"/><rect x="200" y="210" width="40" height="270" rx="20" fill="#fff" opacity=".25"/>` +
  `<rect x="180" y="160" width="240" height="60" rx="16" fill="${lid}"/><rect x="225" y="300" width="150" height="110" rx="14" fill="${label}" opacity=".92"/>` +
  `<rect x="250" y="335" width="100" height="10" rx="5" fill="${lid}" opacity=".7"/><rect x="265" y="360" width="70" height="10" rx="5" fill="${lid}" opacity=".45"/>`;

const bottle = (body: string, cap: string) =>
  shadow(505, 120) +
  `<rect x="265" y="110" width="70" height="70" rx="10" fill="${cap}"/><path d="M270 180h60v40c0 10 70 40 70 90v170a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V310c0-50 70-80 70-90z" fill="${body}"/>` +
  `<rect x="225" y="330" width="150" height="100" rx="12" fill="#fff" opacity=".9"/><rect x="250" y="365" width="100" height="10" rx="5" fill="${cap}" opacity=".7"/><rect x="216" y="300" width="22" height="160" rx="11" fill="#fff" opacity=".25"/>`;

const bouquet = (flowers: string[], leaf = "#5f8f4e", wrap = "#f6e7d8") => {
  const heads = [[300, 200], [235, 230], [365, 230], [265, 280], [335, 280], [200, 290], [400, 290], [300, 255]];
  return (
    `<path d="M300 520 230 300h140z" fill="${leaf}"/>` +
    `<path d="M300 540 170 300h260z" fill="${wrap}"/><path d="M300 540 170 300h40l90 240z" fill="#000" opacity=".06"/>` +
    heads.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="44" fill="${flowers[i % flowers.length]}"/><circle cx="${x}" cy="${y}" r="16" fill="#000" opacity=".12"/>`).join("") +
    `<path d="M255 420q45 30 90 0" fill="none" stroke="#c0392b" stroke-width="12" stroke-linecap="round"/>`
  );
};

const ART: Record<Art, (p: Palette) => string> = {
  baursak: () => pile("#d9a35a", "#8a5a1e"),
  kurt: () => pile("#f3efe3", "#b9ab8a", 30),
  irimshik: () => pile("#e8c98f", "#a3793a", 30),
  samsa: () =>
    plate() +
    [[210, 380], [390, 380], [300, 330]].map(([x, y]) => `<path d="M${x - 95} ${y + 60}L${x} ${y - 80}L${x + 95} ${y + 60}Q${x} ${y + 85} ${x - 95} ${y + 60}z" fill="#d89a4a"/><path d="M${x - 40} ${y}l40 -50 40 50" fill="none" stroke="#a8692a" stroke-width="6" opacity=".5"/><g fill="#3b2a1a" opacity=".55"><circle cx="${x - 20}" cy="${y + 30}" r="4"/><circle cx="${x + 15}" cy="${y + 20}" r="4"/><circle cx="${x}" cy="${y + 45}" r="4"/></g>`).join(""),
  flatbread: () =>
    shadow(470, 230) +
    `<circle cx="300" cy="320" r="200" fill="#d9a35a"/><circle cx="300" cy="320" r="120" fill="#e9c27f"/>` +
    Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return `<circle cx="${300 + Math.cos(a) * 80}" cy="${320 + Math.sin(a) * 80}" r="7" fill="#9a6526"/>`;
    }).join("") +
    `<circle cx="300" cy="320" r="10" fill="#9a6526"/><circle cx="300" cy="320" r="160" fill="none" stroke="#b97f35" stroke-width="10" opacity=".5"/>`,
  chakchak: () =>
    plate() +
    `<path d="M140 450Q300 120 460 450z" fill="#e2a84f"/>` +
    Array.from({ length: 40 }, (_, i) => `<rect x="${170 + ((i * 53) % 260)}" y="${250 + ((i * 37) % 180)}" width="34" height="14" rx="7" fill="#f2cf7d" transform="rotate(${(i * 47) % 180} ${187 + ((i * 53) % 260)} ${257 + ((i * 37) % 180)})"/>`).join("") +
    `<path d="M200 330q100 -60 200 0" fill="none" stroke="#fff" stroke-width="10" opacity=".35" stroke-linecap="round"/>`,
  layercake: () =>
    plate() +
    [230, 276, 322, 368, 414].map((y, i) => `<rect x="120" y="${y}" width="360" height="48" rx="14" fill="${i % 2 ? "#f7e7c0" : "#c98a3a"}"/>`).join("") +
    `<ellipse cx="300" cy="232" rx="180" ry="32" fill="#a86b2a"/><g fill="#e0a458"><circle cx="210" cy="226" r="9"/><circle cx="270" cy="222" r="9"/><circle cx="330" cy="222" r="9"/><circle cx="390" cy="226" r="9"/></g>`,
  gift: ({ accent = "#c0392b" }) =>
    shadow(500, 190) +
    `<rect x="130" y="250" width="340" height="240" rx="18" fill="#f6e7d8"/><rect x="115" y="200" width="370" height="70" rx="16" fill="#efd9c2"/>` +
    `<rect x="275" y="200" width="50" height="290" fill="${accent}"/><path d="M300 200c-60-90-150-40-90 0zM300 200c60-90 150-40 90 0z" fill="${accent}"/>`,
  roses: () => bouquet(["#c0392b", "#e74c5f", "#a93226"]),
  tulips: () =>
    `<path d="M300 540 170 300h260z" fill="#f2f0e6"/>` +
    [[230, 230], [300, 200], [370, 230], [265, 275], [335, 275]].map(([x, y]) => `<path d="M${x} ${y + 120}V${y + 30}" stroke="#4e8a3e" stroke-width="10"/><path d="M${x - 34} ${y}q0 50 34 60q34 -10 34 -60l-17 18 -17 -24 -17 24z" fill="#f39c12"/>`).join("") +
    `<path d="M255 420q45 30 90 0" fill="none" stroke="#e67e22" stroke-width="12" stroke-linecap="round"/>`,
  wildflowers: () => bouquet(["#f4d03f", "#ffffff", "#8e7cc3", "#e59866"], "#6a9a52", "#e9e2cf"),
  flowerbox: () =>
    shadow(505, 190) +
    [[200, 260], [260, 230], [330, 235], [395, 262], [235, 300], [300, 290], [365, 300]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="46" fill="${["#e8a0b4", "#f6d6de", "#c0392b", "#f5b7b1"][i % 4]}"/><circle cx="${x}" cy="${y}" r="15" fill="#000" opacity=".1"/>`).join("") +
    `<rect x="140" y="310" width="320" height="190" rx="14" fill="#2c3e50"/><rect x="140" y="310" width="320" height="24" fill="#000" opacity=".15"/><rect x="250" y="390" width="100" height="10" rx="5" fill="#d4ac0d"/>`,
  plant: () =>
    shadow(505, 140) +
    [[-60, 230, -30], [60, 230, 30], [-100, 300, -55], [100, 300, 55], [0, 190, 0]].map(([dx, y, r]) => `<g transform="rotate(${r} 300 380)"><ellipse cx="${300 + dx / 3}" cy="${y}" rx="62" ry="100" fill="#2e7d4f"/><path d="M${300 + dx / 3} ${y - 90}V${y + 90}" stroke="#1e5a37" stroke-width="5"/></g>`).join("") +
    `<path d="M200 370h200l-25 140H225z" fill="#c8693c"/><rect x="190" y="360" width="220" height="30" rx="8" fill="#b35a30"/>`,
  cups: () =>
    shadow(470, 230) +
    [[180, 360], [300, 340], [420, 360]].map(([x, y]) => `<path d="M${x - 75} ${y - 60}h150l-20 110a20 20 0 0 1-20 16h-70a20 20 0 0 1-20-16z" fill="#ffffff"/><path d="M${x - 70} ${y - 30}h140" stroke="#1f6fb2" stroke-width="14"/><g fill="#d4ac0d"><circle cx="${x - 40}" cy="${y + 10}" r="8"/><circle cx="${x}" cy="${y + 14}" r="8"/><circle cx="${x + 40}" cy="${y + 10}" r="8"/></g><path d="M${x - 70} ${y - 30}h140" stroke="#1f6fb2" stroke-width="14" opacity=".001"/>`).join(""),
  slippers: () =>
    shadow(480, 220) +
    [[220, -8], [380, 8]].map(([x, r]) => `<g transform="rotate(${r} ${x} 330)"><rect x="${x - 70}" y="170" width="140" height="300" rx="70" fill="#8e5b3a"/><path d="M${x - 70} 330a70 70 0 0 0 140 0v-90a70 70 0 0 0 -140 0z" fill="#c69c6d"/><path d="M${x - 40} 260q40 -40 80 0q-40 40 -80 0z" fill="#c0392b"/></g>`).join(""),
  dombra: () =>
    shadow(520, 140) +
    `<g transform="rotate(-28 300 330)"><rect x="285" y="60" width="30" height="300" rx="10" fill="#7a4a24"/><ellipse cx="300" cy="420" rx="95" ry="120" fill="#b06a35"/><ellipse cx="300" cy="420" rx="70" ry="95" fill="#c98448"/><circle cx="300" cy="400" r="18" fill="#5b3418"/>` +
    `<path d="M294 70V520M306 70V520" stroke="#f5f5f5" stroke-width="2"/><rect x="278" y="60" width="44" height="40" rx="8" fill="#5b3418"/><rect x="270" y="480" width="60" height="10" rx="4" fill="#5b3418"/></g>`,
  shanyrak: () =>
    shadow(470, 180) +
    `<circle cx="300" cy="300" r="190" fill="#d4ac0d"/><circle cx="300" cy="300" r="150" fill="#1f6fb2"/><circle cx="300" cy="300" r="60" fill="#d4ac0d"/>` +
    `<path d="M300 150v300M150 300h300M195 195l210 210M405 195 195 405" stroke="#d4ac0d" stroke-width="14"/><circle cx="300" cy="300" r="34" fill="#1f6fb2"/>`,
  rug: () =>
    shadow(500, 230) +
    `<rect x="110" y="140" width="380" height="350" rx="10" fill="#a93226"/><rect x="140" y="170" width="320" height="290" fill="none" stroke="#f5cba7" stroke-width="10"/>` +
    `<path d="M300 210l70 105-70 105-70-105z" fill="#f5cba7"/><path d="M300 255l40 60-40 60-40-60z" fill="#1f6fb2"/>` +
    `<g fill="#f5cba7"><circle cx="190" cy="220" r="14"/><circle cx="410" cy="220" r="14"/><circle cx="190" cy="410" r="14"/><circle cx="410" cy="410" r="14"/></g>`,
  bucket: ({ accent = "#2e86c1" }) =>
    shadow(505, 160) +
    `<path d="M170 250h260l-30 250H200z" fill="${accent}"/><rect x="160" y="235" width="280" height="30" rx="12" fill="#1b4f72"/>` +
    `<path d="M190 250q110 -170 220 0" fill="none" stroke="#7f8c8d" stroke-width="10"/><g fill="#d6eaf8"><circle cx="230" cy="215" r="28"/><circle cx="280" cy="195" r="34"/><circle cx="340" cy="205" r="30"/><circle cx="385" cy="220" r="22"/></g>` +
    `<rect x="380" y="90" width="22" height="200" rx="8" fill="#a04000" transform="rotate(18 391 190)"/>`,
  sofa: () =>
    shadow(495, 230) +
    `<rect x="120" y="200" width="360" height="160" rx="30" fill="#5d6d7e"/><rect x="95" y="290" width="410" height="140" rx="30" fill="#85929e"/>` +
    `<rect x="80" y="260" width="70" height="190" rx="30" fill="#5d6d7e"/><rect x="450" y="260" width="70" height="190" rx="30" fill="#5d6d7e"/>` +
    `<g fill="#d6eaf8" opacity=".9"><circle cx="210" cy="240" r="16"/><circle cx="250" cy="215" r="11"/><circle cx="400" cy="235" r="14"/></g><rect x="130" y="430" width="20" height="40" fill="#34495e"/><rect x="450" y="430" width="20" height="40" fill="#34495e"/>`,
  window: () =>
    `<rect x="140" y="110" width="320" height="380" rx="10" fill="#fdfefe"/><rect x="165" y="135" width="270" height="330" fill="#aed6f1"/>` +
    `<path d="M300 135v330M165 300h270" stroke="#fdfefe" stroke-width="16"/><path d="M190 230l60 -60M200 270l100 -100M330 420l70 -70" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".8"/>` +
    `<rect x="120" y="485" width="360" height="24" rx="6" fill="#d5d8dc"/>`,
  carpet: () =>
    shadow(470, 240) +
    `<path d="M110 200h330a50 50 0 0 1 50 50v170H110z" fill="#1f618d"/><circle cx="440" cy="420" r="60" fill="#154360"/><circle cx="440" cy="420" r="30" fill="#1f618d"/>` +
    `<path d="M140 230h270v160H140z" fill="none" stroke="#f5cba7" stroke-width="8"/><path d="M275 250l45 60-45 60-45-60z" fill="#f5cba7"/>` +
    `<g fill="#d6eaf8"><circle cx="180" cy="180" r="22"/><circle cx="230" cy="160" r="15"/></g>`,
  soap: () =>
    shadow(470, 220) +
    [[200, 360, -6, "#f5eee0"], [380, 350, 8, "#f0dcc4"], [290, 290, 0, "#faf3e8"]].map(([x, y, r, c]) => `<g transform="rotate(${r} ${x} ${y})"><rect x="${Number(x) - 110}" y="${Number(y) - 55}" width="220" height="110" rx="34" fill="${c}"/><rect x="${Number(x) - 110}" y="${Number(y) + 25}" width="220" height="30" rx="15" fill="#000" opacity=".06"/><path d="M${Number(x) - 40} ${y}q40 -26 80 0" fill="none" stroke="#c8a27a" stroke-width="8" stroke-linecap="round"/></g>`).join(""),
  tube: ({ accent = "#e67e22" }) =>
    shadow(495, 150) +
    `<g transform="rotate(-14 300 300)"><path d="M210 120h180l-20 300H230z" fill="#fdfefe"/><rect x="250" y="420" width="100" height="70" rx="12" fill="${accent}"/><rect x="200" y="100" width="200" height="34" rx="6" fill="#d5d8dc"/>` +
    `<rect x="240" y="220" width="120" height="100" rx="14" fill="${accent}" opacity=".85"/><circle cx="300" cy="270" r="22" fill="#fdfefe"/></g>`,
  jar: ({ accent = "#6e2c00" }) => jar("#8b5a2b", accent, "#f6ddcc"),
  balm: () =>
    shadow(470, 200) +
    [[220, "#e74c3c"], [300, "#f1948a"], [380, "#d35400"]].map(([x, c], i) => `<rect x="${Number(x) - 32}" y="${190 + i * 14}" width="64" height="250" rx="16" fill="#fdfefe"/><rect x="${Number(x) - 32}" y="${190 + i * 14}" width="64" height="80" rx="16" fill="${c}"/><rect x="${Number(x) - 24}" y="${300 + i * 14}" width="48" height="60" rx="8" fill="${c}" opacity=".35"/>`).join(""),
  bottle: ({ accent = "#c39bd3" }) => bottle(accent, "#7d3c98"),
  kumys: () => bottle("#f8f9f9", "#1f6fb2"),
  honey: () => jar("#f0b429", "#8a5a1e", "#fff5d6"),
  smetana: () => jar("#fdfefe", "#1f6fb2", "#d6eaf8"),
  kazy: () =>
    plate() +
    `<circle cx="300" cy="350" r="150" fill="none" stroke="#7b241c" stroke-width="64"/><circle cx="300" cy="350" r="150" fill="none" stroke="#a93226" stroke-width="20" opacity=".6"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<path d="M${300 + Math.cos(i) * 150} ${350 + Math.sin(i) * 150}l8 12" stroke="#f5b7b1" stroke-width="6"/>`).join("") +
    `<g fill="#fdf2e9"><circle cx="300" cy="350" r="26"/></g>`,
  shuzhuk: () =>
    plate() +
    [[0, "#922b21"], [14, "#7b241c"]].map(([r, c], i) => `<g transform="rotate(${-18 + Number(r)} 300 360)"><rect x="110" y="${320 + i * 40}" width="380" height="64" rx="32" fill="${c}"/><g fill="#f5b7b1" opacity=".7"><circle cx="190" cy="${345 + i * 40}" r="6"/><circle cx="270" cy="${360 + i * 40}" r="5"/><circle cx="350" cy="${342 + i * 40}" r="6"/><circle cx="420" cy="${358 + i * 40}" r="5"/></g></g>`).join(""),
};

export function artSvg(art: Art, palette: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="1200" height="1200"><rect width="600" height="600" fill="${palette.bg}"/>${ART[art](palette)}</svg>`;
}

export const ART_NAMES = Object.keys(ART) as Art[];
