#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main application window
"""

import tkinter as tk
from tkinter import ttk, messagebox
from utils.persian_text import PersianText
from utils.config import *
from gui.lesson_browser import LessonBrowser
from gui.video_player_window import VideoPlayerWindow
from gui.game_window import GameWindow
from gui.about_window import AboutWindow
from content.content_manager import ContentManager
import json
import os

class MainWindow:
    """Main application window"""

    def __init__(self, root):
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry(f"{APP_WIDTH}x{APP_HEIGHT}")
        self.root.configure(bg=APP_BG_COLOR)

        # Initialize content manager
        self.content_manager = ContentManager()

        # Load or create user data
        self.user_data = self.load_user_data()

        # Create UI
        self.create_widgets()

    def create_widgets(self):
        """Create main UI widgets"""

        # Header frame
        header_frame = tk.Frame(self.root, bg=COLOR_PRIMARY, height=100)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        # Title label
        title_text = PersianText.display("علوم تجربی پایه سوم دبستان")
        title_label = tk.Label(
            header_frame,
            text=title_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=10
        )
        title_label.pack()

        # School name
        school_text = PersianText.display(f"🏫 {SCHOOL_NAME}")
        school_label = tk.Label(
            header_frame,
            text=school_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=5
        )
        school_label.pack()

        # User info frame
        user_frame = tk.Frame(header_frame, bg=COLOR_PRIMARY)
        user_frame.pack(fill=tk.X, padx=20, pady=5)

        points_text = PersianText.display(f"امتیاز: {self.user_data.get('points', 0)}")
        self.points_label = tk.Label(
            user_frame,
            text=points_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_WARNING
        )
        self.points_label.pack(side=tk.RIGHT, padx=20)

        stars_text = PersianText.display(f"⭐ {self.user_data.get('stars', 0)}")
        self.stars_label = tk.Label(
            user_frame,
            text=stars_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_WARNING
        )
        self.stars_label.pack(side=tk.RIGHT, padx=20)

        # Main content frame
        content_frame = tk.Frame(self.root, bg=APP_BG_COLOR)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Welcome message
        welcome_text = PersianText.display("! به برنامه علوم تجربی خوش آمدی")
        welcome_label = tk.Label(
            content_frame,
            text=welcome_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        )
        welcome_label.pack(pady=20)

        # Menu buttons frame
        button_frame = tk.Frame(content_frame, bg=APP_BG_COLOR)
        button_frame.pack(expand=True)

        # Create menu buttons
        buttons = [
            ("📚 درس‌ها", self.open_lessons, COLOR_PRIMARY),
            ("🎮 بازی‌ها", self.open_games, COLOR_SECONDARY),
            ("🎥 فیلم‌ها", self.open_videos, COLOR_ACCENT),
            ("📊 پیشرفت من", self.show_progress, COLOR_SUCCESS),
            ("ℹ️ درباره برنامه", self.show_about, "#9B59B6")
        ]

        for i, (text, command, color) in enumerate(buttons):
            display_text = PersianText.display(text)
            btn = tk.Button(
                button_frame,
                text=display_text,
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
                bg=color,
                fg=COLOR_BG,
                width=20,
                height=2,
                relief=tk.RAISED,
                bd=3,
                cursor="hand2",
                command=command
            )
            # Layout: 2 columns for first 4 buttons, last button centered
            if i < 4:
                btn.grid(row=i // 2, column=i % 2, padx=20, pady=15, sticky="nsew")
            else:
                btn.grid(row=2, column=0, columnspan=2, padx=20, pady=15, sticky="ew")

            # Hover effects
            btn.bind("<Enter>", lambda e, b=btn: b.config(relief=tk.SUNKEN))
            btn.bind("<Leave>", lambda e, b=btn: b.config(relief=tk.RAISED))

        # Configure grid weights
        button_frame.grid_columnconfigure(0, weight=1)
        button_frame.grid_columnconfigure(1, weight=1)

        # Footer with school info
        footer_frame = tk.Frame(self.root, bg=APP_BG_COLOR)
        footer_frame.pack(side=tk.BOTTOM, pady=5)

        footer_text = PersianText.display(f"ساخته شده توسط {DEVELOPER_NAME} با ❤️ برای دانش‌آموزان عزیز")
        footer_label = tk.Label(
            footer_frame,
            text=footer_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        )
        footer_label.pack()

    def open_lessons(self):
        """Open lessons browser"""
        lesson_window = tk.Toplevel(self.root)
        LessonBrowser(lesson_window, self.content_manager, self)

    def open_games(self):
        """Open games menu"""
        game_window = tk.Toplevel(self.root)
        GameWindow(game_window, self.content_manager, self)

    def open_videos(self):
        """Open video player"""
        video_window = tk.Toplevel(self.root)
        VideoPlayerWindow(video_window, self.content_manager, self)

    def show_progress(self):
        """Show user progress"""
        progress_text = f"""
پیشرفت تحصیلی شما:

⭐ ستاره‌ها: {self.user_data.get('stars', 0)}
🏆 امتیاز: {self.user_data.get('points', 0)}
📚 درس‌های تکمیل شده: {len(self.user_data.get('completed_lessons', []))}
🎮 بازی‌های انجام شده: {len(self.user_data.get('completed_games', []))}
        """

        display_text = PersianText.display(progress_text.strip())
        messagebox.showinfo(
            PersianText.display("پیشرفت من"),
            display_text
        )

    def show_about(self):
        """Show about window"""
        about_window = tk.Toplevel(self.root)
        AboutWindow(about_window)

    def update_points(self, points):
        """Update user points"""
        self.user_data['points'] = self.user_data.get('points', 0) + points
        self.save_user_data()
        points_text = PersianText.display(f"امتیاز: {self.user_data['points']}")
        self.points_label.config(text=points_text)

    def update_stars(self, stars):
        """Update user stars"""
        self.user_data['stars'] = self.user_data.get('stars', 0) + stars
        self.save_user_data()
        stars_text = PersianText.display(f"⭐ {self.user_data['stars']}")
        self.stars_label.config(text=stars_text)

    def load_user_data(self):
        """Load user data from file"""
        if os.path.exists(USER_DATA_FILE):
            try:
                with open(USER_DATA_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass

        return {
            'points': 0,
            'stars': 0,
            'completed_lessons': [],
            'completed_games': [],
            'watched_videos': []
        }

    def save_user_data(self):
        """Save user data to file"""
        with open(USER_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.user_data, f, ensure_ascii=False, indent=2)
