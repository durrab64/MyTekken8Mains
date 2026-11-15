# Tekken 8 Mains - Official Image Setup Guide

## Current Status
The application currently uses **AI-generated face icons**. Follow this guide to replace them with **official Tekken 8 character images**.

---

## Required Images

For each character, you need **TWO types of images**:

### 1. Face Icons (for Index Page)
- **Usage**: Character selection grid on `index.html`
- **Style**: Close-up face crop, no background (transparent PNG)
- **Recommended size**: 400x400px to 600x600px
- **Format**: PNG with transparent background

### 2. Full Body Renders (for Detail Pages)
- **Usage**: Character detail page on `character.html`
- **Style**: Full body character render
- **Recommended size**: 500x800px to 800x1200px
- **Format**: PNG (transparent background preferred)

---

## Where to Get Official Tekken 8 Images

### Option 1: Bandai Namco Press Kit (Best Quality)
**URL**: https://press.bandainamcoent.eu/tekken-8

- Official high-resolution press assets
- Full body character renders
- Professional quality images
- Download the press kit and extract character renders

### Option 2: DeviantArt Community Renders
High-quality transparent renders uploaded by the community:

- **Jin Kazama**: https://www.deviantart.com/vgejackler (search "Tekken 8 Jin transparent")
- **Claudio Serafino**: Search "Tekken 8 Claudio render transparent" on DeviantArt
- **Sergei Dragunov**: https://www.deviantart.com/tootypops (Tekken 8 Dragunov render)
- **Victor Chevalier**: https://www.deviantart.com/cr1one (Tekken 8 Victor 4K renders)
- **Lars Alexandersson**: https://www.deviantart.com/vgejackler (Tekken 8 Lars transparent)

### Option 3: Tekken Wiki
**URL**: https://tekken.fandom.com/wiki/Tekken_8

- Navigate to each character's page
- Look for "Gallery" or "Art and Renders" section
- Download official character artwork

### Option 4: Creative Uncut
**URL**: https://www.creativeuncut.com/gallery-45-tekken-8.html

- High-quality character art gallery
- Official promotional renders

---

## How to Prepare Images

### Step 1: Download Full Body Renders
1. Visit one of the sources above
2. Download the **full body transparent PNG** for each character:
   - `jin_fullbody.png`
   - `claudio_fullbody.png`
   - `dragunov_fullbody.png`
   - `victor_fullbody.png`
   - `lars_fullbody.png`

### Step 2: Create Face Crops
You have two options:

#### Option A: Manual Cropping (Recommended)
1. Open each full body image in an image editor (Photoshop, GIMP, Photopea, etc.)
2. Crop to just the face/head area (shoulders and up)
3. Ensure the background remains transparent
4. Save as PNG with these names:
   - `jin.png`
   - `claudio.png`
   - `dragunov.png`
   - `victor.png`
   - `lars.png`

#### Option B: Online Tools
Use free online tools to crop images:
- **Photopea** (https://www.photopea.com/) - Free online Photoshop alternative
- **Remove.bg** (https://www.remove.bg/) - Remove background if needed
- **Crop Tool** (https://www.iloveimg.com/crop-image) - Quick cropping

### Step 3: Save to Assets Folder
1. Place **face crops** in: `assets/images/`
   - `jin.png`
   - `claudio.png`
   - `dragunov.png`
   - `victor.png`
   - `lars.png`

2. Place **full body renders** in: `assets/images/fullbody/`
   - `jin_fullbody.png`
   - `claudio_fullbody.png`
   - `dragunov_fullbody.png`
   - `victor_fullbody.png`
   - `lars_fullbody.png`

---

## Update Code Files

### Step 1: Update Index Page Images (Face Crops)
The face crops are **already configured** in `js/data.js`:

```javascript
// These paths are already set correctly
new Character("jin", "Jin Kazama", "Balanced", "Medium", "#dc2626", "assets/images/jin.png"),
```

✅ **No changes needed** - just replace the image files!

### Step 2: Update Detail Page Images (Full Body)
Edit `js/char.js` to use full body renders:

**Find lines 33, 41, 49, 57, 65** and update the image paths:

```javascript
// BEFORE (face crops)
image: "assets/images/jin.png"

// AFTER (full body)
image: "assets/images/fullbody/jin_fullbody.png"
```

**Complete example for all characters:**
```javascript
const mockApiData = {
  jin: {
    // ... other properties
    image: "assets/images/fullbody/jin_fullbody.png"
  },
  claudio: {
    // ... other properties
    image: "assets/images/fullbody/claudio_fullbody.png"
  },
  dragunov: {
    // ... other properties
    image: "assets/images/fullbody/dragunov_fullbody.png"
  },
  victor: {
    // ... other properties
    image: "assets/images/fullbody/victor_fullbody.png"
  },
  lars: {
    // ... other properties
    image: "assets/images/fullbody/lars_fullbody.png"
  }
};
```

---

## Quick Setup Checklist

- [ ] Create folder: `assets/images/fullbody/`
- [ ] Download official Tekken 8 character renders
- [ ] Crop face icons from full body images
- [ ] Save face crops to `assets/images/` (jin.png, claudio.png, etc.)
- [ ] Save full body renders to `assets/images/fullbody/` (jin_fullbody.png, etc.)
- [ ] Update `js/char.js` with full body image paths
- [ ] Test in browser - verify face icons on index page
- [ ] Test in browser - verify full body renders on detail pages

---

## Image Specifications

### Face Icons (Index Page)
- **Dimensions**: 400x400px to 600x600px (square)
- **Format**: PNG with transparent background
- **Content**: Face/head only (shoulders and up)
- **Display**: Circular crop via CSS (`border-radius: 50%`)

### Full Body Renders (Detail Pages)
- **Dimensions**: 500x800px to 800x1200px (portrait)
- **Format**: PNG (transparent background preferred)
- **Content**: Full character body
- **Display**: Centered with drop shadow effect

---

## Troubleshooting

### Images not showing?
1. Check file names match exactly (case-sensitive)
2. Verify files are in correct folders
3. Clear browser cache (Ctrl + F5)
4. Check browser console for errors (F12)

### Background not transparent?
1. Use PNG format (not JPG)
2. Use image editor to remove background
3. Try remove.bg tool for automatic background removal

### Images too large/slow loading?
1. Compress PNG files using TinyPNG (https://tinypng.com/)
2. Resize to recommended dimensions
3. Use WebP format for better compression (optional)

---

## Notes

- The CSS is already configured for circular face icons
- Border colors are already set per character
- Full body images will display with a red glow effect
- All images should have transparent backgrounds for best results
