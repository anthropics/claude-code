#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lesson browser window
"""

import tkinter as tk
from tkinter import ttk, messagebox
from utils.persian_text import PersianText
from utils.config import *

class LessonBrowser:
    """Lesson browser window"""

    def __init__(self, window, content_manager, main_window):
        self.window = window
        self.content_manager = content_manager
        self.main_window = main_window

        self.window.title(PersianText.display("درس‌ها"))
        self.window.geometry("900x700")
        self.window.configure(bg=APP_BG_COLOR)

        self.create_widgets()

    def create_widgets(self):
        """Create lesson browser widgets"""

        # Header
        header = tk.Frame(self.window, bg=COLOR_PRIMARY, height=60)
        header.pack(fill=tk.X)

        title = PersianText.display("📚 فهرست درس‌ها")
        title_label = tk.Label(
            header,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=15
        )
        title_label.pack()

        # Content frame with scrollbar
        content_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Canvas with scrollbar
        canvas = tk.Canvas(content_frame, bg=APP_BG_COLOR, highlightthickness=0)
        scrollbar = ttk.Scrollbar(content_frame, orient=tk.VERTICAL, command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=APP_BG_COLOR)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # Load lessons
        lessons = self.content_manager.get_all_lessons()

        if not lessons:
            no_lessons = PersianText.display("هنوز درسی اضافه نشده است")
            tk.Label(
                scrollable_frame,
                text=no_lessons,
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
                bg=APP_BG_COLOR,
                fg=COLOR_TEXT
            ).pack(pady=50)
        else:
            for i, lesson in enumerate(lessons):
                self.create_lesson_card(scrollable_frame, lesson, i)

        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Back button
        back_btn = tk.Button(
            self.window,
            text=PersianText.display("🔙 بازگشت"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_DANGER,
            fg=COLOR_BG,
            command=self.window.destroy
        )
        back_btn.pack(pady=10)

    def create_lesson_card(self, parent, lesson, index):
        """Create a lesson card"""

        card = tk.Frame(parent, bg=COLOR_BG, relief=tk.RAISED, bd=2)
        card.pack(fill=tk.X, pady=10, padx=10)

        # Lesson number and title
        title_frame = tk.Frame(card, bg=COLOR_PRIMARY)
        title_frame.pack(fill=tk.X)

        lesson_title = PersianText.display(f"درس {lesson.get('lesson_number', index+1)}: {lesson.get('title', '')}")
        title_label = tk.Label(
            title_frame,
            text=lesson_title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=10,
            padx=20
        )
        title_label.pack(anchor="e")

        # Description
        if lesson.get('description'):
            desc_text = PersianText.display(lesson['description'])
            desc_label = tk.Label(
                card,
                text=desc_text,
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                bg=COLOR_BG,
                fg=COLOR_TEXT,
                wraplength=700,
                justify=tk.RIGHT,
                pady=10,
                padx=20
            )
            desc_label.pack(anchor="e")

        # Buttons frame
        btn_frame = tk.Frame(card, bg=COLOR_BG)
        btn_frame.pack(fill=tk.X, padx=20, pady=10)

        # Video button
        if lesson.get('video'):
            video_btn = tk.Button(
                btn_frame,
                text=PersianText.display("🎥 تماشای فیلم"),
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                bg=COLOR_ACCENT,
                fg=COLOR_BG,
                command=lambda l=lesson: self.play_video(l)
            )
            video_btn.pack(side=tk.RIGHT, padx=5)

        # Game button
        if lesson.get('game'):
            game_btn = tk.Button(
                btn_frame,
                text=PersianText.display("🎮 بازی"),
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                bg=COLOR_SECONDARY,
                fg=COLOR_BG,
                command=lambda l=lesson: self.play_game(l)
            )
            game_btn.pack(side=tk.RIGHT, padx=5)

        # Quiz button
        if lesson.get('quiz'):
            quiz_btn = tk.Button(
                btn_frame,
                text=PersianText.display("📝 آزمون"),
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                bg=COLOR_WARNING,
                fg=COLOR_TEXT,
                command=lambda l=lesson: self.take_quiz(l)
            )
            quiz_btn.pack(side=tk.RIGHT, padx=5)

    def play_video(self, lesson):
        """Play lesson video"""
        from gui.video_player_window import VideoPlayerWindow
        video_window = tk.Toplevel(self.window)
        VideoPlayerWindow(video_window, self.content_manager, self.main_window, lesson)

    def play_game(self, lesson):
        """Play lesson game"""
        from gui.game_window import GameWindow
        game_window = tk.Toplevel(self.window)
        GameWindow(game_window, self.content_manager, self.main_window, lesson)

    def take_quiz(self, lesson):
        """Take lesson quiz"""
        from gui.quiz_window import QuizWindow
        quiz_window = tk.Toplevel(self.window)
        QuizWindow(quiz_window, self.content_manager, self.main_window, lesson)
