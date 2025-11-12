# 🚀 راهنمای سریع شروع / Quick Start Guide

## برای والدین ایرانی / For Iranian Parents

### نصب سریع (5 دقیقه)

#### ویندوز:
1. دابل کلیک روی `install.bat`
2. صبر کنید تا نصب تمام شود
3. دابل کلیک روی `run.bat` برای اجرا

#### مک/لینوکس:
```bash
chmod +x install.sh
./install.sh
source venv/bin/activate
python main.py
```

### اضافه کردن فیلم‌های آموزشی

1. فایل PDF کتاب درسی علوم پایه سوم را آماده کنید
2. اجرا کنید: `python extract_pdf_content.py`
3. فیلم‌های آموزشی خود را در `assets/videos/` قرار دهید
4. برنامه را اجرا کنید: `python main.py`

### فیلم ندارید؟ مشکلی نیست!

برنامه با محتوای نمونه کار می‌کند. می‌توانید:

1. **از Canva استفاده کنید** (رایگان):
   - به canva.com بروید
   - "Create a design" > "Video" را انتخاب کنید
   - قالب "Educational Video" را انتخاب کنید
   - محتوای درس را اضافه کنید
   - دانلود به صورت MP4

2. **از PowerPoint استفاده کنید**:
   - اسلایدهای آموزشی بسازید
   - File > Export > Create a Video
   - MP4 انتخاب کنید و Export کنید

3. **از YouTube استفاده کنید**:
   - ویدیوهای آموزشی علوم پایه سوم جستجو کنید
   - با ابزارهایی مثل 4K Video Downloader دانلود کنید
   - در پوشه videos قرار دهید

---

## For Non-Persian Users

### Quick Installation (5 minutes)

#### Windows:
1. Double-click `install.bat`
2. Wait for installation to complete
3. Double-click `run.bat` to start

#### Mac/Linux:
```bash
chmod +x install.sh
./install.sh
source venv/bin/activate
python main.py
```

### Adding Educational Content

1. Prepare your textbook PDF
2. Run: `python extract_pdf_content.py`
3. Place video files in `assets/videos/`
4. Run the app: `python main.py`

### Don't Have Videos?

The app works with sample content. You can:

1. **Use Canva** (Free):
   - Go to canva.com
   - Create a design > Video
   - Choose "Educational Video" template
   - Add your lesson content
   - Download as MP4

2. **Use PowerPoint**:
   - Create educational slides
   - File > Export > Create a Video
   - Select MP4 and export

3. **Find Creative Commons Videos**:
   - Search YouTube for CC-licensed content
   - Download with tools like 4K Video Downloader
   - Place in videos folder

---

## 📱 Minimum Requirements

- **OS**: Windows 7+, macOS 10.12+, Linux (any recent distro)
- **Python**: 3.7 or higher
- **RAM**: 2 GB minimum
- **Storage**: 500 MB + video files
- **Display**: 1024x768 minimum

---

## 🎯 First Run

When you first run the app:

1. **Main Menu** appears in Persian
2. Click **"درس‌ها"** (Lessons) to see available lessons
3. Click **"بازی‌ها"** (Games) to play educational games
4. Click **"پیشرفت من"** (My Progress) to see achievements

---

## 🎥 Video Format Requirements

- **Format**: MP4 (H.264)
- **Duration**: 3-5 minutes ideal
- **Resolution**: 720p or higher
- **Audio**: Clear narration in Persian
- **Size**: Under 100 MB per video recommended

---

## 🆘 Common Issues

### "Module not found" error
```bash
pip install -r requirements.txt
```

### "Persian text shows incorrectly"
- Install B Nazanin font on your system
- Or edit `utils/config.py` to use another Persian font

### "Video won't play"
- Ensure file is in MP4 format
- Check file path in `content/lessons.json`
- Verify pygame is installed

### "App window is blank"
- Update tkinter: reinstall Python with tkinter support
- Try: `sudo apt-get install python3-tk` (Linux)

---

## 📚 Next Steps

After installation:

1. ✅ Read `README_FA.md` for full documentation
2. ✅ Read `HOW_TO_ADD_PDF_CONTENT.md` for PDF extraction
3. ✅ Check `assets/videos/README.md` for video guidelines
4. ✅ Customize content in `content/lessons.json`
5. ✅ Add your own videos and quizzes

---

## 🎓 For Teachers

Want to use this in classroom?

1. Install on classroom computer
2. Add your custom lessons and videos
3. Let students use it during computer lab time
4. Track progress from "پیشرفت من" section
5. Customize quizzes in `content/lessons.json`

---

## 💡 Tips

### Make it Better:
- Add real voice narration to videos
- Use colorful animations
- Keep videos short (3-5 min)
- Test with actual 9-year-olds
- Update quizzes based on textbook

### Engage Children:
- Use reward system (points & stars)
- Make games challenging but fun
- Add surprise elements
- Celebrate achievements
- Regular content updates

---

## 🔗 Resources

- **Canva**: https://canva.com
- **Animaker**: https://animaker.com
- **Free Music**: https://freemusicarchive.org
- **Free Icons**: https://flaticon.com
- **Free Images**: https://pixabay.com

---

## 📞 Need Help?

- Check documentation in `README_FA.md`
- Review `HOW_TO_ADD_PDF_CONTENT.md`
- Send your textbook PDF and I'll help extract content

---

**Ready? Let's start!** 🎉

```bash
python main.py
```

---

موفق باشید! / Good luck! 🌟
