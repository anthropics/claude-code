#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automatic video script generator for educational content
تولید خودکار اسکریپت ویدیوهای آموزشی
"""

import json
import os
from typing import List, Dict

class ScriptGenerator:
    """Generate video scripts from lesson content"""

    def __init__(self):
        self.scripts = []

    def generate_lesson_script(self, lesson: Dict) -> Dict:
        """Generate detailed script for a lesson"""

        lesson_id = lesson.get('id')
        lesson_number = lesson.get('lesson_number')
        title = lesson.get('title')
        description = lesson.get('description')

        # Generate scenes based on lesson content
        scenes = []

        # Scene 1: Opening (5 seconds)
        scenes.append({
            "scene_number": 1,
            "duration": 5,
            "title": "آغاز",
            "visual": "کاراکتر شاد با پس‌زمینه رنگی",
            "text_overlay": f"درس {lesson_number}: {title}",
            "voiceover": f"سلام بچه‌های عزیز! امروز می‌خواهیم درباره {title} صحبت کنیم.",
            "background_music": "شاد و انرژی‌بخش",
            "animation": "fade_in"
        })

        # Scene 2: Question (5 seconds)
        scenes.append({
            "scene_number": 2,
            "duration": 5,
            "title": "سوال جذاب",
            "visual": "علامت سوال بزرگ با انیمیشن",
            "text_overlay": "؟",
            "voiceover": self._generate_opening_question(lesson_id),
            "background_music": "کنجکاوی",
            "animation": "zoom_in"
        })

        # Scene 3-5: Main content (based on lesson)
        main_scenes = self._generate_main_content_scenes(lesson)
        scenes.extend(main_scenes)

        # Scene 6: Examples (10 seconds)
        scenes.append({
            "scene_number": len(scenes) + 1,
            "duration": 10,
            "title": "مثال‌های واقعی",
            "visual": "تصاویر از زندگی روزمره",
            "text_overlay": "مثال‌ها",
            "voiceover": self._generate_examples(lesson_id),
            "background_music": "ملایم",
            "animation": "slide"
        })

        # Scene 7: Summary (5 seconds)
        scenes.append({
            "scene_number": len(scenes) + 1,
            "duration": 5,
            "title": "جمع‌بندی",
            "visual": "چک‌لیست با تیک‌های سبز",
            "text_overlay": "یادگرفتیم!",
            "voiceover": "عالی! حالا شما می‌دانید که " + self._generate_summary(lesson_id),
            "background_music": "شاد",
            "animation": "celebration"
        })

        # Scene 8: Closing (3 seconds)
        scenes.append({
            "scene_number": len(scenes) + 1,
            "duration": 3,
            "title": "پایان",
            "visual": "کاراکتر دست تکان می‌دهد",
            "text_overlay": "موفق باشید! 👋",
            "voiceover": "در بازی و آزمون می‌توانید دانش خود را امتحان کنید! موفق باشید!",
            "background_music": "شاد پایانی",
            "animation": "wave"
        })

        # Calculate total duration
        total_duration = sum(scene['duration'] for scene in scenes)

        script = {
            "lesson_id": lesson_id,
            "lesson_number": lesson_number,
            "title": title,
            "description": description,
            "total_duration": total_duration,
            "scenes": scenes,
            "recommended_voice": "گرم و دوست‌داشتنی، صدای زن یا مرد با لحن معلمانه",
            "background_music_style": "کودکانه و شاد",
            "target_age": "9 سال (پایه سوم)",
            "language": "فارسی"
        }

        return script

    def _generate_opening_question(self, lesson_id: str) -> str:
        """Generate engaging opening question"""
        questions = {
            "lesson_1": "آیا تا به حال فکر کرده‌اید که چه چیزهایی زنده هستند و چه چیزهایی زنده نیستند؟",
            "lesson_2": "می‌دانید گیاهان چطور رشد می‌کنند؟ بیایید کشف کنیم!",
            "lesson_3": "حیوانات کجا زندگی می‌کنند؟ چرا هر حیوان یک خانه خاص دارد؟",
            "lesson_4": "آب برای ما چقدر مهم است؟ بیایید ببینیم!",
            "lesson_5": "می‌توانید هوا را ببینید؟ اما می‌دانید که چقدر مهم است؟",
            "lesson_6": "خورشید چه کارهایی برای ما انجام می‌دهد؟ بیایید یاد بگیریم!"
        }
        return questions.get(lesson_id, "بیایید با هم یاد بگیریم!")

    def _generate_main_content_scenes(self, lesson: Dict) -> List[Dict]:
        """Generate main educational content scenes"""
        lesson_id = lesson.get('id')
        scenes = []

        # Content specific to each lesson
        content_data = {
            "lesson_1": [
                {
                    "title": "ویژگی اول: رشد",
                    "text": "رشد می‌کنند!",
                    "voiceover": "موجودات زنده رشد می‌کنند! مثل یک دانه کوچک که تبدیل به درخت بزرگ می‌شود.",
                    "visual": "انیمیشن رشد گیاه از دانه",
                    "duration": 8
                },
                {
                    "title": "ویژگی دوم: تغذیه",
                    "text": "غذا می‌خورند!",
                    "voiceover": "موجودات زنده نیاز به غذا و آب دارند. همان‌طور که شما صبحانه می‌خورید!",
                    "visual": "انیمیشن غذا خوردن",
                    "duration": 8
                },
                {
                    "title": "ویژگی سوم: تکثیر",
                    "text": "بچه می‌آورند!",
                    "voiceover": "موجودات زنده می‌توانند بچه داشته باشند. مثل گربه که بچه‌گربه می‌آورد!",
                    "visual": "انیمیشن گربه و بچه‌گربه",
                    "duration": 8
                }
            ],
            "lesson_2": [
                {
                    "title": "اجزای گیاه",
                    "text": "ریشه، ساقه، برگ",
                    "voiceover": "گیاهان از اجزای مختلفی تشکیل شده‌اند: ریشه که در خاک است، ساقه که بلند می‌شود، و برگ‌های سبز!",
                    "visual": "نمودار گیاه با برچسب",
                    "duration": 10
                },
                {
                    "title": "نیازهای گیاه",
                    "text": "آب، نور، هوا، خاک",
                    "voiceover": "گیاهان برای رشد به چهار چیز نیاز دارند: آب، نور خورشید، هوا، و خاک مناسب.",
                    "visual": "چهار آیکون با انیمیشن",
                    "duration": 10
                }
            ],
            "lesson_3": [
                {
                    "title": "حیوانات آبی",
                    "text": "ماهی، نهنگ",
                    "voiceover": "بعضی حیوانات در آب زندگی می‌کنند، مثل ماهی‌های رنگارنگ!",
                    "visual": "انیمیشن ماهی در آب",
                    "duration": 8
                },
                {
                    "title": "حیوانات زمینی",
                    "text": "گربه، سگ، فیل",
                    "voiceover": "بعضی حیوانات روی زمین زندگی می‌کنند و راه می‌روند یا می‌دوند.",
                    "visual": "انیمیشن حیوانات در حال دویدن",
                    "duration": 8
                }
            ],
            "lesson_4": [
                {
                    "title": "حالت‌های آب",
                    "text": "یخ، مایع، بخار",
                    "voiceover": "آب می‌تواند سه حالت داشته باشد: یخ سرد، آب مایع، و بخار گرم!",
                    "visual": "سه تصویر با تغییر شکل",
                    "duration": 10
                },
                {
                    "title": "اهمیت آب",
                    "text": "همه موجودات زنده",
                    "voiceover": "همه موجودات زنده به آب نیاز دارند. پس باید از آب مراقبت کنیم!",
                    "visual": "گیاهان و حیوانات در کنار آب",
                    "duration": 8
                }
            ],
            "lesson_5": [
                {
                    "title": "اجزای هوا",
                    "text": "اکسیژن برای تنفس",
                    "voiceover": "هوا مخلوطی از گازهای مختلف است. ما برای تنفس به اکسیژن نیاز داریم!",
                    "visual": "انیمیشن تنفس",
                    "duration": 10
                }
            ],
            "lesson_6": [
                {
                    "title": "نور و گرما",
                    "text": "خورشید می‌تابد!",
                    "voiceover": "خورشید به ما نور و گرما می‌دهد. بدون خورشید زندگی امکان ندارد!",
                    "visual": "انیمیشن خورشید",
                    "duration": 10
                }
            ]
        }

        lesson_content = content_data.get(lesson_id, [])

        for i, content in enumerate(lesson_content, start=3):
            scenes.append({
                "scene_number": i,
                "duration": content['duration'],
                "title": content['title'],
                "visual": content['visual'],
                "text_overlay": content['text'],
                "voiceover": content['voiceover'],
                "background_music": "آموزشی ملایم",
                "animation": "slide_in"
            })

        return scenes

    def _generate_examples(self, lesson_id: str) -> str:
        """Generate real-life examples"""
        examples = {
            "lesson_1": "نگاه کنید! درخت‌های اطراف مدرسه زنده هستند، اما میز و صندلی کلاس زنده نیستند!",
            "lesson_2": "وقتی گلدان خانه را آب می‌دهید، به گیاه کمک می‌کنید که رشد کند!",
            "lesson_3": "ماهی قرمز در تنگ ماهی، پرنده در قفس، و سگ در حیاط خانه شما!",
            "lesson_4": "وقتی باران می‌آید، آب برای گیاهان و حیوانات می‌آید!",
            "lesson_5": "وقتی باد می‌وزد، هوا در حال حرکت است!",
            "lesson_6": "وقتی صبح از خواب بیدار می‌شوید، خورشید طلوع کرده است!"
        }
        return examples.get(lesson_id, "در زندگی روزمره می‌توانید این‌ها را ببینید!")

    def _generate_summary(self, lesson_id: str) -> str:
        """Generate lesson summary"""
        summaries = {
            "lesson_1": "موجودات زنده رشد می‌کنند، غذا می‌خورند، و بچه می‌آورند!",
            "lesson_2": "گیاهان به آب، نور، هوا و خاک نیاز دارند تا رشد کنند!",
            "lesson_3": "حیوانات مختلف در مکان‌های مختلف زندگی می‌کنند!",
            "lesson_4": "آب خیلی مهم است و در سه حالت وجود دارد!",
            "lesson_5": "هوا اطراف ماست و برای تنفس نیاز داریم!",
            "lesson_6": "خورشید به ما نور و گرما می‌دهد!"
        }
        return summaries.get(lesson_id, "این درس را یاد گرفتید!")

    def generate_all_scripts(self, lessons: List[Dict]) -> Dict:
        """Generate scripts for all lessons"""
        all_scripts = {}

        for lesson in lessons:
            lesson_id = lesson.get('id')
            script = self.generate_lesson_script(lesson)
            all_scripts[lesson_id] = script

        return all_scripts

    def save_scripts(self, scripts: Dict, output_file: str):
        """Save scripts to JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(scripts, f, ensure_ascii=False, indent=2)
        print(f"✓ Scripts saved to: {output_file}")

    def export_for_canva_bulk(self, scripts: Dict, output_file: str):
        """Export scripts as CSV for Canva Bulk Create"""
        import csv

        rows = []
        rows.append(['Lesson', 'Scene', 'Duration', 'Title', 'Text', 'Voiceover', 'Visual', 'Music'])

        for lesson_id, script in scripts.items():
            lesson_number = script['lesson_number']
            for scene in script['scenes']:
                rows.append([
                    f"Lesson {lesson_number}",
                    scene['scene_number'],
                    scene['duration'],
                    scene['title'],
                    scene.get('text_overlay', ''),
                    scene['voiceover'],
                    scene['visual'],
                    scene.get('background_music', '')
                ])

        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        print(f"✓ Canva CSV exported to: {output_file}")


if __name__ == "__main__":
    # Example usage
    from content.content_manager import ContentManager

    # Load lessons
    content_manager = ContentManager()
    lessons = content_manager.get_all_lessons()

    # Generate scripts
    generator = ScriptGenerator()
    scripts = generator.generate_all_scripts(lessons)

    # Save scripts
    os.makedirs('output', exist_ok=True)
    generator.save_scripts(scripts, 'output/lesson_scripts.json')
    generator.export_for_canva_bulk(scripts, 'output/canva_bulk_import.csv')

    print("\n✓ All scripts generated successfully!")
    print(f"✓ Total lessons: {len(scripts)}")
    for lesson_id, script in scripts.items():
        print(f"  - {script['title']}: {script['total_duration']} seconds, {len(script['scenes'])} scenes")
