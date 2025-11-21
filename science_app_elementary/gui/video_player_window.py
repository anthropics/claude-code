#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video player window using pygame for video playback
"""

import tkinter as tk
from tkinter import messagebox
import os
import threading
from utils.persian_text import PersianText
from utils.config import *

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

class VideoPlayerWindow:
    """Video player window"""

    def __init__(self, window, content_manager, main_window, lesson=None):
        self.window = window
        self.content_manager = content_manager
        self.main_window = main_window
        self.lesson = lesson

        self.window.title(PersianText.display("پخش فیلم"))
        self.window.geometry("1000x700")
        self.window.configure(bg="#000000")

        self.playing = False
        self.video_path = None

        self.create_widgets()

        if lesson and lesson.get('video'):
            self.load_video(lesson['video'])

    def create_widgets(self):
        """Create video player widgets"""

        # Header
        header = tk.Frame(self.window, bg=COLOR_PRIMARY, height=60)
        header.pack(fill=tk.X)

        if self.lesson:
            title = PersianText.display(f"فیلم درس: {self.lesson.get('title', '')}")
        else:
            title = PersianText.display("پخش فیلم آموزشی")

        title_label = tk.Label(
            header,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_LARGE, "bold"),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            pady=15
        )
        title_label.pack()

        # Video display area
        self.video_frame = tk.Frame(self.window, bg="#000000", height=500)
        self.video_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Placeholder for video
        if PYGAME_AVAILABLE:
            placeholder_text = PersianText.display("آماده پخش فیلم...")
        else:
            placeholder_text = PersianText.display("لطفاً pygame را نصب کنید برای پخش ویدیو")

        self.placeholder_label = tk.Label(
            self.video_frame,
            text=placeholder_text,
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg="#000000",
            fg="#FFFFFF"
        )
        self.placeholder_label.pack(expand=True)

        # Control buttons
        control_frame = tk.Frame(self.window, bg=APP_BG_COLOR)
        control_frame.pack(fill=tk.X, pady=10)

        self.play_btn = tk.Button(
            control_frame,
            text=PersianText.display("▶️ پخش"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_SUCCESS,
            fg=COLOR_BG,
            width=10,
            command=self.play_pause
        )
        self.play_btn.pack(side=tk.LEFT, padx=10)

        self.stop_btn = tk.Button(
            control_frame,
            text=PersianText.display("⏹️ توقف"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_DANGER,
            fg=COLOR_BG,
            width=10,
            command=self.stop
        )
        self.stop_btn.pack(side=tk.LEFT, padx=10)

        # Volume control (simulated)
        vol_label = tk.Label(
            control_frame,
            text=PersianText.display("🔊 صدا"),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            bg=APP_BG_COLOR
        )
        vol_label.pack(side=tk.LEFT, padx=10)

        self.volume_scale = tk.Scale(
            control_frame,
            from_=0,
            to=100,
            orient=tk.HORIZONTAL,
            bg=APP_BG_COLOR,
            length=200
        )
        self.volume_scale.set(80)
        self.volume_scale.pack(side=tk.LEFT, padx=10)

        # Back button
        back_btn = tk.Button(
            control_frame,
            text=PersianText.display("🔙 بازگشت"),
            font=(FONT_FAMILY, FONT_SIZE_MEDIUM),
            bg=COLOR_PRIMARY,
            fg=COLOR_BG,
            command=self.close_window
        )
        back_btn.pack(side=tk.RIGHT, padx=10)

        # Info label
        info_text = PersianText.display("""
💡 راهنما: فیلم‌های آموزشی را با دقت تماشا کنید
پس از تماشای فیلم، بازی و آزمون را انجام دهید تا امتیاز بگیرید!
        """)
        info_label = tk.Label(
            self.window,
            text=info_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            bg=APP_BG_COLOR,
            fg=COLOR_TEXT,
            justify=tk.CENTER
        )
        info_label.pack(pady=5)

    def load_video(self, video_filename):
        """Load video file"""
        self.video_path = os.path.join(VIDEO_DIR, video_filename)

        if os.path.exists(self.video_path):
            video_name = PersianText.display(f"فایل بارگذاری شد: {video_filename}")
            self.placeholder_label.config(text=video_name)
        else:
            error_msg = PersianText.display(f"فایل ویدیو پیدا نشد: {video_filename}")
            self.placeholder_label.config(text=error_msg)
            messagebox.showerror(
                PersianText.display("خطا"),
                PersianText.display("فایل ویدیو پیدا نشد. لطفاً فایل را در پوشه assets/videos قرار دهید.")
            )

    def play_pause(self):
        """Play or pause video"""
        if not self.video_path or not os.path.exists(self.video_path):
            messagebox.showwarning(
                PersianText.display("هشدار"),
                PersianText.display("لطفاً ابتدا یک ویدیو انتخاب کنید")
            )
            return

        if not PYGAME_AVAILABLE:
            messagebox.showerror(
                PersianText.display("خطا"),
                PersianText.display("pygame نصب نشده است. برای نصب: pip install pygame")
            )
            return

        if self.playing:
            self.playing = False
            self.play_btn.config(text=PersianText.display("▶️ پخش"))
            status = PersianText.display("⏸️ متوقف شد")
            self.placeholder_label.config(text=status)
        else:
            self.playing = True
            self.play_btn.config(text=PersianText.display("⏸️ مکث"))
            status = PersianText.display("▶️ در حال پخش...")
            self.placeholder_label.config(text=status)

            # Simulate video playback (actual implementation would use pygame/opencv)
            self.simulate_video_playback()

            # Award points for watching
            if self.lesson:
                lesson_id = self.lesson.get('id')
                if lesson_id not in self.main_window.user_data.get('watched_videos', []):
                    self.main_window.user_data.setdefault('watched_videos', []).append(lesson_id)
                    self.main_window.update_points(10)
                    self.main_window.save_user_data()

    def simulate_video_playback(self):
        """Simulate video playback (placeholder for actual video player)"""
        # This is a placeholder. In a real implementation, you would:
        # 1. Use pygame.movie or opencv to play the actual video
        # 2. Embed the video in the tkinter window
        # 3. Handle play/pause/stop controls properly

        def play_thread():
            import time
            count = 0
            while self.playing and count < 10:
                time.sleep(1)
                count += 1
                if self.playing:
                    status = PersianText.display(f"▶️ در حال پخش... ({count * 10}%)")
                    try:
                        self.placeholder_label.config(text=status)
                    except:
                        break

            if count >= 10 and self.playing:
                self.playing = False
                completion_text = PersianText.display("✅ پخش کامل شد! +10 امتیاز")
                try:
                    self.placeholder_label.config(text=completion_text)
                    self.play_btn.config(text=PersianText.display("▶️ پخش"))
                except:
                    pass

        thread = threading.Thread(target=play_thread, daemon=True)
        thread.start()

    def stop(self):
        """Stop video playback"""
        self.playing = False
        self.play_btn.config(text=PersianText.display("▶️ پخش"))
        status = PersianText.display("⏹️ متوقف شد")
        self.placeholder_label.config(text=status)

    def close_window(self):
        """Close video player window"""
        self.playing = False
        self.window.destroy()
