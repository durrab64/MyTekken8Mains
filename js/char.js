import { characters } from "./data.js";

/* ==============================
   Get character ID from URL
================================ */
const params = new URLSearchParams(window.location.search);
const charId = params.get("id");

/* ==============================
   DOM Elements
================================ */
const charName = document.getElementById("char-name");
const charDetails = document.getElementById("char-details");

/* ==============================
   Find base character (MODEL)
================================ */
const baseCharacter = characters.find(c => c.id === charId);

/* ==============================
   MOCK API (Lore + Image + Description)
   Simulates real backend call
================================ */
async function fetchCharacterExtraData(id) {
  // Enhanced character data with detailed descriptions
  const mockApiData = {
    jin: {
      lore: "A conflicted fighter battling the Devil Gene within him, Jin Kazama seeks to end the cursed Mishima bloodline once and for all. Torn between his humanity and demonic power, he fights with precision and devastating force.",
      description: "Jin Kazama is the son of Kazuya Mishima and Jun Kazama. After witnessing his mother's death, he trained under his grandfather Heihachi to seek revenge. However, Jin discovered the Devil Gene within himself, leading him down a dark path of isolation and conflict.",
      fightingStyle: "Traditional Karate mixed with Mishima-style Fighting Karate",
      strengths: "Excellent poking tools, strong punishment, versatile moveset with both traditional karate and Mishima techniques",
      weaknesses: "Requires precise execution, stance transitions can be risky",
      image: "assets/images/fullbody/jin_fullbody.png"
    },
    claudio: {
      lore: "An exorcist of the secret Sirius Marksmen organization, Claudio Serafino fights using mystical solar magic and elegant martial arts. His mission is to eliminate supernatural threats and protect humanity from dark forces.",
      description: "Claudio is a member of an ancient Italian organization dedicated to fighting paranormal entities. He wields the power of Sirius, channeling celestial energy into devastating attacks. His fighting style combines grace with explosive power.",
      fightingStyle: "Sirius-style Exorcism Sorcery",
      strengths: "Strong pressure game, excellent range with Starburst stance, powerful counter-hit tools",
      weaknesses: "Limited defensive options, relies heavily on momentum",
      image: "assets/images/fullbody/claudio_fullbody.png"
    },
    dragunov: {
      lore: "A silent and ruthless soldier of the Russian Spetsnaz, Sergei Dragunov is known as 'The White Angel of Death.' He overwhelms opponents with relentless pressure and brutal efficiency, never speaking a single word.",
      description: "Dragunov is a mysterious operative who communicates only through actions. His cold, calculating approach to combat makes him one of the most feared fighters in the tournament. He serves Mother Russia with unwavering loyalty.",
      fightingStyle: "Commando Sambo",
      strengths: "Exceptional pressure game, strong throws and grappling, excellent wall carry",
      weaknesses: "Limited range on some key moves, can struggle against keepout",
      image: "assets/images/fullbody/dragunov_fullbody.png"
    },
    victor: {
      lore: "Victor Chevalier is a refined French assassin and founder of the UN's independent forces. Using cutting-edge weaponry and tactical brilliance, he executes his missions with surgical precision and unwavering professionalism.",
      description: "A veteran soldier with decades of combat experience, Victor combines traditional martial arts with modern military technology. His gadgets and weapons make him a versatile and unpredictable opponent on the battlefield.",
      fightingStyle: "Gadget-Enhanced Combat",
      strengths: "Versatile toolkit with unique gadgets, strong mixups, excellent range control",
      weaknesses: "Steep learning curve, gadget management required",
      image: "assets/images/fullbody/victor_fullbody.png"
    },
    lars: {
      lore: "Lars Alexandersson is a rebellious leader fighting for freedom and justice. As an illegitimate son of Heihachi Mishima, he rejects the family's dark legacy and leads a resistance movement against tyranny with explosive speed and power.",
      description: "Lars broke away from the Tekken Force to form his own rebel army. His fighting style emphasizes quick strikes and electrical attacks, reflecting his desire to forge his own path separate from the Mishima bloodline.",
      fightingStyle: "Mishima-style Fighting Karate (Modified)",
      strengths: "Fast movement, strong combo potential, good range with Dynamic Entry",
      weaknesses: "Can be predictable, requires good spacing awareness",
      image: "assets/images/fullbody/lars_fullbody.png"
    }
  };

  // simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockApiData[id]);
    }, 600);
  });
}

/* ==============================
   Render Character Page
================================ */
async function renderCharacter() {
  if (!baseCharacter) {
    charDetails.innerHTML = `<p>Character not found.</p>`;
    return;
  }

  charName.textContent = baseCharacter.name;

  // loading state
  charDetails.innerHTML = `<p style="text-align: center; color: var(--muted);">Loading character data...</p>`;

  try {
    const extraData = await fetchCharacterExtraData(baseCharacter.id);

    charDetails.innerHTML = `
      <div class="char-detail-wrapper">
        <div class="char-img-container">
          <img 
            src="${extraData.image}" 
            alt="${baseCharacter.name}"
            class="char-img"
            loading="lazy"
          />
        </div>

        <div class="char-content">
          <h2>${baseCharacter.name}</h2>

          <div class="char-meta">
            <div class="char-meta-item">
              <span class="char-meta-label">Playstyle</span>
              <span class="char-meta-value">${baseCharacter.playstyle}</span>
            </div>
            <div class="char-meta-item">
              <span class="char-meta-label">Difficulty</span>
              <span class="char-meta-value">${baseCharacter.difficulty}</span>
            </div>
            <div class="char-meta-item">
              <span class="char-meta-label">Fighting Style</span>
              <span class="char-meta-value" style="font-size: 1rem; color: var(--text);">${extraData.fightingStyle}</span>
            </div>
          </div>

          <div class="char-description">
            <h3>About</h3>
            <p>${extraData.description}</p>
          </div>

          <div class="char-description">
            <h3>Strengths</h3>
            <p>${extraData.strengths}</p>
          </div>

          <div class="char-description">
            <h3>Weaknesses</h3>
            <p>${extraData.weaknesses}</p>
          </div>

          <div class="char-lore">
            <p>${extraData.lore}</p>
          </div>

          <button class="char-back-btn" onclick="goBack()">
            ← Back to roster
          </button>
        </div>
      </div>
    `;
  } catch (error) {
    charDetails.innerHTML = `<p>Failed to load character data.</p>`;
  }
}

/* ==============================
   Navigation
================================ */
window.goBack = function () {
  window.location.href = "index.html";
};

/* ==============================
   Init
================================ */
renderCharacter();
