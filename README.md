# FPV Track Designer

<div align="center">

![FPV Track Designer](https://img.shields.io/badge/FPV-Track%20Designer-29b6f6?style=for-the-badge&logo=drone&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-00c853?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-ff6d00?style=for-the-badge)

**A 3D web-based tool for designing FPV drone racing tracks**

*Inspired by the [West Coast Multirotor Club](https://westcoastmultirotors.com.au/) — Perth's ultimate FPV Drone Racing Club*

</div>

---

## 🚁 Overview

FPV Track Designer is an interactive 3D application for planning and visualizing FPV (First Person View) drone racing tracks. Perfect for club race organizers, pilots planning practice sessions, or anyone wanting to design exciting racing courses.

## ✨ Features

### Track Design
- **6 Gate Types**: Square, Arch, Ladder, Hurdle, Dive, and Flag markers
- **Drag & Drop**: Intuitive gate placement on the 3D field
- **Gate Rotation**: Scroll wheel to rotate gates to any angle
- **Real-time Feedback**: Visual indicators for selected gates and rotation

### Flight Path
- **Continuous Path Drawing**: Hold and drag to trace flight paths
- **Variable Altitude**: Scroll to adjust flight height (0.5m - 15m)
- **Smooth Curves**: Catmull-Rom spline interpolation for realistic paths
- **Height Visualization**: Ground ring and altitude line show current height

### Drone Animation
- **Realistic Drone Model**: Complete with spinning props and LED lights
- **Path Animation**: Watch your drone fly the designed route
- **Adjustable Speed**: Control animation speed from 1x to 10x

### Save & Share
- **Local Storage**: Save tracks to your browser
- **JSON Export**: Download track data as JSON files
- **URL Sharing**: Generate shareable URLs for your tracks
- **Import**: Load tracks from JSON data

## 🎮 Controls

### Desktop - Edit Mode
| Control | Action |
|---------|--------|
| **Left Click** | Select/drag gates |
| **Right Click + Drag** | Rotate camera |
| **Middle Click + Drag** | Pan camera |
| **Scroll Wheel** | Zoom (no gate selected) / Rotate (gate selected) |
| **Delete / Backspace** | Delete selected gate |
| **Ctrl + Z** | Undo last action |
| **Escape** | Deselect / Cancel |

### Desktop - Path Mode
| Control | Action |
|---------|--------|
| **Left Click + Drag** | Trace flight path |
| **Scroll Wheel** | Adjust drawing altitude |
| **Escape** | Exit path mode |

### 📱 Mobile / Touch Controls
| Gesture | Action |
|---------|--------|
| **Tap** | Select gate |
| **Drag (1 finger)** | Pan camera / Drag gate / Draw path |
| **Pinch** | Zoom in/out |
| **Two-finger drag** | Rotate camera view |
| **Quick bar buttons** | Access main functions |
| **☰ Menu buttons** | Open gates/controls panels |

## 🛠️ Getting Started

### Quick Start
1. Simply open `index.html` in a modern web browser
2. No build process or server required — it's pure HTML, CSS, and JavaScript

### Local Server (Optional)
For development with live reload:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## 📋 Workflow

1. **Add Gates**: Click gate types from the left panel to add them to the field
2. **Position Gates**: Drag gates to desired positions, scroll to rotate
3. **Lock Layout**: Click "Lock Layout" when gate placement is complete
4. **Draw Path**: Click "Draw Flight Path" then drag on the field to trace your route
5. **Adjust Height**: Use scroll wheel while drawing to change altitude
6. **Animate**: Click "Animate Drone" to preview the flight
7. **Save/Share**: Export your track for later or share with others

## 🎨 Theme

This application features a design inspired by the [West Coast Multirotor Club](https://westcoastmultirotors.com.au/), Western Australia's premier drone racing club. The color scheme uses:

- **Primary Teal** (`#29b6f6`) — Racing energy
- **Dark Navy** (`#37474f`) — Professional backdrop
- **Accent Orange** (`#ff6d00`) — Gate highlights
- **Success Green** (`#00c853`) — Path indicators

## 📁 Project Structure

```
FPVTrackPlanner/
├── index.html      # Main application markup
├── style.css       # WCMRC-inspired styling
├── script.js       # Three.js 3D engine & app logic
└── README.md       # This file
```

## 🔧 Technical Details

- **3D Engine**: [Three.js](https://threejs.org/) r128
- **Rendering**: WebGL with antialiasing and shadows
- **Fonts**: [Exo 2](https://fonts.google.com/specimen/Exo+2) & [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue)
- **No Dependencies**: Pure vanilla JavaScript, no build tools required

## 📱 Mobile Support

The app is fully responsive and works on mobile devices:

- **Collapsible Panels**: Slide-out menus for gates and controls
- **Touch Gestures**: Pinch to zoom, two-finger rotate, drag to pan
- **Quick Action Bar**: Bottom toolbar for fast access to main functions
- **Touch-Optimized UI**: Larger tap targets, mobile-friendly buttons
- **Gate Controls**: On-screen rotation buttons for selected gates

## 🌐 Browser Support

### Desktop
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

### Mobile
- iOS Safari 14+
- Chrome for Android
- Samsung Internet

*Requires WebGL support*

## 📄 License

MIT License — feel free to use for your FPV club or personal projects.

---

<div align="center">

**Happy Flying! 🚁**

*Design the track. Fly the path. Race to victory.*

</div>
