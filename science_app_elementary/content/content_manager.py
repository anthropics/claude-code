#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Content management system for lessons, videos, and games
"""

import json
import os
from utils.config import CONTENT_INDEX_FILE, CONTENT_DIR

class ContentManager:
    """Manages educational content"""

    def __init__(self):
        self.lessons = []
        self.load_content()

    def load_content(self):
        """Load content from JSON file"""
        if os.path.exists(CONTENT_INDEX_FILE):
            try:
                with open(CONTENT_INDEX_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.lessons = data.get('lessons', [])
            except Exception as e:
                print(f"Error loading content: {e}")
                self.create_default_content()
        else:
            self.create_default_content()

    def create_default_content(self):
        """Create default content structure"""
        os.makedirs(CONTENT_DIR, exist_ok=True)

        default_content = {
            "lessons": [
                {
                    "id": "lesson_1",
                    "lesson_number": 1,
                    "title": "موجودات زنده و غیر زنده",
                    "description": "در این درس با موجودات زنده و غیر زنده آشنا می‌شویم و تفاوت‌های آن‌ها را یاد می‌گیریم.",
                    "video": "lesson1_living_nonliving.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "کدام یک از موارد زیر موجود زنده است؟",
                            "options": ["سنگ", "گل", "آب", "هوا"],
                            "correct": 1
                        },
                        {
                            "question": "موجودات زنده به چه چیزهایی نیاز دارند؟",
                            "options": ["فقط غذا", "غذا، آب و هوا", "فقط آب", "هیچ چیز"],
                            "correct": 1
                        },
                        {
                            "question": "کدام یک موجود غیر زنده است؟",
                            "options": ["درخت", "گربه", "سنگ", "گل"],
                            "correct": 2
                        }
                    ]
                },
                {
                    "id": "lesson_2",
                    "lesson_number": 2,
                    "title": "گیاهان و رشد آن‌ها",
                    "description": "یاد می‌گیریم که گیاهان چگونه رشد می‌کنند و به چه چیزهایی نیاز دارند.",
                    "video": "lesson2_plants.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "گیاهان برای رشد به چه چیزی نیاز دارند؟",
                            "options": ["تاریکی", "نور خورشید", "سرما", "سنگ"],
                            "correct": 1
                        },
                        {
                            "question": "گیاهان غذای خود را چگونه تهیه می‌کنند؟",
                            "options": ["از خاک می‌گیرند", "خودشان می‌سازند", "از حیوانات می‌گیرند", "از هوا می‌گیرند"],
                            "correct": 1
                        },
                        {
                            "question": "ریشه گیاه چه کاری انجام می‌دهد؟",
                            "options": ["عکس می‌گیرد", "آب و مواد غذایی جذب می‌کند", "نور می‌سازد", "هیچ کاری"],
                            "correct": 1
                        }
                    ]
                },
                {
                    "id": "lesson_3",
                    "lesson_number": 3,
                    "title": "حیوانات و زیستگاه آن‌ها",
                    "description": "در مورد انواع مختلف حیوانات و محل زندگی آن‌ها یاد می‌گیریم.",
                    "video": "lesson3_animals.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "کدام حیوان در آب زندگی می‌کند؟",
                            "options": ["گربه", "ماهی", "سگ", "پرنده"],
                            "correct": 1
                        },
                        {
                            "question": "کدام یک پستاندار است؟",
                            "options": ["ماهی", "مار", "گربه", "مگس"],
                            "correct": 2
                        },
                        {
                            "question": "پرندگان با چه چیزی پرواز می‌کنند؟",
                            "options": ["پاها", "بال‌ها", "دم", "منقار"],
                            "correct": 1
                        }
                    ]
                },
                {
                    "id": "lesson_4",
                    "lesson_number": 4,
                    "title": "آب و اهمیت آن",
                    "description": "یاد می‌گیریم که آب چقدر مهم است و چرا باید از آن مراقبت کنیم.",
                    "video": "lesson4_water.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "آب در چه حالت‌هایی وجود دارد؟",
                            "options": ["فقط مایع", "جامد، مایع و گاز", "فقط یخ", "فقط بخار"],
                            "correct": 1
                        },
                        {
                            "question": "موجودات زنده به آب نیاز دارند؟",
                            "options": ["خیر", "بله", "فقط گیاهان", "فقط حیوانات"],
                            "correct": 1
                        },
                        {
                            "question": "باران از کجا می‌آید؟",
                            "options": ["از زمین", "از ابرها", "از خورشید", "از ماه"],
                            "correct": 1
                        }
                    ]
                },
                {
                    "id": "lesson_5",
                    "lesson_number": 5,
                    "title": "هوا و اهمیت آن",
                    "description": "درباره هوا و اهمیت آن برای زندگی یاد می‌گیریم.",
                    "video": "lesson5_air.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "ما برای تنفس به چه چیزی نیاز داریم؟",
                            "options": ["آب", "هوا", "غذا", "نور"],
                            "correct": 1
                        },
                        {
                            "question": "باد چیست؟",
                            "options": ["آب در حرکت", "هوای در حرکت", "خاک در حرکت", "نور در حرکت"],
                            "correct": 1
                        },
                        {
                            "question": "گیاهان چه گازی تولید می‌کنند؟",
                            "options": ["دی اکسید کربن", "اکسیژن", "نیتروژن", "هیدروژن"],
                            "correct": 1
                        }
                    ]
                },
                {
                    "id": "lesson_6",
                    "lesson_number": 6,
                    "title": "خورشید و نور آن",
                    "description": "خورشید را بیشتر بشناسیم و بدانیم چرا برای ما مهم است.",
                    "video": "lesson6_sun.mp4",
                    "game": True,
                    "quiz": [
                        {
                            "question": "خورشید چه چیزی به ما می‌دهد؟",
                            "options": ["نور و گرما", "فقط نور", "فقط گرما", "آب"],
                            "correct": 0
                        },
                        {
                            "question": "شب چرا تاریک می‌شود؟",
                            "options": ["خورشید خاموش می‌شود", "زمین می‌چرخد", "ابرها آمده‌اند", "ماه جلوی خورشید است"],
                            "correct": 1
                        },
                        {
                            "question": "گیاهان برای ساختن غذا به چه چیزی نیاز دارند؟",
                            "options": ["نور ماه", "نور خورشید", "نور ستاره", "تاریکی"],
                            "correct": 1
                        }
                    ]
                }
            ]
        }

        with open(CONTENT_INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_content, f, ensure_ascii=False, indent=2)

        self.lessons = default_content['lessons']

    def get_all_lessons(self):
        """Get all lessons"""
        return self.lessons

    def get_lesson_by_id(self, lesson_id):
        """Get a specific lesson by ID"""
        for lesson in self.lessons:
            if lesson.get('id') == lesson_id:
                return lesson
        return None

    def get_lesson_by_number(self, lesson_number):
        """Get a specific lesson by number"""
        for lesson in self.lessons:
            if lesson.get('lesson_number') == lesson_number:
                return lesson
        return None

    def add_lesson(self, lesson):
        """Add a new lesson"""
        self.lessons.append(lesson)
        self.save_content()

    def update_lesson(self, lesson_id, updated_lesson):
        """Update an existing lesson"""
        for i, lesson in enumerate(self.lessons):
            if lesson.get('id') == lesson_id:
                self.lessons[i] = updated_lesson
                self.save_content()
                return True
        return False

    def delete_lesson(self, lesson_id):
        """Delete a lesson"""
        self.lessons = [l for l in self.lessons if l.get('id') != lesson_id]
        self.save_content()

    def save_content(self):
        """Save content to JSON file"""
        content = {"lessons": self.lessons}
        with open(CONTENT_INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
