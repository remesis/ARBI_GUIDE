(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ArbitrationTierData = api;
  root.ArbitrationTierData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Keep these two blocks in the same shape and order as the tier-list builder.
  // A trailing * is presentation metadata and is ignored during node matching.
  const SPECIAL_SECTIONS = [
    {
      "name": "Special",
      "subname": "Survival / Disruption",
      "items": [
        "Terrorem", "Ani", "Mot", "Kappa",
        "Ur", "Laomedeia", "Apollo", "Ganymede",
      ],
      "color": [147, 112, 219],
    },
  ];

  const TIERS = {
    "S-Tier": [
      "Tyana Pass", "Alator", "Callisto", "Xini", "Cytherean"
    ],
    "A-Tier": [
      "Munio", "Seimeni*", "Cinxia*", "Casta*", "Oestrus", "Hyf"
    ],
    "B-Tier": [
      "Larzac*", "Sechura*", "Hydron", "Helene",
      "Ose*", "Akkad", "Kala-azar", "Odin",
      "Mithra", "Belenus", "Taranis"
    ],
    "C-Tier": [
      "Coba", "Spear", "Kadesh", "Paimon*",
      "Lith", "Stephano", "Tessera*", "Outer Terminus*"
    ],
    "D-Tier": [
      "Umbriel", "Cerberus", "Lares", "Sangeru", "Sinai",
      "Gulliver", "Romula", "Proteus", "Io",
      "Stöfler", "Gaia"
    ],
  };

  const TIER_COLORS = {
    "S-Tier": [0, 242, 255],
    "A-Tier": [0, 242, 143],
    "B-Tier": [255, 234, 0],
    "C-Tier": [255, 143, 0],
    "D-Tier": [226, 85, 0],
  };

  function comparable(value) {
    return String(value || "").replace(/\*+$/, "").trim().toLocaleLowerCase();
  }

  function findTier(nodeName) {
    const sought = comparable(nodeName);
    if (!sought) return null;
    for (const section of SPECIAL_SECTIONS) {
      if (section.items.some((item) => comparable(item) === sought)) {
        return { name: section.name, subname: section.subname, color: [...section.color] };
      }
    }
    for (const [name, items] of Object.entries(TIERS)) {
      if (items.some((item) => comparable(item) === sought)) {
        return { name, color: [...TIER_COLORS[name]] };
      }
    }
    return null;
  }

  return { SPECIAL_SECTIONS, TIERS, TIER_COLORS, findTier };
});
