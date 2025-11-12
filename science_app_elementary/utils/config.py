#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application configuration
"""

import os

# Base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')
CONTENT_DIR = os.path.join(BASE_DIR, 'content')
VIDEO_DIR = os.path.join(ASSETS_DIR, 'videos')
IMAGE_DIR = os.path.join(ASSETS_DIR, 'images')
SOUND_DIR = os.path.join(ASSETS_DIR, 'sounds')
FONT_DIR = os.path.join(ASSETS_DIR, 'fonts')

# Application settings
APP_TITLE = "علوم تجربی پایه سوم"
APP_WIDTH = 1024
APP_HEIGHT = 768
APP_BG_COLOR = "#E8F4F8"

# Colors - Kid-friendly bright colors
COLOR_PRIMARY = "#4A90E2"      # Blue
COLOR_SECONDARY = "#50C878"    # Green
COLOR_ACCENT = "#FFB347"       # Orange
COLOR_DANGER = "#FF6B6B"       # Red
COLOR_SUCCESS = "#51CF66"      # Light Green
COLOR_WARNING = "#FFD93D"      # Yellow
COLOR_TEXT = "#2C3E50"         # Dark Gray
COLOR_BG = "#FFFFFF"           # White
COLOR_BG_LIGHT = "#F8F9FA"     # Light Gray

# Fonts
FONT_FAMILY = "B Nazanin"      # Popular Persian font
FONT_SIZE_LARGE = 24
FONT_SIZE_MEDIUM = 18
FONT_SIZE_SMALL = 14

# Video settings
VIDEO_FPS = 30
VIDEO_BUFFER_SIZE = 10

# Game settings
POINTS_PER_CORRECT = 10
POINTS_PER_GAME_COMPLETE = 50
STARS_FOR_COMPLETE = 3

# User data
USER_DATA_FILE = os.path.join(BASE_DIR, 'user_data.json')
CONTENT_INDEX_FILE = os.path.join(CONTENT_DIR, 'lessons.json')
