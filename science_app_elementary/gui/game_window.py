#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interactive games window
"""

import tkinter as tk
from tkinter import messagebox
import random
from utils.persian_text import PersianText
from utils.config import *

class GameWindow:
    """Interactive games window"""

    def __init__(self, window, content_manager, main_window, lesson=None):
        self.window = window
        self.content_manager = content_manager
        self.main_window = main_window
        self.lesson = lesson

        self.window.title(PersianText.display("بازی‌های آموزشی"))
        self.window.geometry("900x700")
        self.window.configure(bg=APP_BG_COLOR)

        self.score = 0
        self.current_game = None

        self.create_widgets()

    def create_widgets(self):
        """Create game window widgets"""

        # Header
        header = tk.Frame(self.window, bg=COLOR_SECONDARY, height=80)
        header.pack(fill=tk.X)

        if self.lesson:
            title = PersianText.display(f"🎮 بازی درس: {self.lesson.get('title', '')}")
        else:
            title = PersianText.display("🎮 بازی‌های آموزشی")

        title_label = tk.Label(
            header,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_SECONDARY,
            fg=COLOR_BG,
            pady=15
        )
        title_label.pack()

        # Score display
        score_text = PersianText.display(f"امتیاز این بازی: {self.score}")
        self.score_label = tk.Label(
            header,
            text=score_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_SECONDARY,
            fg=COLOR_WARNING
        )
        self.score_label.pack(pady=5)

        # Main content
        self.content_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        self.content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Load game menu
        self.show_game_menu()

        # Back button
        back_btn = tk.Button(
            self.window,
            text=PersianText.display("🔙 بازگشت"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_DANGER,
            fg=COLOR_BG,
            command=self.close_window
        )
        back_btn.pack(pady=10)

    def show_game_menu(self):
        """Show game selection menu"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        menu_text = PersianText.display("یک بازی را انتخاب کنید:")
        tk.Label(
            self.content_frame,
            text=menu_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=20)

        # Game options
        games = [
            ("🧩 تطبیق تصاویر", self.play_matching_game),
            ("❓ چند گزینه‌ای", self.play_multiple_choice),
            ("🎯 درست یا غلط", self.play_true_false),
            ("🔤 حدس کلمه", self.play_word_guess)
        ]

        for game_name, game_func in games:
            btn = tk.Button(
                self.content_frame,
                text=PersianText.display(game_name),
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
                bg=COLOR_SECONDARY,
                fg=COLOR_BG,
                width=25,
                height=2,
                command=game_func
            )
            btn.pack(pady=10)

    def play_matching_game(self):
        """Play matching game"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.current_game = "matching"

        title = PersianText.display("🧩 بازی تطبیق - موجودات زنده و غیر زنده را تطبیق دهید")
        tk.Label(
            self.content_frame,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=20)

        # Sample matching pairs for science topics
        items = [
            ("🌳 درخت", "زنده"),
            ("🪨 سنگ", "غیر زنده"),
            ("🐕 سگ", "زنده"),
            ("💧 آب", "غیر زنده"),
            ("🌺 گل", "زنده"),
            ("🪑 صندلی", "غیر زنده")
        ]

        random.shuffle(items)

        self.selected_item = None
        self.matched_pairs = []

        # Create grid of items
        grid_frame = tk.Frame(self.content_frame, bg=APP_BG_COLOR)
        grid_frame.pack(expand=True)

        for i, (item, category) in enumerate(items):
            btn = tk.Button(
                grid_frame,
                text=PersianText.display(item),
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
                bg=COLOR_ACCENT,
                fg=COLOR_TEXT,
                width=15,
                height=3,
                command=lambda it=item, cat=category: self.match_item(it, cat)
            )
            btn.grid(row=i // 2, column=i % 2, padx=20, pady=15)

    def match_item(self, item, category):
        """Handle item matching"""
        if self.selected_item is None:
            self.selected_item = (item, category)
            msg = PersianText.display(f"انتخاب شد: {item}\nیک مورد دیگر از همین دسته انتخاب کنید")
            messagebox.showinfo(PersianText.display("انتخاب شد"), msg)
        else:
            if self.selected_item[1] == category and self.selected_item[0] != item:
                # Correct match!
                self.score += POINTS_PER_CORRECT
                self.update_score()
                msg = PersianText.display(f"✅ آفرین! {POINTS_PER_CORRECT}+ امتیاز")
                messagebox.showinfo(PersianText.display("درست"), msg)
                self.matched_pairs.append(self.selected_item)
                self.matched_pairs.append((item, category))

                if len(self.matched_pairs) == 6:  # All matched
                    self.game_complete()
            else:
                msg = PersianText.display("❌ اشتباه! دوباره تلاش کنید")
                messagebox.showwarning(PersianText.display("اشتباه"), msg)

            self.selected_item = None

    def play_multiple_choice(self):
        """Play multiple choice game"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.current_game = "multiple_choice"

        # Sample questions
        questions = [
            {
                "question": "کدام یک از موارد زیر موجود زنده است؟",
                "options": ["سنگ", "گل", "آب", "هوا"],
                "correct": "گل"
            },
            {
                "question": "گیاهان برای رشد به چه چیزی نیاز دارند؟",
                "options": ["تاریکی", "نور خورشید", "سرما", "سنگ"],
                "correct": "نور خورشید"
            },
            {
                "question": "کدام حیوان پستانداراست؟",
                "options": ["ماهی", "پرنده", "گربه", "مار"],
                "correct": "گربه"
            }
        ]

        self.current_question = random.choice(questions)

        # Question
        q_text = PersianText.display(self.current_question["question"])
        tk.Label(
            self.content_frame,
            text=q_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            wraplength=700
        ).pack(pady=30)

        # Options
        for option in self.current_question["options"]:
            btn = tk.Button(
                self.content_frame,
                text=PersianText.display(option),
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
                bg=COLOR_PRIMARY,
                fg=COLOR_BG,
                width=30,
                height=2,
                command=lambda opt=option: self.check_answer(opt)
            )
            btn.pack(pady=10)

    def check_answer(self, selected):
        """Check multiple choice answer"""
        if selected == self.current_question["correct"]:
            self.score += POINTS_PER_CORRECT
            self.update_score()
            msg = PersianText.display(f"✅ آفرین! پاسخ درست است\n{POINTS_PER_CORRECT}+ امتیاز")
            messagebox.showinfo(PersianText.display("درست"), msg)
            self.game_complete()
        else:
            msg = PersianText.display(f"❌ اشتباه!\nپاسخ درست: {self.current_question['correct']}")
            messagebox.showwarning(PersianText.display("اشتباه"), msg)

    def play_true_false(self):
        """Play true/false game"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.current_game = "true_false"

        # Sample statements
        statements = [
            {"text": "همه موجودات زنده نیاز به آب دارند", "answer": True},
            {"text": "سنگ یک موجود زنده است", "answer": False},
            {"text": "گیاهان غذای خود را می‌سازند", "answer": True},
            {"text": "حیوانات نیاز به اکسیژن ندارند", "answer": False}
        ]

        self.current_statement = random.choice(statements)

        # Statement
        stmt_text = PersianText.display(self.current_statement["text"])
        tk.Label(
            self.content_frame,
            text=stmt_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            wraplength=700
        ).pack(pady=50)

        # True/False buttons
        btn_frame = tk.Frame(self.content_frame, bg=APP_BG_COLOR)
        btn_frame.pack(pady=30)

        true_btn = tk.Button(
            btn_frame,
            text=PersianText.display("✅ درست"),
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            width=15,
            height=3,
            command=lambda: self.check_true_false(True)
        )
        true_btn.pack(side=tk.LEFT, padx=20)

        false_btn = tk.Button(
            btn_frame,
            text=PersianText.display("❌ غلط"),
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_DANGER,
            fg=COLOR_BG,
            width=15,
            height=3,
            command=lambda: self.check_true_false(False)
        )
        false_btn.pack(side=tk.LEFT, padx=20)

    def check_true_false(self, answer):
        """Check true/false answer"""
        if answer == self.current_statement["answer"]:
            self.score += POINTS_PER_CORRECT
            self.update_score()
            msg = PersianText.display(f"✅ آفرین! پاسخ درست است\n{POINTS_PER_CORRECT}+ امتیاز")
            messagebox.showinfo(PersianText.display("درست"), msg)
            self.game_complete()
        else:
            msg = PersianText.display("❌ اشتباه! دوباره فکر کنید")
            messagebox.showwarning(PersianText.display("اشتباه"), msg)

    def play_word_guess(self):
        """Play word guessing game"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.current_game = "word_guess"

        title = PersianText.display("🔤 حدس کلمه - حروف پراکنده را مرتب کنید")
        tk.Label(
            self.content_frame,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=20)

        # Sample words
        words = [
            ("گیاه", "موجود زنده که غذای خود را می‌سازد"),
            ("حیوان", "موجود زنده که حرکت می‌کند"),
            ("اکسیژن", "گازی که برای تنفس نیاز است"),
            ("خورشید", "منبع نور و گرما")
        ]

        word, hint = random.choice(words)
        scrambled = ''.join(random.sample(word, len(word)))

        hint_text = PersianText.display(f"راهنما: {hint}")
        tk.Label(
            self.content_frame,
            text=hint_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=20)

        scrambled_text = PersianText.display(f"حروف پراکنده: {scrambled}")
        tk.Label(
            self.content_frame,
            text=scrambled_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_WARNING,
            fg=COLOR_TEXT,
            pady=20,
            padx=40
        ).pack(pady=30)

        # Answer entry
        answer_text = PersianText.display("پاسخ شما:")
        tk.Label(
            self.content_frame,
            text=answer_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=10)

        answer_entry = tk.Entry(
            self.content_frame,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            width=20,
            justify=tk.CENTER
        )
        answer_entry.pack(pady=10)

        submit_btn = tk.Button(
            self.content_frame,
            text=PersianText.display("✅ بررسی پاسخ"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            command=lambda: self.check_word_guess(answer_entry.get(), word)
        )
        submit_btn.pack(pady=20)

    def check_word_guess(self, guess, correct):
        """Check word guess answer"""
        if guess.strip() == correct:
            self.score += POINTS_PER_CORRECT
            self.update_score()
            msg = PersianText.display(f"✅ آفرین! کلمه درست است\n{POINTS_PER_CORRECT}+ امتیاز")
            messagebox.showinfo(PersianText.display("درست"), msg)
            self.game_complete()
        else:
            msg = PersianText.display("❌ اشتباه! دوباره تلاش کنید")
            messagebox.showwarning(PersianText.display("اشتباه"), msg)

    def update_score(self):
        """Update score display"""
        score_text = PersianText.display(f"امتیاز این بازی: {self.score}")
        self.score_label.config(text=score_text)

    def game_complete(self):
        """Handle game completion"""
        # Add bonus points
        self.score += POINTS_PER_GAME_COMPLETE
        self.update_score()

        # Update main window
        self.main_window.update_points(self.score)
        self.main_window.update_stars(STARS_FOR_COMPLETE)

        # Save completion
        if self.lesson:
            lesson_id = self.lesson.get('id')
            if lesson_id not in self.main_window.user_data.get('completed_games', []):
                self.main_window.user_data.setdefault('completed_games', []).append(lesson_id)
                self.main_window.save_user_data()

        msg = PersianText.display(f"""
🎉 تبریک! بازی را تکمیل کردید!

💰 امتیاز کسب شده: {self.score}
⭐ ستاره جدید: {STARS_FOR_COMPLETE}

آیا می‌خواهید دوباره بازی کنید؟
        """)

        result = messagebox.askyesno(
            PersianText.display("تکمیل بازی"),
            msg
        )

        if result:
            self.score = 0
            self.update_score()
            self.show_game_menu()
        else:
            self.close_window()

    def close_window(self):
        """Close game window"""
        self.window.destroy()
