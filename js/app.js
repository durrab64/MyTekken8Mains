// app.js - Main page logic
import { characters } from "./data.js";

const characterList = document.getElementById("character-list");
const filterPlaystyle = document.getElementById("filter-playstyle");
const filterDifficulty = document.getElementById("filter-difficulty");
const sortSelect = document.getElementById("sort-characters");

// Function to create card HTML for one character
function createCard(character) {
  return `
    <div 
      class="card"
      style="border-color: ${character.color};"
      onclick="goToCharacter('${character.id}')"
    >
      <img
        src="${character.image}"
        alt="${character.name}"
        class="card-img"
        loading="lazy"
        onload="this.classList.add('loaded')"
      />
      <h2 class="card-name">${character.name}</h2>
      <div class="playstyle">${character.playstyle}</div>
      <div class="difficulty">Difficulty: ${character.difficulty}</div>
    </div>
  `;
}

// Render characters with animation
function renderCharacters(charArray) {
  // Fade out before replacing cards
  characterList.style.opacity = 0;

  setTimeout(() => {
    // Inject cards
    characterList.innerHTML = charArray.map(createCard).join("");

    // Fade in container
    characterList.style.opacity = 1;
  }, 150);
}

// Function to sort characters
function sortCharacters(charArray) {
  const sortValue = sortSelect.value;
  let sorted = [...charArray]; // clone array

  switch (sortValue) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "difficulty-asc":
      const diffOrder = ["easy", "medium", "hard"];
      sorted.sort((a, b) =>
        diffOrder.indexOf(a.difficulty.toLowerCase()) -
        diffOrder.indexOf(b.difficulty.toLowerCase())
      );
      break;
    case "difficulty-desc":
      const diffOrderDesc = ["easy", "medium", "hard"];
      sorted.sort((a, b) =>
        diffOrderDesc.indexOf(b.difficulty.toLowerCase()) -
        diffOrderDesc.indexOf(a.difficulty.toLowerCase())
      );
      break;
    default:
      break;
  }

  return sorted;
}

// Update render with filters and sorting
function updateRender() {
  let filtered = characters;

  // Apply filters
  const playstyleValue = filterPlaystyle.value;
  const difficultyValue = filterDifficulty.value;

  if (playstyleValue !== "all") {
    filtered = filtered.filter(c => c.playstyle.toLowerCase() === playstyleValue);
  }

  if (difficultyValue !== "all") {
    filtered = filtered.filter(c => c.difficulty.toLowerCase() === difficultyValue);
  }

  // Apply sorting
  const finalArray = sortCharacters(filtered);

  renderCharacters(finalArray);
}

// Click handler: go to character page
window.goToCharacter = function (id) {
  window.location.href = `character.html?id=${id}`;
}

// Event listeners
filterPlaystyle.addEventListener("change", updateRender);
filterDifficulty.addEventListener("change", updateRender);
sortSelect.addEventListener("change", updateRender);

// Initial render
renderCharacters(characters);
