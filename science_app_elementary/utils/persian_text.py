#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Persian text support utilities
Handles RTL text rendering and Persian/Arabic reshaping
"""

import arabic_reshaper
from bidi.algorithm import get_display

def reshape_persian_text(text):
    """
    Reshape Persian/Arabic text for proper display

    Args:
        text: Persian/Arabic text string

    Returns:
        Reshaped text ready for display
    """
    if not text:
        return ""

    reshaped_text = arabic_reshaper.reshape(text)
    bidi_text = get_display(reshaped_text)
    return bidi_text

def setup_persian_support():
    """Setup Persian language support"""
    # This can be expanded to load Persian fonts, etc.
    pass

class PersianText:
    """Helper class for Persian text handling"""

    @staticmethod
    def display(text):
        """Convert text to displayable Persian format"""
        return reshape_persian_text(text)

    @staticmethod
    def is_persian(char):
        """Check if character is Persian/Arabic"""
        return '\u0600' <= char <= '\u06FF' or '\u0750' <= char <= '\u077F'
