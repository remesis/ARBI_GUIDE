(function(root){
"use strict";
const api=(function (data) {
  const colors = {'S-Tier':[0,242,255],'A-Tier':[0,242,143],'B-Tier':[255,234,0],
    'C-Tier':[255,143,0],'D-Tier':[226,85,0],'F-Tier':[139,139,148]};
  const comparable = value => String(value ?? '').normalize('NFKC').replace(/\*$/,'').trim().toLowerCase();
  const byName = new Map(data.nodes.map(node => [comparable(node.name),node]));
  return {
    SPECIAL_SECTIONS:data.SPECIAL_SECTIONS,TIERS:data.TIERS,TIER_COLORS:colors,
    findTier(name) {
      const node = byName.get(comparable(name));
      if (!node) return null;
      if (node.tier === 'Special') {
        const section = data.SPECIAL_SECTIONS.find(section => section.items.some(item => comparable(item) === comparable(name)));
        return {name:section.name,subname:section.subname,color:[...section.color]};
      }
      const key = node.tier + '-Tier';
      return {name:key,color:[...colors[key]]};
    },
  };
})({
  "TIERS": {
    "S-Tier": [
      "Tyana Pass",
      "Alator",
      "Callisto",
      "Cytherean",
      "Xini",
      "Munio"
    ],
    "A-Tier": [
      "Sinai",
      "Seimeni*",
      "Casta*",
      "Cinxia"
    ],
    "B-Tier": [
      "Spear",
      "Kadesh",
      "Akkad",
      "Kala-Azar",
      "Coba",
      "Lith",
      "Sechura*",
      "Larzac",
      "Belenus",
      "Taranis",
      "Hyf",
      "Oestrus"
    ],
    "C-Tier": [
      "Hydron",
      "Helene",
      "Ose",
      "Mithra",
      "Paimon",
      "Tessera*",
      "Odin",
      "Io",
      "Stephano",
      "Gulliver",
      "Romula",
      "Proteus",
      "Outer Terminus*"
    ],
    "D-Tier": [
      "Umbriel",
      "Cerberus",
      "Gaia",
      "Stöfler",
      "Sangeru",
      "Lares"
    ]
  },
  "SPECIAL_SECTIONS": [
    {
      "name": "Special",
      "subname": "Survival / Disruption",
      "items": [
        "Terrorem",
        "Ani",
        "Mot",
        "Kappa",
        "Ur",
        "Laomedeia",
        "Apollo",
        "Ganymede"
      ],
      "color": [
        147,
        112,
        219
      ]
    }
  ],
  "nodes": [
    {
      "name": "Callisto",
      "tier": "S"
    },
    {
      "name": "Sinai",
      "tier": "A"
    },
    {
      "name": "Io",
      "tier": "C"
    },
    {
      "name": "Umbriel",
      "tier": "D"
    },
    {
      "name": "Stephano",
      "tier": "C"
    },
    {
      "name": "Cytherean",
      "tier": "S"
    },
    {
      "name": "Xini",
      "tier": "S"
    },
    {
      "name": "Gulliver",
      "tier": "C"
    },
    {
      "name": "Romula",
      "tier": "C"
    },
    {
      "name": "Proteus",
      "tier": "C"
    },
    {
      "name": "Alator",
      "tier": "S"
    },
    {
      "name": "Kadesh",
      "tier": "B"
    },
    {
      "name": "Spear",
      "tier": "B"
    },
    {
      "name": "Tyana Pass",
      "tier": "S"
    },
    {
      "name": "Munio",
      "tier": "S"
    },
    {
      "name": "Mithra",
      "tier": "C"
    },
    {
      "name": "Taranis",
      "tier": "B"
    },
    {
      "name": "Belenus",
      "tier": "B"
    },
    {
      "name": "Casta",
      "tier": "A"
    },
    {
      "name": "Seimeni",
      "tier": "A"
    },
    {
      "name": "Cinxia",
      "tier": "A"
    },
    {
      "name": "Hydron",
      "tier": "C"
    },
    {
      "name": "Helene",
      "tier": "C"
    },
    {
      "name": "Odin",
      "tier": "C"
    },
    {
      "name": "Sechura",
      "tier": "B"
    },
    {
      "name": "Tessera",
      "tier": "C"
    },
    {
      "name": "Outer Terminus",
      "tier": "C"
    },
    {
      "name": "Cerberus",
      "tier": "D"
    },
    {
      "name": "Ose",
      "tier": "C"
    },
    {
      "name": "Paimon",
      "tier": "C"
    },
    {
      "name": "Larzac",
      "tier": "B"
    },
    {
      "name": "Rhea",
      "tier": "F"
    },
    {
      "name": "Lares",
      "tier": "D"
    },
    {
      "name": "Sangeru",
      "tier": "D"
    },
    {
      "name": "Akkad",
      "tier": "B"
    },
    {
      "name": "Kala-Azar",
      "tier": "B"
    },
    {
      "name": "Coba",
      "tier": "B"
    },
    {
      "name": "Lith",
      "tier": "B"
    },
    {
      "name": "Berehynia",
      "tier": "F"
    },
    {
      "name": "Oestrus",
      "tier": "B"
    },
    {
      "name": "Gaia",
      "tier": "D"
    },
    {
      "name": "Hyf",
      "tier": "B"
    },
    {
      "name": "Stöfler",
      "tier": "D"
    },
    {
      "name": "Malva",
      "tier": "F"
    },
    {
      "name": "Tikal",
      "tier": "F"
    },
    {
      "name": "Cameria",
      "tier": "F"
    },
    {
      "name": "Cholistan",
      "tier": "F"
    },
    {
      "name": "Wahiba",
      "tier": "F"
    },
    {
      "name": "Memphis",
      "tier": "F"
    },
    {
      "name": "Zeugma",
      "tier": "F"
    },
    {
      "name": "Caracol",
      "tier": "F"
    },
    {
      "name": "Piscinas",
      "tier": "F"
    },
    {
      "name": "Amarna",
      "tier": "F"
    },
    {
      "name": "Ur",
      "tier": "Special"
    },
    {
      "name": "Assur",
      "tier": "F"
    },
    {
      "name": "Zabala",
      "tier": "F"
    },
    {
      "name": "Yursa",
      "tier": "F"
    },
    {
      "name": "Kelashin",
      "tier": "F"
    },
    {
      "name": "Gabii",
      "tier": "F"
    },
    {
      "name": "Hieracon",
      "tier": "F"
    },
    {
      "name": "Stickney",
      "tier": "F"
    },
    {
      "name": "Despina",
      "tier": "F"
    },
    {
      "name": "Augustus",
      "tier": "F"
    },
    {
      "name": "Olympus",
      "tier": "F"
    },
    {
      "name": "Everest",
      "tier": "F"
    },
    {
      "name": "Ophelia",
      "tier": "F"
    },
    {
      "name": "Palus",
      "tier": "F"
    },
    {
      "name": "Ganymede",
      "tier": "Special"
    },
    {
      "name": "Apollodorus",
      "tier": "F"
    },
    {
      "name": "Titan",
      "tier": "F"
    },
    {
      "name": "Elara",
      "tier": "F"
    },
    {
      "name": "Kiliken",
      "tier": "F"
    },
    {
      "name": "Laomedeia",
      "tier": "Special"
    },
    {
      "name": "V Prime",
      "tier": "F"
    },
    {
      "name": "Draco",
      "tier": "F"
    },
    {
      "name": "Nimus",
      "tier": "F"
    },
    {
      "name": "Kappa",
      "tier": "Special"
    },
    {
      "name": "Selkie",
      "tier": "F"
    },
    {
      "name": "Valefor",
      "tier": "F"
    },
    {
      "name": "Tycho",
      "tier": "F"
    },
    {
      "name": "Apollo",
      "tier": "Special"
    },
    {
      "name": "Yuvarium",
      "tier": "F"
    },
    {
      "name": "Ani",
      "tier": "Special"
    },
    {
      "name": "Mot",
      "tier": "Special"
    },
    {
      "name": "Terrorem",
      "tier": "Special"
    },
    {
      "name": "Taveuni",
      "tier": "F"
    },
    {
      "name": "Tamu",
      "tier": "F"
    },
    {
      "name": "Tuvul Commons",
      "tier": "F"
    },
    {
      "name": "Cambire",
      "tier": "F"
    }
  ]
});
if(typeof module==="object"&&module.exports)module.exports=api;
root.ArbitrationTierData=api;
})(typeof globalThis!=="undefined"?globalThis:this);
