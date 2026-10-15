"""
Zero-Trust Processor for Claude Code Security Framework
"""
from typing import List, Dict, Tuple, Optional
import re
from ..secret_detection import SecretDetector, SecretMatch, get_default_detectors

class ZeroTrustProcessor:
    """Main processor for zero-trust secret handling"""
    
    def __init__(self, detectors: Optional[List[SecretDetector]] = None):
        self.detectors = detectors or get_default_detectors()
        self.placeholder_counter = 0
    
    def process_content(self, content: str) -> Tuple[str, Dict[str, str]]:
        """
        Process content and replace secrets with placeholders
        
        Args:
            content: Text content to process
            
        Returns:
            Tuple of (processed_content, placeholder_mapping)
        """
        if not content:
            return content, {}
        
        # Detect all secrets
        all_matches = []
        for detector in self.detectors:
            matches = detector.detect(content)
            all_matches.extend(matches)
        
        if not all_matches:
            return content, {}
        
        # Sort by position in reverse order to avoid index shifting
        all_matches.sort(key=lambda x: x.start, reverse=True)
        
        # Replace with placeholders
        processed_content = content
        mapping = {}
        
        for match in all_matches:
            placeholder = self._generate_placeholder(match.secret_type)
            processed_content = (
                processed_content[:match.start] + 
                placeholder + 
                processed_content[match.end:]
            )
            mapping[placeholder] = match.value
        
        return processed_content, mapping
    
    def restore_content(self, processed_content: str, mapping: Dict[str, str]) -> str:
        """
        Restore content by replacing placeholders with real values
        
        Args:
            processed_content: Content with placeholders
            mapping: Placeholder to real value mapping
            
        Returns:
            Original content with real values
        """
        restored_content = processed_content
        for placeholder, real_value in mapping.items():
            restored_content = restored_content.replace(placeholder, real_value)
        return restored_content
    
    def _generate_placeholder(self, secret_type: str) -> str:
        """Generate a unique placeholder for a secret type"""
        self.placeholder_counter += 1
        # Convert secret type to uppercase and replace special chars
        clean_type = re.sub(r'[^a-zA-Z0-9_]', '_', secret_type.upper())
        return f"<{clean_type}_PLACEHOLDER_{self.placeholder_counter:03d}>"
    
    def detect_secrets(self, content: str) -> List[SecretMatch]:
        """
        Detect secrets in content without replacement
        
        Args:
            content: Text content to analyze
            
        Returns:
            List of detected secrets
        """
        matches = []
        for detector in self.detectors:
            detector_matches = detector.detect(content)
            matches.extend(detector_matches)
        return matches