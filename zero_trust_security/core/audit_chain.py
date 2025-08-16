"""
Tamper-Proof Audit Chain
========================
Hash-linked audit trail extracted from Byzantine fault tolerance implementation.
Provides immutable audit logging with chain integrity verification.
"""

import hashlib
import json
import os
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from .byzantine_validator import SecurityCommitment

@dataclass
class AuditEntry:
    """Individual entry in the audit chain"""
    entry_id: str
    previous_hash: str
    commitment: Optional[SecurityCommitment]
    validation_proof: Optional[str]
    chain_hash: str
    timestamp: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        # Convert commitment to dict if present
        if self.commitment:
            data['commitment'] = self.commitment.to_dict()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditEntry":
        """Create from dictionary"""
        # Convert commitment dict back to object if present
        if data.get('commitment'):
            data['commitment'] = SecurityCommitment.from_dict(data['commitment'])
        return cls(**data)

class AuditChain:
    """Tamper-proof audit chain with hash linking"""
    
    def __init__(self, audit_dir: Optional[str] = None):
        """Initialize audit chain
        
        Args:
            audit_dir: Directory for audit files
        """
        if audit_dir:
            self.audit_dir = audit_dir
        else:
            self.audit_dir = os.path.expanduser("~/.claude-code-security-bft")
        os.makedirs(self.audit_dir, exist_ok=True)
        
        self.chain_file = os.path.join(self.audit_dir, "byzantine_audit_chain.jsonl")
        self._last_hash = self._get_last_hash()
    
    def _get_last_hash(self) -> str:
        """Get the hash of the last entry in the chain"""
        if not os.path.exists(self.chain_file):
            return "0" * 64  # Genesis hash
            
        try:
            with open(self.chain_file, 'r') as f:
                lines = f.readlines()
                if lines:
                    last_entry = json.loads(lines[-1].strip())
                    return last_entry.get('chain_hash', "0" * 64)
        except Exception:
            pass
            
        return "0" * 64
    
    def _generate_entry_id(self) -> str:
        """Generate unique entry ID"""
        timestamp = int(time.time())
        return f"audit_{timestamp}_{hashlib.sha256(str(time.time()).encode()).hexdigest()[:8]}"
    
    def _calculate_chain_hash(self, entry_data: Dict[str, Any]) -> str:
        """Calculate hash for chain integrity"""
        # Create deterministic string from entry data (excluding chain_hash)
        hashable_data = {k: v for k, v in entry_data.items() if k != 'chain_hash'}
        data_str = json.dumps(hashable_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def add_entry(self, 
                  commitment: Optional[SecurityCommitment] = None,
                  validation_proof: Optional[Dict[str, Any]] = None,
                  additional_data: Optional[Dict[str, Any]] = None) -> AuditEntry:
        """Add new entry to the audit chain
        
        Args:
            commitment: Security commitment to record
            validation_proof: Validation proof data
            additional_data: Additional audit data
            
        Returns:
            AuditEntry that was added to the chain
        """
        entry_id = self._generate_entry_id()
        timestamp = time.time()
        
        # Convert validation proof to JSON string
        proof_str = None
        if validation_proof:
            proof_str = json.dumps(validation_proof, sort_keys=True)
        
        # Create entry with placeholder hash
        entry_data = {
            "entry_id": entry_id,
            "previous_hash": self._last_hash,
            "commitment": commitment.to_dict() if commitment else None,
            "validation_proof": proof_str,
            "chain_hash": "",  # Placeholder
            "timestamp": timestamp
        }
        
        # Add additional data if provided
        if additional_data:
            entry_data.update(additional_data)
        
        # Calculate actual chain hash
        chain_hash = self._calculate_chain_hash(entry_data)
        entry_data["chain_hash"] = chain_hash
        
        # Create entry object
        entry = AuditEntry(
            entry_id=entry_id,
            previous_hash=self._last_hash,
            commitment=commitment,
            validation_proof=proof_str,
            chain_hash=chain_hash,
            timestamp=timestamp
        )
        
        # Write to file
        try:
            with open(self.chain_file, 'a') as f:
                f.write(json.dumps(entry_data) + "\n")
            
            # Update last hash for next entry
            self._last_hash = chain_hash
            
        except Exception as e:
            # Return entry even if logging fails (don't break main functionality)
            pass
            
        return entry
    
    def verify_chain_integrity(self) -> tuple[bool, List[str]]:
        """Verify the integrity of the entire audit chain
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        if not os.path.exists(self.chain_file):
            return True, []  # Empty chain is valid
            
        errors = []
        expected_hash = "0" * 64  # Genesis hash
        
        try:
            with open(self.chain_file, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    try:
                        entry_data = json.loads(line.strip())
                        
                        # Verify previous hash links correctly
                        if entry_data.get('previous_hash') != expected_hash:
                            errors.append(f"Line {line_num}: Hash chain broken")
                        
                        # Verify entry hash is correct
                        stored_hash = entry_data.get('chain_hash')
                        calculated_hash = self._calculate_chain_hash(entry_data)
                        
                        if stored_hash != calculated_hash:
                            errors.append(f"Line {line_num}: Entry hash mismatch")
                        
                        expected_hash = stored_hash
                        
                    except json.JSONDecodeError:
                        errors.append(f"Line {line_num}: Invalid JSON")
                        
        except Exception as e:
            errors.append(f"File read error: {e}")
        
        return len(errors) == 0, errors
    
    def get_entries(self, limit: Optional[int] = None) -> List[AuditEntry]:
        """Get audit entries from the chain
        
        Args:
            limit: Maximum number of entries to return (most recent first)
            
        Returns:
            List of AuditEntry objects
        """
        if not os.path.exists(self.chain_file):
            return []
            
        entries = []
        
        try:
            with open(self.chain_file, 'r') as f:
                lines = f.readlines()
                
            # Reverse to get most recent first
            if limit:
                lines = lines[-limit:]
            
            for line in lines:
                try:
                    entry_data = json.loads(line.strip())
                    entries.append(AuditEntry.from_dict(entry_data))
                except json.JSONDecodeError:
                    continue  # Skip invalid entries
                    
        except Exception:
            pass
            
        return entries
    
    def get_chain_stats(self) -> Dict[str, Any]:
        """Get statistics about the audit chain
        
        Returns:
            Dictionary with chain statistics
        """
        if not os.path.exists(self.chain_file):
            return {"total_entries": 0, "chain_valid": True}
            
        total_entries = 0
        earliest_timestamp = None
        latest_timestamp = None
        
        try:
            with open(self.chain_file, 'r') as f:
                for line in f:
                    try:
                        entry_data = json.loads(line.strip())
                        total_entries += 1
                        
                        timestamp = entry_data.get('timestamp')
                        if timestamp:
                            if earliest_timestamp is None or timestamp < earliest_timestamp:
                                earliest_timestamp = timestamp
                            if latest_timestamp is None or timestamp > latest_timestamp:
                                latest_timestamp = timestamp
                                
                    except json.JSONDecodeError:
                        continue
                        
        except Exception:
            pass
            
        is_valid, errors = self.verify_chain_integrity()
        
        return {
            "total_entries": total_entries,
            "chain_valid": is_valid,
            "integrity_errors": len(errors),
            "earliest_timestamp": earliest_timestamp,
            "latest_timestamp": latest_timestamp,
            "chain_file": self.chain_file
        }