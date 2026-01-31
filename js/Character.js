// Character.js

export class Character {
  constructor(id, name, playstyle, difficulty, color, image) {
    this.id = id;                 // used for URL navigation
    this.name = name;             // Character name
    this.playstyle = playstyle;   // Aggressive / Balanced / Defensive
    this.difficulty = difficulty; // Easy / Medium / Hard
    this.color = color;           // Accent color for card
    this.image = image;           // Character image URL
  }
}
