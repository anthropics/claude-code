"""
Secret Detection Module for Zero-Trust Security Framework
"""
from abc import ABC, abstractmethod
from typing import List, Callable, Optional
from dataclasses import dataclass
import re

@dataclass
class SecretMatch:
    """Represents a detected secret"""
    value: str
    secret_type: str
    start: int
    end: int
    confidence: float

class SecretDetector(ABC):
    """Abstract base class for secret detectors"""
    
    @abstractmethod
    def detect(self, text: str) -> List[SecretMatch]:
        """Detect secrets in text and return matches"""
        pass
    
    @abstractmethod
    def get_secret_type(self) -> str:
        """Return the type of secrets this detector finds"""
        pass

class PatternDetector(SecretDetector):
    """Pattern-based secret detector"""
    
    def __init__(self, secret_type: str, pattern: str, validator: Optional[Callable] = None):
        self._secret_type = secret_type
        self.pattern = re.compile(pattern)
        self.validator = validator or (lambda x: True)
    
    def detect(self, text: str) -> List[SecretMatch]:
        """Detect secrets using pattern matching"""
        matches = []
        for match in self.pattern.finditer(text):
            secret = match.group()
            if self.validator(secret):
                matches.append(SecretMatch(
                    value=secret,
                    secret_type=self._secret_type,
                    start=match.start(),
                    end=match.end(),
                    confidence=0.9
                ))
        return matches
    
    def get_secret_type(self) -> str:
        return self._secret_type

class EntropyDetector(SecretDetector):
    """Entropy-based secret detector"""
    
    def __init__(self, threshold: float = 3.5):
        self._secret_type = "high_entropy"
        self.threshold = threshold
    
    def detect(self, text: str) -> List[SecretMatch]:
        """Detect high-entropy strings that might be secrets"""
        matches = []
        # Simple entropy calculation
        words = re.findall(r'\S+', text)
        for word in words:
            if len(word) > 8 and self._calculate_entropy(word) > self.threshold:
                # Look for the word in the original text to get position
                for match in re.finditer(re.escape(word), text):
                    matches.append(SecretMatch(
                        value=word,
                        secret_type=self._secret_type,
                        start=match.start(),
                        end=match.end(),
                        confidence=0.7
                    ))
        return matches
    
    def _calculate_entropy(self, s: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not s:
            return 0.0
        
        # Count frequency of each character
        freq = {}
        for char in s:
            freq[char] = freq.get(char, 0) + 1
        
        # Calculate entropy
        entropy = 0.0
        length = len(s)
        for count in freq.values():
            probability = count / length
            entropy -= probability * self._log2(probability)
        
        return entropy
    
    def _log2(self, x: float) -> float:
        """Calculate log base 2"""
        import math
        return math.log2(x) if x > 0 else 0
    
    def get_secret_type(self) -> str:
        return self._secret_type

# Predefined detectors for common secret types
def get_default_detectors() -> List[SecretDetector]:
    """Get a list of default secret detectors"""
    
    def not_test_pattern(secret: str) -> bool:
        """Validator to filter out test/example patterns"""
        test_patterns = ['EXAMPLE', 'TEST', 'DUMMY', 'SAMPLE']
        return not any(pattern in secret.upper() for pattern in test_patterns)
    
    return [
        PatternDetector(
            secret_type="openai_api_key",
            pattern=r'sk-[a-zA-Z0-9]{48}',
            validator=not_test_pattern
        ),
        PatternDetector(
            secret_type="anthropic_api_key",
            pattern=r'sk-ant-[a-zA-Z0-9_-]{94}R',
            validator=not_test_pattern
        ),
        PatternDetector(
            secret_type="aws_access_key",
            pattern=r'AKIA[0-9A-Z]{16}',
            validator=not_test_pattern
        ),
        PatternDetector(
            secret_type="github_token",
            pattern=r'(ghp|github_pat)_[a-zA-Z0-9_]+',
            validator=not_test_pattern
        ),
        EntropyDetector(threshold=3.5)
    ]