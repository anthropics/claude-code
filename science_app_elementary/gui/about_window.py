#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
About/Credits window showing school and developer information
"""

import tkinter as tk
from utils.persian_text import PersianText
from utils.config import *

class AboutWindow:
    """About/Credits window"""

    def __init__(self, window):
        self.window = window
        self.window.title(PersianText.display("درباره برنامه"))
        self.window.geometry("600x700")
        self.window.configure(bg=APP_BG_COLOR)

        # Make window modal
        self.window.transient()
        self.window.grab_set()

        self.create_widgets()

    def create_widgets(self):
        """Create about window widgets"""

        # Header
        header = tk.Frame(self.window, bg=COLOR_PRIMARY, height=80)
        header.pack(fill=tk.X)

        title = PersianText.display("🎓 درباره برنامه")
        title_label = tk.Label(
            header,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=20
        )
        title_label.pack()

        # Main content
        content_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=30, pady=20)

        # App info
        app_info = f"""
برنامه آموزش علوم تجربی
پایه سوم دبستان

نسخه {APP_VERSION}
سال تحصیلی {APP_YEAR}
        """

        tk.Label(
            content_frame,
            text=PersianText.display(app_info.strip()),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            justify=tk.CENTER
        ).pack(pady=20)

        # Separator
        tk.Frame(content_frame, height=2, bg=COLOR_PRIMARY).pack(fill=tk.X, pady=10)

        # School information
        school_frame = tk.Frame(content_frame, bg=COLOR_BG, relief=tk.RAISED, bd=2)
        school_frame.pack(fill=tk.X, pady=10)

        school_title = PersianText.display("🏫 اطلاعات مدرسه")
        tk.Label(
            school_frame,
            text=school_title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_SECONDARY,
            fg=COLOR_BG,
            pady=10
        ).pack(fill=tk.X)

        school_info = f"""
نام مدرسه: {SCHOOL_NAME}

مدیر محترم: {PRINCIPAL_NAME}

معلم محترم: {TEACHER_NAME}
        """

        tk.Label(
            school_frame,
            text=PersianText.display(school_info.strip()),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_BG,
            fg=COLOR_TEXT,
            justify=tk.CENTER,
            pady=15
        ).pack()

        # Developer information
        dev_frame = tk.Frame(content_frame, bg=COLOR_BG, relief=tk.RAISED, bd=2)
        dev_frame.pack(fill=tk.X, pady=10)

        dev_title = PersianText.display("👨‍💻 سازنده")
        tk.Label(
            dev_frame,
            text=dev_title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_ACCENT,
            fg=COLOR_BG,
            pady=10
        ).pack(fill=tk.X)

        dev_info = f"""
طراح و برنامه‌نویس: {DEVELOPER_NAME}

ساخته شده با ❤️ برای دانش‌آموزان عزیز
        """

        tk.Label(
            dev_frame,
            text=PersianText.display(dev_info.strip()),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_BG,
            fg=COLOR_TEXT,
            justify=tk.CENTER,
            pady=15
        ).pack()

        # Features
        features_frame = tk.Frame(content_frame, bg=COLOR_BG_LIGHT, relief=tk.GROOVE, bd=2)
        features_frame.pack(fill=tk.X, pady=10)

        features_title = PersianText.display("✨ ویژگی‌ها")
        tk.Label(
            features_frame,
            text=features_title,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_BG_LIGHT,
            fg=COLOR_TEXT,
            pady=5
        ).pack()

        features = """
🎥 فیلم‌های آموزشی انیمیشنی با صدا
🎮 بازی‌های تعاملی و سرگرم‌کننده
📝 آزمون‌های جامع و کامل
🏆 سیستم امتیازدهی و پاداش
📚 محتوای مطابق با کتاب درسی
💾 قابلیت اجرای آفلاین
        """

        tk.Label(
            features_frame,
            text=PersianText.display(features.strip()),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            bg=COLOR_BG_LIGHT,
            fg=COLOR_TEXT,
            justify=tk.RIGHT,
            pady=10
        ).pack(anchor="e", padx=20)

        # Copyright
        copyright_text = PersianText.display(f"© {APP_YEAR} - تمامی حقوق محفوظ است")
        tk.Label(
            content_frame,
            text=copyright_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            pady=10
        ).pack()

        # Close button
        close_btn = tk.Button(
            self.window,
            text=PersianText.display("✅ بستن"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            width=15,
            height=2,
            command=self.window.destroy
        )
        close_btn.pack(pady=10)
