import type {
  Card,
  ElementType,
  EnemyUnit,
  Faction,
  FieldKind,
  Formation,
  MapNode,
  Rarity,
} from "./types";

export const TYPE_LABEL: Record<ElementType, string> = {
  power: "力",
  skill: "技",
  magic: "魔",
  void: "無",
  heaven: "天",
  earth: "地",
};

export const FACTION_LABEL: Record<Faction, string> = {
  koryu: "煌龍",
  tekki: "鉄騎",
  tensho: "天翔",
  metsujin: "滅刃",
  reiju: "霊獣",
  yukei: "幽契",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  N: "N",
  S: "S",
  H: "H",
  SP: "SP",
};

export const TYPE_HINT: Record<ElementType, string> = {
  power: "技に強く、魔と天に弱い",
  skill: "魔に強く、力と天に弱い",
  magic: "力に強く、技と天に弱い",
  void: "天・地に強い。力技魔とは互角",
  heaven: "力技魔にやや強い。地と無に弱い",
  earth: "天に強い。無に弱い",
};

export const COUNTER_OF: Record<ElementType, ElementType[]> = {
  power: ["magic"],
  skill: ["power"],
  magic: ["skill"],
  void: ["heaven", "earth"],
  heaven: ["earth", "void"],
  earth: ["void"],
};

export const FORMATIONS: Record<string, Formation> = {
  cross: {
    id: "cross",
    name: "十字五皇陣",
    slots: [false, true, false, true, true, true, false, true, false],
    bonus: { hp: 0.12 },
    desc: "全員のHP+12%",
  },
  rush: {
    id: "rush",
    name: "三連衝陣",
    slots: [false, false, true, true, true, true, false, false, true],
    bonus: { frontAtk: 0.18 },
    desc: "前列の攻+18%",
  },
  iron: {
    id: "iron",
    name: "鉄壁陣",
    slots: [false, true, true, false, false, true, false, true, true],
    bonus: { def: 0.22 },
    desc: "全員の防+22%",
  },
  sky: {
    id: "sky",
    name: "天翔迅陣",
    slots: [true, false, false, true, true, true, true, false, false],
    bonus: { spd: 0.18 },
    desc: "全員の速+18%",
  },
  wedge: {
    id: "wedge",
    name: "楔抜陣",
    slots: [false, true, true, false, true, true, false, false, true],
    bonus: { atk: 0.12 },
    desc: "全員の攻+12%",
  },
  crane: {
    id: "crane",
    name: "鶴翼陣",
    slots: [true, false, true, false, true, false, true, false, true],
    bonus: { atk: 0.08, spd: 0.08 },
    desc: "攻・速+8%",
  },
  fangs: {
    id: "fangs",
    name: "双牙陣",
    slots: [true, false, true, false, true, true, true, false, true],
    bonus: { atk: 0.1, hp: 0.06 },
    desc: "攻+10% HP+6%",
  },
  lone: {
    id: "lone",
    name: "孤高三賢陣",
    slots: [false, false, false, true, true, true, false, false, false],
    bonus: { hp: 0.18, atk: 0.18, def: 0.18 },
    desc: "3人のみ。全能力+18%",
  },
  basic: {
    id: "basic",
    name: "均衡陣",
    slots: [false, true, true, false, true, true, false, true, false],
    bonus: { hp: 0.06, atk: 0.06 },
    desc: "HP・攻+6%",
  },
};

const FALLBACK_HEROES: Card[] = [
  {
    id: "kaien",
    name: "煌龍帝カイエン",
    title: "万象を統べる金鱗の帝",
    faction: "koryu",
    type: "power",
    rarity: "SP",
    cost: 6,
    hp: 1080,
    atk: 470,
    def: 400,
    spd: 108,
    formation: "cross",
    skill: { name: "皇龍破", kind: "pierce", power: 1.08, desc: "横一列を貫く" },
    portrait: "kaien",
  },
  {
    id: "mirei",
    name: "金鱗姫ミレイ",
    title: "慈光を降らす皇女",
    faction: "koryu",
    type: "heaven",
    rarity: "H",
    cost: 5,
    hp: 880,
    atk: 300,
    def: 360,
    spd: 104,
    formation: "lone",
    skill: { name: "金鱗の祈り", kind: "heal", power: 1.15, desc: "最も傷つく味方を癒す" },
    portrait: "mirei",
  },
  {
    id: "ryuji",
    name: "龍牙のリュウジ",
    title: "帝の牙を継ぐ騎士",
    faction: "koryu",
    type: "power",
    rarity: "S",
    cost: 4,
    hp: 720,
    atk: 330,
    def: 270,
    spd: 102,
    formation: "cross",
    skill: { name: "龍牙撃", kind: "front", power: 1.5, desc: "正面の敵を撃つ" },
    portrait: "ryuji",
  },
  {
    id: "sora",
    name: "白鱗のソラ",
    title: "若き鱗の使い",
    faction: "koryu",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 540,
    atk: 250,
    def: 200,
    spd: 110,
    formation: "basic",
    skill: { name: "連鱗", kind: "random", power: 0.85, hits: 2, desc: "敵を二度、乱撃する" },
    portrait: "sora",
  },
  {
    id: "gouzan",
    name: "鉄騎将軍ゴウザン",
    title: "不動の鉄壁",
    faction: "tekki",
    type: "earth",
    rarity: "SP",
    cost: 6,
    hp: 1240,
    atk: 380,
    def: 520,
    spd: 88,
    formation: "iron",
    skill: { name: "鉄砕なぎ", kind: "sweep", power: 1.25, desc: "前列をなぎ払う" },
    portrait: "gouzan",
  },
  {
    id: "iva",
    name: "盾姫イヴァ",
    title: "城門を一身に受ける",
    faction: "tekki",
    type: "earth",
    rarity: "H",
    cost: 5,
    hp: 980,
    atk: 260,
    def: 470,
    spd: 86,
    formation: "iron",
    skill: { name: "盾衝", kind: "front", power: 1.35, desc: "正面を押し潰す" },
    portrait: "iva",
  },
  {
    id: "bold",
    name: "重装兵ボルド",
    title: "関を守る鉄の歩み",
    faction: "tekki",
    type: "power",
    rarity: "S",
    cost: 4,
    hp: 820,
    atk: 280,
    def: 360,
    spd: 84,
    formation: "iron",
    skill: { name: "重撃", kind: "front", power: 1.45, desc: "正面の敵を殴る" },
    portrait: "bold",
  },
  {
    id: "maki",
    name: "槍騎マキ",
    title: "疾る一槍",
    faction: "tekki",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 560,
    atk: 260,
    def: 210,
    spd: 112,
    formation: "basic",
    skill: { name: "突貫", kind: "pierce", power: 0.95, desc: "横一列を貫く" },
    portrait: "maki",
  },
  {
    id: "azuha",
    name: "天翔姫アズハ",
    title: "嵐を呼ぶ翼",
    faction: "tensho",
    type: "heaven",
    rarity: "SP",
    cost: 6,
    hp: 920,
    atk: 430,
    def: 320,
    spd: 132,
    formation: "sky",
    skill: { name: "天翔嵐", kind: "all", power: 0.62, desc: "敵全体を嵐で打つ" },
    portrait: "azuha",
  },
  {
    id: "saika",
    name: "風刃サイカ",
    title: "見えぬ刃の舞",
    faction: "tensho",
    type: "skill",
    rarity: "H",
    cost: 5,
    hp: 760,
    atk: 400,
    def: 250,
    spd: 128,
    formation: "sky",
    skill: { name: "風刃乱舞", kind: "random", power: 0.9, hits: 3, desc: "三度、風で斬る" },
    portrait: "saika",
  },
  {
    id: "haru",
    name: "翼士ハル",
    title: "空を走る斥候",
    faction: "tensho",
    type: "skill",
    rarity: "S",
    cost: 4,
    hp: 640,
    atk: 320,
    def: 220,
    spd: 124,
    formation: "sky",
    skill: { name: "翼撃", kind: "front", power: 1.5, desc: "正面を迅く斬る" },
    portrait: "haru",
  },
  {
    id: "rin",
    name: "小鳥のリン",
    title: "風に乗る癒し手",
    faction: "tensho",
    type: "heaven",
    rarity: "N",
    cost: 2,
    hp: 420,
    atk: 160,
    def: 150,
    spd: 118,
    formation: "basic",
    skill: { name: "風の歌", kind: "heal", power: 1.05, desc: "味方を癒す" },
    portrait: "rin",
  },
  {
    id: "daruk",
    name: "滅刃王ダルク",
    title: "すべてを断つ覇王",
    faction: "metsujin",
    type: "magic",
    rarity: "SP",
    cost: 6,
    hp: 1000,
    atk: 510,
    def: 340,
    spd: 106,
    formation: "wedge",
    skill: { name: "滅刃・楔", kind: "pierce", power: 1.12, desc: "横一列を貫く" },
    portrait: "daruk",
  },
  {
    id: "claire",
    name: "紅蓮のクレア",
    title: "火を纏う双剣",
    faction: "metsujin",
    type: "power",
    rarity: "H",
    cost: 5,
    hp: 800,
    atk: 430,
    def: 260,
    spd: 116,
    formation: "rush",
    skill: { name: "紅蓮なぎ", kind: "sweep", power: 1.28, desc: "前列を炎で払う" },
    portrait: "claire",
  },
  {
    id: "zanma",
    name: "斬鬼ザンマ",
    title: "一刀に魂を乗せる",
    faction: "metsujin",
    type: "power",
    rarity: "S",
    cost: 4,
    hp: 680,
    atk: 360,
    def: 230,
    spd: 108,
    formation: "rush",
    skill: { name: "鬼斬", kind: "front", power: 1.55, desc: "正面に大ダメージ" },
    portrait: "zanma",
  },
  {
    id: "kuro",
    name: "影刃クロ",
    title: "闇に溶ける刃",
    faction: "metsujin",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 520,
    atk: 270,
    def: 180,
    spd: 120,
    formation: "basic",
    skill: { name: "影連", kind: "random", power: 0.88, hits: 2, desc: "影から二撃" },
    portrait: "kuro",
  },
  {
    id: "fenrir",
    name: "霊獣王フェンリル",
    title: "森を統べる白狼",
    faction: "reiju",
    type: "earth",
    rarity: "SP",
    cost: 6,
    hp: 1100,
    atk: 440,
    def: 390,
    spd: 114,
    formation: "crane",
    skill: { name: "獣王爪", kind: "sweep", power: 1.22, desc: "前列を引き裂く" },
    portrait: "fenrir",
  },
  {
    id: "yuki",
    name: "白狼ユキ",
    title: "雪原の静かな牙",
    faction: "reiju",
    type: "void",
    rarity: "H",
    cost: 5,
    hp: 840,
    atk: 370,
    def: 320,
    spd: 112,
    formation: "crane",
    skill: { name: "無牙", kind: "front", power: 1.5, desc: "正面を無で貫く" },
    portrait: "yuki",
  },
  {
    id: "leo",
    name: "翠爪のレオ",
    title: "密林の狩人",
    faction: "reiju",
    type: "earth",
    rarity: "S",
    cost: 4,
    hp: 740,
    atk: 310,
    def: 290,
    spd: 100,
    formation: "crane",
    skill: { name: "翠爪", kind: "front", power: 1.48, desc: "正面を裂く" },
    portrait: "leo",
  },
  {
    id: "kon",
    name: "小狐コン",
    title: "社に仕える仔",
    faction: "reiju",
    type: "magic",
    rarity: "N",
    cost: 2,
    hp: 400,
    atk: 170,
    def: 160,
    spd: 108,
    formation: "basic",
    skill: { name: "狐火", kind: "heal", power: 1.0, desc: "味方を癒す" },
    portrait: "kon",
  },
  {
    id: "nox",
    name: "幽契卿ノクス",
    title: "月と契った魔卿",
    faction: "yukei",
    type: "magic",
    rarity: "SP",
    cost: 6,
    hp: 940,
    atk: 490,
    def: 310,
    spd: 118,
    formation: "fangs",
    skill: { name: "月蝕", kind: "all", power: 0.64, desc: "敵全体に呪を降らす" },
    portrait: "nox",
  },
  {
    id: "mizuki",
    name: "月詠ミズキ",
    title: "無月を詠う巫女",
    faction: "yukei",
    type: "void",
    rarity: "H",
    cost: 5,
    hp: 800,
    atk: 360,
    def: 300,
    spd: 110,
    formation: "fangs",
    skill: { name: "無詠", kind: "pierce", power: 1.0, desc: "横一列を無で貫く" },
    portrait: "mizuki",
  },
  {
    id: "vel",
    name: "呪術士ヴェル",
    title: "禁書を読む者",
    faction: "yukei",
    type: "magic",
    rarity: "S",
    cost: 4,
    hp: 620,
    atk: 350,
    def: 210,
    spd: 106,
    formation: "basic",
    skill: { name: "呪槍", kind: "pierce", power: 1.0, desc: "横一列を貫く" },
    portrait: "vel",
  },
  {
    id: "hito",
    name: "式神ヒト",
    title: "紙に宿る小さな式",
    faction: "yukei",
    type: "magic",
    rarity: "N",
    cost: 3,
    hp: 500,
    atk: 240,
    def: 180,
    spd: 100,
    formation: "basic",
    skill: { name: "式弾", kind: "random", power: 0.86, hits: 2, desc: "式紙で乱撃する" },
    portrait: "hito",
  },
  {
    id: "koryu_s_rinpei",
    name: "鱗兵リンペイ",
    title: "帝旗を守る鱗の兵",
    faction: "koryu",
    type: "power",
    rarity: "S",
    cost: 4,
    hp: 700,
    atk: 320,
    def: 260,
    spd: 100,
    formation: "cross",
    skill: { name: "鱗斬", kind: "front", power: 1.48, desc: "正面を斬る" },
    portrait: "ryuji",
  },
  {
    id: "koryu_n_ashigaru1",
    name: "鱗兵アサ",
    title: "前線を支える若い鱗",
    faction: "koryu",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 520,
    atk: 245,
    def: 195,
    spd: 112,
    formation: "basic",
    skill: { name: "鱗突", kind: "pierce", power: 0.9, desc: "横一列を貫く" },
    portrait: "sora",
  },
  {
    id: "koryu_n_ashigaru2",
    name: "弟子カイ",
    title: "まだ薄い金の鱗",
    faction: "koryu",
    type: "earth",
    rarity: "N",
    cost: 2,
    hp: 480,
    atk: 200,
    def: 210,
    spd: 98,
    formation: "basic",
    skill: { name: "守鱗", kind: "front", power: 1.0, desc: "正面を押し返す" },
    portrait: "sora",
  },
  {
    id: "koryu_n_ashigaru3",
    name: "鱗使いトウ",
    title: "祈りの弟子",
    faction: "koryu",
    type: "magic",
    rarity: "N",
    cost: 3,
    hp: 430,
    atk: 165,
    def: 170,
    spd: 108,
    formation: "basic",
    skill: { name: "癒鱗", kind: "heal", power: 1.0, desc: "味方を癒す" },
    portrait: "mirei",
  },
  {
    id: "tekki_s_spear2",
    name: "槍卒ゴロウ",
    title: "関を突く二の槍",
    faction: "tekki",
    type: "skill",
    rarity: "S",
    cost: 4,
    hp: 680,
    atk: 340,
    def: 240,
    spd: 110,
    formation: "rush",
    skill: { name: "連槍", kind: "pierce", power: 0.98, desc: "横一列を貫く" },
    portrait: "maki",
  },
  {
    id: "tekki_n_spear1",
    name: "鉄兵ケン",
    title: "鎧を着た新兵",
    faction: "tekki",
    type: "power",
    rarity: "N",
    cost: 3,
    hp: 560,
    atk: 255,
    def: 220,
    spd: 100,
    formation: "basic",
    skill: { name: "鉄殴", kind: "front", power: 1.35, desc: "正面を殴る" },
    portrait: "bold",
  },
  {
    id: "tekki_n_shield1",
    name: "盾卒ドウ",
    title: "門前の盾持ち",
    faction: "tekki",
    type: "earth",
    rarity: "N",
    cost: 3,
    hp: 620,
    atk: 210,
    def: 260,
    spd: 92,
    formation: "iron",
    skill: { name: "盾打", kind: "front", power: 1.1, desc: "正面を押し潰す" },
    portrait: "iva",
  },
  {
    id: "tekki_n_scout1",
    name: "斥候ハヤ",
    title: "関を走る足軽",
    faction: "tekki",
    type: "skill",
    rarity: "N",
    cost: 2,
    hp: 450,
    atk: 230,
    def: 160,
    spd: 118,
    formation: "basic",
    skill: { name: "足撃", kind: "random", power: 0.82, hits: 2, desc: "二度、斬る" },
    portrait: "maki",
  },
  {
    id: "tensho_s_wing2",
    name: "翼士ソラネ",
    title: "嵐の末席",
    faction: "tensho",
    type: "heaven",
    rarity: "S",
    cost: 4,
    hp: 660,
    atk: 310,
    def: 230,
    spd: 122,
    formation: "sky",
    skill: { name: "翼薙", kind: "sweep", power: 1.2, desc: "前列をなぎ払う" },
    portrait: "haru",
  },
  {
    id: "tensho_n_wing1",
    name: "翼兵アオ",
    title: "まだ短い翼の兵",
    faction: "tensho",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 510,
    atk: 250,
    def: 185,
    spd: 116,
    formation: "basic",
    skill: { name: "羽撃", kind: "front", power: 1.4, desc: "正面を斬る" },
    portrait: "haru",
  },
  {
    id: "tensho_n_disciple1",
    name: "弟子フウ",
    title: "風に乗る見習い",
    faction: "tensho",
    type: "heaven",
    rarity: "N",
    cost: 2,
    hp: 390,
    atk: 150,
    def: 145,
    spd: 122,
    formation: "basic",
    skill: { name: "疾風", kind: "haste", power: 0, desc: "味方の速度を速める" },
    portrait: "rin",
  },
  {
    id: "tensho_n_scout1",
    name: "斥候ハネ",
    title: "空の目",
    faction: "tensho",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 500,
    atk: 245,
    def: 180,
    spd: 120,
    formation: "sky",
    skill: { name: "羽突", kind: "pierce", power: 0.88, desc: "横一列を貫く" },
    portrait: "saika",
  },
  {
    id: "metsujin_s_blade2",
    name: "影刃レツ",
    title: "二の刃を振るう",
    faction: "metsujin",
    type: "power",
    rarity: "S",
    cost: 4,
    hp: 670,
    atk: 350,
    def: 225,
    spd: 112,
    formation: "rush",
    skill: { name: "裂刃", kind: "sweep", power: 1.22, desc: "前列を裂く" },
    portrait: "zanma",
  },
  {
    id: "metsujin_n_ashigaru1",
    name: "影兵ヤミ",
    title: "闇に立つ足軽",
    faction: "metsujin",
    type: "skill",
    rarity: "N",
    cost: 3,
    hp: 515,
    atk: 265,
    def: 175,
    spd: 118,
    formation: "basic",
    skill: { name: "影斬", kind: "front", power: 1.42, desc: "正面を斬る" },
    portrait: "kuro",
  },
  {
    id: "metsujin_n_disciple1",
    name: "弟子キリオ",
    title: "滅刃の末弟子",
    faction: "metsujin",
    type: "magic",
    rarity: "N",
    cost: 3,
    hp: 490,
    atk: 255,
    def: 170,
    spd: 110,
    formation: "wedge",
    skill: { name: "呪突", kind: "pierce", power: 0.9, desc: "横一列を貫く" },
    portrait: "claire",
  },
  {
    id: "metsujin_n_scout1",
    name: "影卒カゲ",
    title: "無音の斥候",
    faction: "metsujin",
    type: "void",
    rarity: "N",
    cost: 2,
    hp: 440,
    atk: 240,
    def: 155,
    spd: 120,
    formation: "basic",
    skill: { name: "影乱", kind: "random", power: 0.8, hits: 2, desc: "影から二撃" },
    portrait: "kuro",
  },
  {
    id: "reiju_s_fang2",
    name: "翠牙ツキ",
    title: "森の二番牙",
    faction: "reiju",
    type: "earth",
    rarity: "S",
    cost: 4,
    hp: 730,
    atk: 305,
    def: 285,
    spd: 102,
    formation: "crane",
    skill: { name: "翠突", kind: "pierce", power: 0.96, desc: "横一列を貫く" },
    portrait: "leo",
  },
  {
    id: "reiju_n_cub1",
    name: "眷属コマ",
    title: "社に仕える仔獣",
    faction: "reiju",
    type: "earth",
    rarity: "N",
    cost: 3,
    hp: 550,
    atk: 240,
    def: 210,
    spd: 105,
    formation: "basic",
    skill: { name: "仔爪", kind: "front", power: 1.35, desc: "正面を裂く" },
    portrait: "kon",
  },
  {
    id: "reiju_n_disciple1",
    name: "弟子モモ",
    title: "白狼に学ぶ癒し手",
    faction: "reiju",
    type: "magic",
    rarity: "N",
    cost: 2,
    hp: 410,
    atk: 160,
    def: 155,
    spd: 110,
    formation: "basic",
    skill: { name: "獣癒", kind: "heal", power: 1.02, desc: "味方を癒す" },
    portrait: "kon",
  },
  {
    id: "reiju_n_scout1",
    name: "仔獣シズ",
    title: "静かな狩りの仔",
    faction: "reiju",
    type: "void",
    rarity: "N",
    cost: 3,
    hp: 480,
    atk: 230,
    def: 180,
    spd: 114,
    formation: "crane",
    skill: { name: "鈍牙", kind: "slow", power: 0, desc: "敵の速度を遅らせる" },
    portrait: "yuki",
  },
  {
    id: "yukei_s_curse2",
    name: "呪徒レイ",
    title: "禁書の次席",
    faction: "yukei",
    type: "magic",
    rarity: "S",
    cost: 4,
    hp: 640,
    atk: 340,
    def: 215,
    spd: 108,
    formation: "fangs",
    skill: { name: "呪連", kind: "pierce", power: 0.98, desc: "横一列を貫く" },
    portrait: "vel",
  },
  {
    id: "yukei_n_curse1",
    name: "呪卒アヤ",
    title: "月下の呪徒見習い",
    faction: "yukei",
    type: "magic",
    rarity: "N",
    cost: 3,
    hp: 505,
    atk: 245,
    def: 175,
    spd: 104,
    formation: "basic",
    skill: { name: "呪弾", kind: "front", power: 1.3, desc: "正面に呪を放つ" },
    portrait: "hito",
  },
  {
    id: "yukei_n_disciple1",
    name: "弟子ツキヨ",
    title: "月詠の弟子",
    faction: "yukei",
    type: "void",
    rarity: "N",
    cost: 2,
    hp: 405,
    atk: 155,
    def: 150,
    spd: 112,
    formation: "basic",
    skill: { name: "月癒", kind: "heal", power: 1.0, desc: "味方を癒す" },
    portrait: "mizuki",
  },
  {
    id: "yukei_n_paper1",
    name: "式徒カミ",
    title: "紙に宿る式の徒",
    faction: "yukei",
    type: "magic",
    rarity: "N",
    cost: 3,
    hp: 490,
    atk: 235,
    def: 170,
    spd: 102,
    formation: "basic",
    skill: { name: "式乱", kind: "random", power: 0.84, hits: 2, desc: "式紙で乱撃する" },
    portrait: "hito",
  },
];


const ELEMENTS: ElementType[] = ["power", "skill", "magic", "void", "heaven", "earth"];
const FACTION_IDS: Faction[] = ["koryu", "tekki", "tensho", "metsujin", "reiju", "yukei"];

const FODDER_JOB: Record<Faction, string> = {
  koryu: "龍",
  tekki: "鉄",
  tensho: "翼",
  metsujin: "刃",
  reiju: "獣",
  yukei: "契",
};

const FODDER_ROLE: Record<ElementType, string> = {
  power: "闘卒",
  skill: "斥候",
  magic: "術卒",
  void: "影卒",
  heaven: "祝卒",
  earth: "衛卒",
};

const FODDER_SKILL: Record<ElementType, Card["skill"]> = {
  power: { name: "打撃", kind: "front", power: 1.2, desc: "正面を殴る" },
  skill: { name: "連撃", kind: "random", power: 0.72, hits: 2, desc: "二度、斬る" },
  magic: { name: "術弾", kind: "front", power: 1.15, desc: "正面に術を放つ" },
  void: { name: "無撃", kind: "front", power: 1.18, desc: "正面を無で突く" },
  heaven: { name: "光弾", kind: "front", power: 1.1, desc: "正面を光で打つ" },
  earth: { name: "地砕", kind: "front", power: 1.22, desc: "正面を踏み砕く" },
};

function buildFodder(): Card[] {
  const out: Card[] = [];
  for (const faction of FACTION_IDS) {
    for (let i = 0; i < ELEMENTS.length; i++) {
      const type = ELEMENTS[i];
      out.push({
        id: `z_${faction}_${type}`,
        name: `${FODDER_JOB[faction]}${FODDER_ROLE[type]}`,
        title: `${FACTION_LABEL[faction]}の雑兵`,
        faction,
        type,
        rarity: "N",
        cost: 1,
        hp: 22,
        atk: 5,
        def: 2,
        spd: 68,
        formation: "basic",
        skill: FODDER_SKILL[type],
        portrait: `z_${type}`,
        fodder: true,
      });
    }
  }
  return out;
}

export const FODDER_CARDS = buildFodder();

export const SPECIAL_FODDER: Card[] = [
  {
    id: "z_haste",
    name: "迅祀卒",
    title: "時を急がせる兵",
    faction: "tensho",
    type: "heaven",
    rarity: "N",
    cost: 1,
    hp: 20,
    atk: 4,
    def: 2,
    spd: 76,
    formation: "basic",
    skill: { name: "ヘイスト", kind: "haste", power: 0, desc: "味方の速度を15%速める" },
    portrait: "z_heaven",
    fodder: true,
  },
  {
    id: "z_slow",
    name: "呪時卒",
    title: "時を鈍らせる兵",
    faction: "yukei",
    type: "void",
    rarity: "N",
    cost: 1,
    hp: 20,
    atk: 4,
    def: 2,
    spd: 72,
    formation: "basic",
    skill: { name: "スロウ", kind: "slow", power: 0, desc: "敵の速度を15%遅らせる" },
    portrait: "z_void",
    fodder: true,
  },
];

export const CARDS: Card[] = [];
export const HERO_CARDS: Card[] = [];
export const CARD_BY_ID: Record<string, Card> = {};

const FACTIONS = new Set<string>(["koryu", "tekki", "tensho", "metsujin", "reiju", "yukei"]);
const TYPES = new Set<string>(["power", "skill", "magic", "void", "heaven", "earth"]);
const RARITIES = new Set<string>(["N", "S", "H", "SP"]);
const SKILL_KINDS = new Set<string>(["front", "pierce", "sweep", "random", "all", "heal", "haste", "slow"]);

function asSrc(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s) || s.startsWith("/") || s.startsWith("data:")) return s;
  return `/${s.replace(/^\.\//, "")}`;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseHero(raw: unknown): Card | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!id || !name) return null;
  const faction = typeof r.faction === "string" ? r.faction : "";
  const type = typeof r.type === "string" ? r.type : "";
  const rarity = typeof r.rarity === "string" ? r.rarity : "N";
  const formation = typeof r.formation === "string" && FORMATIONS[r.formation] ? r.formation : "basic";
  if (!FACTIONS.has(faction) || !TYPES.has(type) || !RARITIES.has(rarity)) return null;
  const sk = r.skill && typeof r.skill === "object" ? (r.skill as Record<string, unknown>) : {};
  const kind = typeof sk.kind === "string" && SKILL_KINDS.has(sk.kind) ? sk.kind : "front";
  const art = asSrc(r.art);
  const bust = asSrc(r.bust);
  return {
    id,
    name,
    title: typeof r.title === "string" ? r.title : "",
    faction: faction as Card["faction"],
    type: type as Card["type"],
    rarity: rarity as Card["rarity"],
    cost: Math.max(1, Math.round(num(r.cost, 3))),
    hp: Math.max(1, Math.round(num(r.hp, 500))),
    atk: Math.max(1, Math.round(num(r.atk, 200))),
    def: Math.max(0, Math.round(num(r.def, 150))),
    spd: Math.max(1, Math.round(num(r.spd, 100))),
    formation,
    skill: {
      name: typeof sk.name === "string" && sk.name.trim() ? sk.name : "攻撃",
      kind: kind as Card["skill"]["kind"],
      power: num(sk.power, 1),
      hits: sk.hits != null ? Math.max(1, Math.round(num(sk.hits, 1))) : undefined,
      desc: typeof sk.desc === "string" ? sk.desc : "",
    },
    portrait: typeof r.portrait === "string" && r.portrait.trim() ? r.portrait.trim() : id,
    art,
    bust,
  };
}

function rebuildCatalog(heroes: Card[]) {
  // Remote/custom catalogs must not drop bundled heroes (esp. starters).
  // Missing ids are filled from FALLBACK_HEROES so newGame/defaultSave never
  // hit CARD_BY_ID[id] === undefined.
  const byId = new Map<string, Card>();
  for (const h of heroes) byId.set(h.id, h);
  for (const fb of FALLBACK_HEROES) {
    if (!byId.has(fb.id)) byId.set(fb.id, fb);
  }
  const merged = [...byId.values()];
  const all = [...merged, ...FODDER_CARDS, ...SPECIAL_FODDER];
  HERO_CARDS.splice(0, HERO_CARDS.length, ...merged);
  CARDS.splice(0, CARDS.length, ...all);
  for (const key of Object.keys(CARD_BY_ID)) delete CARD_BY_ID[key];
  for (const card of all) CARD_BY_ID[card.id] = card;
}

rebuildCatalog(FALLBACK_HEROES);

export function applyCatalog(raw: unknown): number {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { chars?: unknown }).chars)
      ? (raw as { chars: unknown[] }).chars
      : [];
  const heroes = list.map(parseHero).filter((c): c is Card => !!c);
  if (heroes.length) rebuildCatalog(heroes);
  return heroes.length;
}

export function resetCatalog() {
  rebuildCatalog(FALLBACK_HEROES);
}

export async function loadChars() {
  try {
    const res = await fetch("/data/chars.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return;
    const data: unknown = await res.json();
    applyCatalog(data);
  } catch {
    /* keep bundled fallback (404, timeout, network) */
  }
}

export const STARTER_IDS = ["sora", "maki", "kuro", "hito", "rin", "ryuji", "bold"];
export const SUMMON_COST = 200;
/** Opening cost cap at shrine-only (capturedCount=1). */
export const BASE_COST_CAP = 10;
export const HOME_ID = "shrine";
export const MAX_LEVEL = 50;
/** @deprecated Rank no longer boosts stats; kept for old save migration only. */
export const MAX_RANK = 99;
export const MAX_SKILL_LV = 10;

export function trainCost(level: number): number {
  const lv = Math.max(1, level);
  return 20 * lv + 10 * Math.floor(lv / 5);
}

export function levelMult(level: number): number {
  return 1 + (Math.max(1, level) - 1) * 0.04;
}

/** Rank multiplier retired — always 1. Kept so call sites can drop the arg gradually. */
export function rankMult(_rank = 0): number {
  return 1;
}

/** Stats scale with gold-train level only (rank ignored). */
export function scaledStat(base: number, level: number, _rank = 0): number {
  return Math.round(base * levelMult(level));
}

/** 必殺技レベルによる威力倍率。 */
export function skillPowerScale(skillLv: number): number {
  const lv = Math.max(1, Math.min(MAX_SKILL_LV, skillLv));
  return 1 + (lv - 1) * 0.08;
}

/** Success % when attempting skillLv → skillLv+1 (same-card or skill2 level-up). */
export function fuseSuccessRate(skillLv: number): number {
  return Math.max(5, 100 - (Math.max(1, skillLv) - 1) * 10);
}

/** @deprecated Use skillPowerScale */
export function skillScale(skillLv: number): number {
  return skillPowerScale(skillLv);
}

export const NODES: MapNode[] = [
  {
    id: "shrine",
    name: "始原の社",
    short: "始原",
    blurb: "あなたの本拠。ここから地を広げよ。",
    x: 10,
    y: 54,
    neighbors: ["mist", "ironpass"],
    hint: "power",
    field: "grass",
    enemy: [],
    reward: { gold: 0 },
    home: true,
  },
  {
    id: "mist",
    name: "霧の里",
    short: "霧里",
    blurb: "技を業とする斥候が潜む。力で踏み潰せ。",
    x: 26,
    y: 38,
    neighbors: ["shrine", "wind", "ember"],
    hint: "skill",
    field: "forest",
    enemy: [
      { cardId: "sora", slot: 5, level: 1, leader: true },
      { cardId: "maki", slot: 2, level: 1 },
      { cardId: "kuro", slot: 7, level: 1 },
    ],
    reward: { gold: 130, cardId: "maki" },
  },
  {
    id: "ironpass",
    name: "鉄錆の関",
    short: "鉄関",
    blurb: "地の装甲が厚い。無で貫くか、火力で崩せ。",
    x: 26,
    y: 72,
    neighbors: ["shrine", "grove", "ember"],
    hint: "earth",
    field: "waste",
    enemy: [
      { cardId: "bold", slot: 2, level: 1, leader: true },
      { cardId: "iva", slot: 5, level: 1 },
      { cardId: "maki", slot: 8, level: 1 },
    ],
    reward: { gold: 140, cardId: "iva" },
  },
  {
    id: "wind",
    name: "風鳴き峠",
    short: "風峠",
    blurb: "天と技の速攻。地か力を厚くせよ。",
    x: 43,
    y: 18,
    neighbors: ["mist", "moon", "tower"],
    hint: "heaven",
    field: "snow",
    enemy: [
      { cardId: "haru", slot: 3, level: 2, leader: true },
      { cardId: "saika", slot: 4, level: 2 },
      { cardId: "rin", slot: 5, level: 2 },
    ],
    reward: { gold: 160, cardId: "saika" },
  },
  {
    id: "ember",
    name: "紅蓮の谷",
    short: "紅谷",
    blurb: "力の突撃陣。魔で受け、前列を削れ。",
    x: 46,
    y: 54,
    neighbors: ["mist", "ironpass", "obsidian", "moon"],
    hint: "power",
    field: "magma",
    enemy: [
      { cardId: "claire", slot: 2, level: 3, leader: true },
      { cardId: "zanma", slot: 5, level: 2 },
      { cardId: "kuro", slot: 8, level: 2 },
      { cardId: "bold", slot: 4, level: 2 },
    ],
    reward: { gold: 180, cardId: "claire" },
  },
  {
    id: "grove",
    name: "翠の社",
    short: "翠社",
    blurb: "地の霊獣。無属性が刺さる。",
    x: 44,
    y: 82,
    neighbors: ["ironpass", "obsidian"],
    hint: "earth",
    field: "forest",
    enemy: [
      { cardId: "leo", slot: 0, level: 3, leader: true },
      { cardId: "fenrir", slot: 4, level: 2 },
      { cardId: "kon", slot: 8, level: 2 },
      { cardId: "yuki", slot: 2, level: 2 },
    ],
    reward: { gold: 190, cardId: "yuki" },
  },
  {
    id: "moon",
    name: "月下の沼",
    short: "月沼",
    blurb: "魔と無の呪い。技で魔を、力技魔で無を打て。",
    x: 64,
    y: 38,
    neighbors: ["wind", "ember", "bone", "tower"],
    hint: "magic",
    field: "forest",
    enemy: [
      { cardId: "vel", slot: 5, level: 3, leader: true },
      { cardId: "mizuki", slot: 4, level: 3 },
      { cardId: "hito", slot: 3, level: 3 },
      { cardId: "nox", slot: 8, level: 2 },
    ],
    reward: { gold: 210, cardId: "mizuki" },
  },
  {
    id: "obsidian",
    name: "黒曜の砦",
    short: "黒砦",
    blurb: "混成の守り。陣形を見て隙間を突け。",
    x: 64,
    y: 70,
    neighbors: ["ember", "grove", "bone"],
    hint: "power",
    field: "magma",
    enemy: [
      { cardId: "gouzan", slot: 5, level: 4, leader: true },
      { cardId: "iva", slot: 2, level: 3 },
      { cardId: "zanma", slot: 8, level: 3 },
      { cardId: "vel", slot: 1, level: 3 },
    ],
    reward: { gold: 230, cardId: "gouzan" },
  },
  {
    id: "tower",
    name: "天啓の塔",
    short: "天塔",
    blurb: "天の精鋭。地と無を編成せよ。",
    x: 76,
    y: 14,
    neighbors: ["wind", "moon", "capital"],
    hint: "heaven",
    field: "snow",
    enemy: [
      { cardId: "azuha", slot: 4, level: 5, leader: true },
      { cardId: "mirei", slot: 3, level: 4 },
      { cardId: "saika", slot: 5, level: 4 },
      { cardId: "rin", slot: 0, level: 4 },
    ],
    reward: { gold: 260, cardId: "azuha" },
  },
  {
    id: "bone",
    name: "龍骨街道",
    short: "龍骨",
    blurb: "帝都への最後の関。属性を読み切れ。",
    x: 76,
    y: 58,
    neighbors: ["moon", "obsidian", "capital"],
    hint: "magic",
    field: "waste",
    enemy: [
      { cardId: "nox", slot: 4, level: 5, leader: true },
      { cardId: "daruk", slot: 5, level: 5 },
      { cardId: "claire", slot: 2, level: 4 },
      { cardId: "mizuki", slot: 8, level: 4 },
    ],
    reward: { gold: 280, cardId: "nox" },
  },
  {
    id: "capital",
    name: "万象帝都",
    short: "帝都",
    blurb: "覇を決する都。リーダーを墜とせ。",
    x: 91,
    y: 36,
    neighbors: ["tower", "bone"],
    hint: "void",
    field: "waste",
    enemy: [
      { cardId: "kaien", slot: 4, level: 7, leader: true },
      { cardId: "daruk", slot: 5, level: 6 },
      { cardId: "gouzan", slot: 2, level: 6 },
      { cardId: "azuha", slot: 3, level: 6 },
      { cardId: "yuki", slot: 8, level: 6 },
    ],
    reward: { gold: 480, cardId: "kaien" },
  },
];

export const NODE_BY_ID: Record<string, MapNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
);

/** Frontier-ish cost cap for the 11-node map (home + 10 capturable).
 * Start 10 (shrine only), +1 per additional capture, max 20 when all 11 held.
 * Equivalent: min(20, 9 + capturedCount).
 */
export function costCapFor(capturedCount: number): number {
  return Math.min(20, BASE_COST_CAP + Math.max(0, capturedCount - 1));
}

const TRIAL_SLOTS = [5, 2, 8, 4, 1, 7];
const TRIAL_FIELDS: FieldKind[] = ["grass", "forest", "waste", "snow", "magma"];

export function makeTrialWave(wave: number): {
  enemy: EnemyUnit[];
  formationId: string;
  field: FieldKind;
} {
  const n = Math.min(5, 3 + Math.floor((wave - 1) / 2));
  const level = Math.min(30, 1 + Math.floor((wave - 1) / 2));
  const heroWave = wave > 1 && (wave % 4 === 0 || Math.random() < 0.28);
  const enemy: EnemyUnit[] = [];
  let formationId = "basic";

  if (heroWave) {
    const hero = HERO_CARDS[Math.floor(Math.random() * HERO_CARDS.length)];
    enemy.push({
      cardId: hero.id,
      slot: TRIAL_SLOTS[0],
      level: Math.min(50, level + 3),
      leader: true,
    });
    formationId = hero.formation;
  }

  const fodder = FODDER_CARDS;
  for (let i = enemy.length; i < n; i++) {
    const f = fodder[Math.floor(Math.random() * fodder.length)];
    enemy.push({
      cardId: f.id,
      slot: TRIAL_SLOTS[i],
      level,
      leader: enemy.length === 0,
    });
  }
  return { enemy, formationId, field: TRIAL_FIELDS[(wave - 1) % TRIAL_FIELDS.length] };
}
