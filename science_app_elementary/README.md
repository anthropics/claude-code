# 📚 Elementary Science Education App - 3rd Grade

An interactive and engaging educational application for 3rd grade elementary students featuring educational videos, entertaining games, and interactive quizzes!

## ✨ Features

### 🎥 Educational Videos
- Engaging animated videos
- Clear audio suitable for 9-year-old children
- Content aligned with textbook curriculum
- Fully offline capable

### 🎮 Interactive Games
- **Matching Game**: Match living and non-living things
- **Multiple Choice**: Engaging quiz questions
- **True/False**: Quick knowledge tests
- **Word Guess**: Play with scientific vocabulary

### 📝 Comprehensive Quizzes
- Questions for each lesson
- Detailed results display
- Immediate feedback
- Smart scoring system

### 🏆 Reward System
- Earn points by watching videos
- Earn points by playing games
- Earn stars by passing quizzes
- Track progress and achievements

## 📋 Requirements

- Python 3.7 or higher
- pip (Python package manager)

## 🚀 Installation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Application
```bash
python main.py
```

## 📁 Project Structure

```
science_app_elementary/
│
├── main.py                 # Main entry point
├── requirements.txt        # Python dependencies
│
├── gui/                    # GUI components
│   ├── main_window.py     # Main window
│   ├── lesson_browser.py  # Lesson browser
│   ├── video_player_window.py  # Video player
│   ├── game_window.py     # Games
│   └── quiz_window.py     # Quizzes
│
├── content/               # Educational content
│   ├── content_manager.py # Content management
│   └── lessons.json       # Lesson data
│
├── utils/                 # Utilities
│   ├── persian_text.py   # Persian text support
│   └── config.py         # Configuration
│
└── assets/               # Media files
    ├── videos/          # Educational videos
    ├── images/          # Images
    ├── sounds/          # Sound effects
    └── fonts/           # Persian fonts
```

## 🎬 Adding Educational Videos

### Step 1: Prepare Videos
1. Create or obtain MP4 format videos
2. Name files descriptively (e.g., `lesson1_living_nonliving.mp4`)
3. Place video files in `assets/videos/` directory

### Step 2: Update Content
Edit `content/lessons.json` to add or modify lesson information:

```json
{
  "lessons": [
    {
      "id": "lesson_1",
      "lesson_number": 1,
      "title": "Living and Non-Living Things",
      "description": "Lesson description...",
      "video": "lesson1_living_nonliving.mp4",
      "game": true,
      "quiz": [
        {
          "question": "Question text?",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correct": 1
        }
      ]
    }
  ]
}
```

## 🎨 Creating Animated Videos

### Recommended Tools (Free):

1. **Canva** - Easy-to-use with templates
2. **Animaker** - Cartoon animations
3. **Powtoon** - Explainer videos
4. **Blender** - Professional 3D animation

### Content Guidelines:
- Duration: 3-5 minutes
- Clear, child-friendly narration
- Colorful, engaging visuals
- Simple animations
- Aligned with textbook content

## 📊 Scoring System

- 🎥 **Watch Video**: 10 points
- ✅ **Correct Answer in Game**: 10 points
- 🎮 **Complete Game**: 50 points + 3 stars
- 📝 **Pass Quiz** (70%+): Score-based points + 3 stars

## 🎓 Available Lessons

The app includes 6 main lessons from 3rd grade science textbook:

1. **Living and Non-Living Things**
2. **Plants and Their Growth**
3. **Animals and Their Habitats**
4. **Water and Its Importance**
5. **Air and Its Importance**
6. **The Sun and Its Light**

## 🔧 Troubleshooting

### Video won't play
1. Ensure pygame is installed: `pip install pygame`
2. Verify video file is in `assets/videos/`
3. Check filename in `lessons.json` is correct

### Application won't start
1. Check Python version: `python --version`
2. Reinstall dependencies: `pip install -r requirements.txt`

## 📝 For Teachers

This app can be used as a supplementary teaching tool:

- **In Class**: Display videos with projector
- **Homework**: Students can review lessons at home
- **Assessment**: Use quizzes to evaluate learning
- **Motivation**: Reward system encourages engagement

## 🌟 Future Features

- [ ] Multi-user support (for multiple children)
- [ ] Detailed progress reports
- [ ] More game varieties
- [ ] Voice recording capability
- [ ] Parent notification via email
- [ ] Mobile version (Android/iOS)

## 📜 License

This application is free for educational use.

---

**Persian README**: See [README_FA.md](README_FA.md) for Persian documentation.

💝 Made with love for students
