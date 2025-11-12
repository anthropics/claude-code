#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اسکریپت استخراج محتوا از PDF کتاب درسی
Script for extracting content from textbook PDF
"""

import sys
import json

def install_dependencies():
    """نصب کتابخانه‌های مورد نیاز"""
    import subprocess
    print("Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber"])
        print("✓ Dependencies installed successfully!")
        return True
    except Exception as e:
        print(f"✗ Error installing dependencies: {e}")
        return False

def extract_text_from_pdf(pdf_path):
    """استخراج متن از PDF"""
    try:
        import pdfplumber
    except ImportError:
        print("pdfplumber is not installed. Installing now...")
        if not install_dependencies():
            return None
        import pdfplumber

    try:
        print(f"Opening PDF: {pdf_path}")
        content = []

        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"Total pages: {total_pages}")

            for i, page in enumerate(pdf.pages):
                print(f"Processing page {i+1}/{total_pages}...")
                text = page.extract_text()
                if text:
                    content.append(f"--- Page {i+1} ---\n{text}\n")

        full_text = '\n'.join(content)
        print("✓ Text extraction completed!")
        return full_text

    except Exception as e:
        print(f"✗ Error reading PDF: {e}")
        return None

def save_extracted_text(text, output_file='extracted_content.txt'):
    """ذخیره متن استخراج شده"""
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"✓ Text saved to: {output_file}")
        return True
    except Exception as e:
        print(f"✗ Error saving text: {e}")
        return False

def create_lesson_from_text(lesson_num, title, description, questions=None):
    """ایجاد ساختار درس از متن"""
    lesson = {
        "id": f"lesson_{lesson_num}",
        "lesson_number": lesson_num,
        "title": title,
        "description": description,
        "video": f"lesson{lesson_num}_{title.replace(' ', '_').replace('‌', '_').lower()}.mp4",
        "game": True,
        "quiz": questions or []
    }
    return lesson

def interactive_lesson_creation():
    """ایجاد تعاملی درس‌ها"""
    print("\n" + "="*60)
    print("راهنمای ایجاد محتوا از PDF")
    print("Interactive Lesson Creation Guide")
    print("="*60 + "\n")

    lessons = []

    num_lessons = input("چند درس می‌خواهید اضافه کنید؟ (How many lessons?): ")
    try:
        num_lessons = int(num_lessons)
    except:
        num_lessons = 6

    for i in range(num_lessons):
        print(f"\n--- Lesson {i+1} ---")
        title = input(f"عنوان درس {i+1} (Lesson title): ")
        description = input(f"توضیح درس (Description): ")

        # سوالات
        questions = []
        add_questions = input("آیا می‌خواهید سوال اضافه کنید؟ (Add questions? y/n): ")

        if add_questions.lower() == 'y':
            num_questions = input("چند سوال؟ (How many questions?): ")
            try:
                num_questions = int(num_questions)
            except:
                num_questions = 3

            for j in range(num_questions):
                print(f"\n  Question {j+1}:")
                question_text = input("  متن سوال (Question): ")

                options = []
                for k in range(4):
                    opt = input(f"  گزینه {k+1} (Option {k+1}): ")
                    options.append(opt)

                correct = input("  شماره گزینه صحیح (Correct option 1-4): ")
                try:
                    correct_idx = int(correct) - 1
                except:
                    correct_idx = 0

                questions.append({
                    "question": question_text,
                    "options": options,
                    "correct": correct_idx
                })

        lesson = create_lesson_from_text(i+1, title, description, questions)
        lessons.append(lesson)

    # ذخیره
    output = {"lessons": lessons}
    output_file = 'content/lessons_new.json'

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Lessons saved to: {output_file}")
        print(f"✓ {len(lessons)} lessons created successfully!")
    except Exception as e:
        print(f"\n✗ Error saving lessons: {e}")

def main():
    """تابع اصلی"""
    print("""
╔══════════════════════════════════════════════════════════╗
║     PDF Content Extractor for Science Education App     ║
║         استخراج‌کننده محتوای PDF کتاب علوم              ║
╚══════════════════════════════════════════════════════════╝
    """)

    print("\nWhat would you like to do?")
    print("1. Extract text from PDF (استخراج متن از PDF)")
    print("2. Create lessons interactively (ایجاد تعاملی درس‌ها)")
    print("3. Both (هر دو)")

    choice = input("\nEnter your choice (1/2/3): ")

    if choice in ['1', '3']:
        pdf_path = input("\nEnter PDF file path (آدرس فایل PDF): ")

        if pdf_path:
            text = extract_text_from_pdf(pdf_path)
            if text:
                save_extracted_text(text)
                print("\n✓ You can now review 'extracted_content.txt' to create lessons")
        else:
            print("✗ No PDF path provided")

    if choice in ['2', '3']:
        print("\n")
        interactive_lesson_creation()

    print("\n" + "="*60)
    print("Done! Next steps:")
    print("1. Review extracted content")
    print("2. Create/prepare video files")
    print("3. Place videos in assets/videos/")
    print("4. Update content/lessons.json")
    print("5. Run the application: python main.py")
    print("="*60)

if __name__ == "__main__":
    main()
