#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎬 Automatic Video Content Generator
تولید خودکار محتوای ویدیو برای دروس علوم

این اسکریپت:
1. اسکریپت‌های ویدیو را تولید می‌کند
2. فایل CSV برای Canva Bulk Create می‌سازد
3. راهنمای کامل ساخت ویدیو ارائه می‌دهد
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from content.content_manager import ContentManager
from video_generator.script_generator import ScriptGenerator


def print_banner():
    """Print welcome banner"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║     🎬 Automatic Video Content Generator                    ║
║        تولید خودکار محتوای ویدیوهای آموزشی                 ║
╚══════════════════════════════════════════════════════════════╝
    """)


def main():
    """Main function"""
    print_banner()

    print("📚 Loading lessons...")
    content_manager = ContentManager()
    lessons = content_manager.get_all_lessons()
    print(f"✓ Loaded {len(lessons)} lessons")

    print("\n🎬 Generating video scripts...")
    generator = ScriptGenerator()
    scripts = generator.generate_all_scripts(lessons)
    print(f"✓ Generated {len(scripts)} scripts")

    # Create output directory
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n📁 Output directory: {output_dir}/")

    # Save JSON scripts
    json_file = os.path.join(output_dir, 'lesson_scripts.json')
    generator.save_scripts(scripts, json_file)

    # Export CSV for Canva
    csv_file = os.path.join(output_dir, 'canva_bulk_import.csv')
    generator.export_for_canva_bulk(scripts, csv_file)

    # Print summary
    print("\n" + "="*60)
    print("✅ Generation Complete!")
    print("="*60)

    print("\n📊 Summary:")
    total_duration = 0
    total_scenes = 0

    for lesson_id, script in scripts.items():
        duration = script['total_duration']
        scenes = len(script['scenes'])
        total_duration += duration
        total_scenes += scenes

        print(f"\n📚 {script['title']}:")
        print(f"   ⏱️  Duration: {duration} seconds ({duration // 60}:{duration % 60:02d})")
        print(f"   🎞️  Scenes: {scenes}")

    print(f"\n📊 Total Statistics:")
    print(f"   📚 Lessons: {len(scripts)}")
    print(f"   🎞️  Total Scenes: {total_scenes}")
    print(f"   ⏱️  Total Duration: {total_duration} seconds ({total_duration // 60}:{total_duration % 60:02d})")

    print("\n" + "="*60)
    print("📂 Generated Files:")
    print("="*60)
    print(f"1. {json_file}")
    print(f"   → اسکریپت‌های کامل JSON با جزئیات هر صحنه")
    print(f"\n2. {csv_file}")
    print(f"   → فایل CSV برای Canva Bulk Create")

    print("\n" + "="*60)
    print("🎯 Next Steps:")
    print("="*60)
    print("""
1️⃣  به Canva بروید (canva.com)
2️⃣  یک Design Template برای ویدیو بسازید
3️⃣  از قابلیت "Bulk Create" استفاده کنید
4️⃣  فایل CSV را آپلود کنید
5️⃣  همه ویدیوها را یکجا Download کنید!

📖 راهنمای کامل: canva_integration/CANVA_BULK_CREATE_GUIDE.md
    """)

    print("✨ تبریک! همه چیز آماده است!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
