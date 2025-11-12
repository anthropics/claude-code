#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quiz/test window
"""

import tkinter as tk
from tkinter import messagebox
from utils.persian_text import PersianText
from utils.config import *

class QuizWindow:
    """Quiz window for testing knowledge"""

    def __init__(self, window, content_manager, main_window, lesson=None):
        self.window = window
        self.content_manager = content_manager
        self.main_window = main_window
        self.lesson = lesson

        self.window.title(PersianText.display("آزمون"))
        self.window.geometry("900x700")
        self.window.configure(bg=APP_BG_COLOR)

        self.current_question_index = 0
        self.score = 0
        self.questions = []
        self.user_answers = []

        self.create_widgets()
        self.load_quiz()

    def create_widgets(self):
        """Create quiz widgets"""

        # Header
        header = tk.Frame(self.window, bg=COLOR_WARNING, height=80)
        header.pack(fill=tk.X)

        if self.lesson:
            title = PersianText.display(f"📝 آزمون درس: {self.lesson.get('title', '')}")
        else:
            title = PersianText.display("📝 آزمون")

        title_label = tk.Label(
            header,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_WARNING,
            fg=COLOR_TEXT,
            pady=15
        )
        title_label.pack()

        # Progress
        self.progress_label = tk.Label(
            header,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_WARNING,
            fg=COLOR_TEXT
        )
        self.progress_label.pack(pady=5)

        # Main content frame
        self.content_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        self.content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Navigation buttons
        nav_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        nav_frame.pack(fill=tk.X, pady=10)

        self.prev_btn = tk.Button(
            nav_frame,
            text=PersianText.display("⏮️ قبلی"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            command=self.previous_question
        )
        self.prev_btn.pack(side=tk.LEFT, padx=10)

        self.next_btn = tk.Button(
            nav_frame,
            text=PersianText.display("بعدی ⏭️"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            command=self.next_question
        )
        self.next_btn.pack(side=tk.LEFT, padx=10)

        self.submit_btn = tk.Button(
            nav_frame,
            text=PersianText.display("✅ اتمام آزمون"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            command=self.submit_quiz
        )
        self.submit_btn.pack(side=tk.LEFT, padx=10)

        back_btn = tk.Button(
            nav_frame,
            text=PersianText.display("🔙 بازگشت"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_DANGER,
            fg=COLOR_BG,
            command=self.window.destroy
        )
        back_btn.pack(side=tk.RIGHT, padx=10)

    def load_quiz(self):
        """Load quiz questions"""
        if self.lesson and self.lesson.get('quiz'):
            self.questions = self.lesson['quiz']
        else:
            # Sample questions
            self.questions = [
                {
                    "question": "موجودات زنده به چه چیزهایی نیاز دارند؟",
                    "options": [
                        "غذا، آب، هوا",
                        "فقط غذا",
                        "فقط آب",
                        "هیچ چیز"
                    ],
                    "correct": 0
                },
                {
                    "question": "کدام یک موجود غیر زنده است؟",
                    "options": [
                        "گل",
                        "درخت",
                        "سنگ",
                        "حشره"
                    ],
                    "correct": 2
                },
                {
                    "question": "گیاهان چگونه غذا می‌سازند؟",
                    "options": [
                        "از خاک می‌گیرند",
                        "با نور خورشید می‌سازند",
                        "از حیوانات می‌گیرند",
                        "نمی‌سازند"
                    ],
                    "correct": 1
                }
            ]

        self.user_answers = [None] * len(self.questions)
        self.show_question()

    def show_question(self):
        """Display current question"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        # Update progress
        progress_text = PersianText.display(
            f"سوال {self.current_question_index + 1} از {len(self.questions)}"
        )
        self.progress_label.config(text=progress_text)

        # Get current question
        question = self.questions[self.current_question_index]

        # Question text
        q_text = PersianText.display(f"{self.current_question_index + 1}. {question['question']}")
        tk.Label(
            self.content_frame,
            text=q_text,
            font=(FONT_FAMILY, FONT_SIZE_LARGE),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            wraplength=700,
            justify=tk.RIGHT
        ).pack(pady=30, anchor="e", padx=20)

        # Options
        self.selected_option = tk.IntVar(value=-1)
        if self.user_answers[self.current_question_index] is not None:
            self.selected_option.set(self.user_answers[self.current_question_index])

        for i, option in enumerate(question['options']):
            option_text = PersianText.display(option)
            rb = tk.Radiobutton(
                self.content_frame,
                text=option_text,
                variable=self.selected_option,
                value=i,
                font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
                bg=APP_BG_COLOR,
                fg=COLOR_TEXT,
                selectcolor=COLOR_SUCCESS,
                command=lambda: self.save_answer(self.selected_option.get())
            )
            rb.pack(anchor="e", pady=10, padx=40)

        # Update button states
        self.prev_btn.config(state=tk.NORMAL if self.current_question_index > 0 else tk.DISABLED)
        self.next_btn.config(
            state=tk.NORMAL if self.current_question_index < len(self.questions) - 1 else tk.DISABLED
        )

    def save_answer(self, answer):
        """Save user's answer for current question"""
        self.user_answers[self.current_question_index] = answer

    def previous_question(self):
        """Go to previous question"""
        if self.current_question_index > 0:
            self.current_question_index -= 1
            self.show_question()

    def next_question(self):
        """Go to next question"""
        if self.current_question_index < len(self.questions) - 1:
            self.current_question_index += 1
            self.show_question()

    def submit_quiz(self):
        """Submit quiz and show results"""
        # Check if all questions answered
        if None in self.user_answers:
            unanswered = [i + 1 for i, ans in enumerate(self.user_answers) if ans is None]
            msg = PersianText.display(
                f"لطفاً به همه سوالات پاسخ دهید\nسوالات بی‌پاسخ: {', '.join(map(str, unanswered))}"
            )
            messagebox.showwarning(PersianText.display("هشدار"), msg)
            return

        # Calculate score
        correct_count = 0
        for i, question in enumerate(self.questions):
            if self.user_answers[i] == question['correct']:
                correct_count += 1

        # Calculate points
        percentage = (correct_count / len(self.questions)) * 100
        points_earned = int((percentage / 100) * POINTS_PER_GAME_COMPLETE)

        # Update user data
        self.main_window.update_points(points_earned)

        # Award stars if passed
        if percentage >= 70:
            self.main_window.update_stars(STARS_FOR_COMPLETE)
            stars_msg = PersianText.display(f"\n⭐ {STARS_FOR_COMPLETE} ستاره جدید!")
        else:
            stars_msg = ""

        # Save completion
        if self.lesson and percentage >= 70:
            lesson_id = self.lesson.get('id')
            if lesson_id not in self.main_window.user_data.get('completed_lessons', []):
                self.main_window.user_data.setdefault('completed_lessons', []).append(lesson_id)
                self.main_window.save_user_data()

        # Show results
        if percentage >= 70:
            result_emoji = "🎉"
            result_status = "قبول شدید!"
        else:
            result_emoji = "📚"
            result_status = "نیاز به تمرین بیشتر"

        msg = PersianText.display(f"""
{result_emoji} نتیجه آزمون

پاسخ درست: {correct_count} از {len(self.questions)}
درصد: {percentage:.0f}%
امتیاز: {points_earned}
{stars_msg}

{result_status}
        """)

        messagebox.showinfo(
            PersianText.display("نتیجه آزمون"),
            msg
        )

        # Show detailed results
        self.show_detailed_results(correct_count, percentage)

    def show_detailed_results(self, correct_count, percentage):
        """Show detailed quiz results"""
        # Clear content frame
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        # Hide navigation buttons
        self.prev_btn.pack_forget()
        self.next_btn.pack_forget()
        self.submit_btn.pack_forget()

        # Results header
        if percentage >= 70:
            header_bg = COLOR_SUCCESS
            header_text = "🎉 آفرین! قبول شدید"
        else:
            header_bg = COLOR_WARNING
            header_text = "📚 نیاز به تمرین بیشتر"

        result_header = tk.Label(
            self.content_frame,
            text=PersianText.display(header_text),
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=header_bg,
            fg=COLOR_TEXT,
            pady=20
        )
        result_header.pack(fill=tk.X, pady=10)

        # Score summary
        summary = PersianText.display(f"نمره شما: {correct_count}/{len(self.questions)} ({percentage:.0f}%)")
        tk.Label(
            self.content_frame,
            text=summary,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT
        ).pack(pady=20)

        # Detailed answers
        scrollable_frame = tk.Frame(self.content_frame, bg=APP_BG_COLOR)
        scrollable_frame.pack(fill=tk.BOTH, expand=True)

        for i, question in enumerate(self.questions):
            is_correct = self.user_answers[i] == question['correct']

            q_frame = tk.Frame(scrollable_frame, bg=COLOR_BG, relief=tk.RIDGE, bd=2)
            q_frame.pack(fill=tk.X, pady=5, padx=10)

            # Question
            q_text = PersianText.display(f"{i + 1}. {question['question']}")
            tk.Label(
                q_frame,
                text=q_text,
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                bg=COLOR_BG,
                fg=COLOR_TEXT,
                wraplength=600,
                justify=tk.RIGHT
            ).pack(anchor="e", padx=10, pady=5)

            # User answer
            user_ans_text = question['options'][self.user_answers[i]]
            status = "✅" if is_correct else "❌"
            ans_text = PersianText.display(f"{status} پاسخ شما: {user_ans_text}")
            tk.Label(
                q_frame,
                text=ans_text,
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                bg=COLOR_BG,
                fg=COLOR_SUCCESS if is_correct else COLOR_DANGER,
                justify=tk.RIGHT
            ).pack(anchor="e", padx=10, pady=2)

            # Correct answer if wrong
            if not is_correct:
                correct_ans_text = question['options'][question['correct']]
                correct_text = PersianText.display(f"✓ پاسخ درست: {correct_ans_text}")
                tk.Label(
                    q_frame,
                    text=correct_text,
                    font=(FONT_FAMILY, FONT_SIZE_SMALL),
                    bg=COLOR_BG,
                    fg=COLOR_SUCCESS,
                    justify=tk.RIGHT
                ).pack(anchor="e", padx=10, pady=2)
