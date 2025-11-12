#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اپلیکیشن آموزش علوم تجربی پایه سوم دبستان
Educational Science App for 3rd Grade Elementary
"""

import tkinter as tk
from tkinter import ttk
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gui.main_window import MainWindow
from utils.persian_text import setup_persian_support

def main():
    """Main entry point for the application"""
    # Setup Persian text support
    setup_persian_support()

    # Create main window
    root = tk.Tk()
    app = MainWindow(root)

    # Center window on screen
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')

    # Start main loop
    root.mainloop()

if __name__ == "__main__":
    main()
