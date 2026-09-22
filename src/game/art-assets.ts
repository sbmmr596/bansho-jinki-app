/** Bundled art filenames under public/chars and public/cards (editor validation). */
export const CHAR_ART_FILES = [
  "azuha.png",
  "bold.png",
  "claire.png",
  "daruk.png",
  "fenrir.png",
  "gouzan.png",
  "haru.png",
  "hito.png",
  "iva.png",
  "kaien.png",
  "kon.png",
  "kuro.png",
  "leo.png",
  "maki.png",
  "mirei.png",
  "mizuki.png",
  "nox.png",
  "rin.png",
  "ryuji.png",
  "saika.png",
  "sora.png",
  "vel.png",
  "yuki.png",
  "z_earth.png",
  "z_heaven.png",
  "z_magic.png",
  "z_power.png",
  "z_skill.png",
  "z_void.png",
  "zanma.png",
] as const;

export const CARD_ART_FILES = [
  "azuha.jpg",
  "bold.jpg",
  "claire.jpg",
  "daruk.jpg",
  "fenrir.jpg",
  "gouzan.jpg",
  "haru.jpg",
  "hito.jpg",
  "iva.jpg",
  "kaien.jpg",
  "kon.jpg",
  "kuro.jpg",
  "leo.jpg",
  "maki.jpg",
  "mirei.jpg",
  "mizuki.jpg",
  "nox.jpg",
  "rin.jpg",
  "ryuji.jpg",
  "saika.jpg",
  "sora.jpg",
  "vel.jpg",
  "yuki.jpg",
  "zanma.jpg",
] as const;

export type CharArtFile = (typeof CHAR_ART_FILES)[number];
export type CardArtFile = (typeof CARD_ART_FILES)[number];

export function charArtPath(file: string): string {
  const name = file.replace(/^\/+/, "").replace(/^chars\//, "");
  return `/chars/${name}`;
}

export function cardArtPath(file: string): string {
  const name = file.replace(/^\/+/, "").replace(/^cards\//, "");
  return `/cards/${name}`;
}
