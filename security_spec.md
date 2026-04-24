# Security Specification (Public Mode)

## 1. Data Invariants
- An attendance record belongs to a specific date and unit.
- Students are marked present or absent via a boolean value or timestamp.
- The application operates in a "Public" mode as requested by the user, meaning authentication is bypassed.
- We still enforce strict payload types (schema) to ensure data hygiene.
- All IDs must match alphanumeric-with-hyphens pattern.

## 2. The "Dirty Dozen" Payloads (Adapted for Public)
1. **Missing required fields:** `date` is missing.
2. **Invalid ID formatting:** using weird strings for document ID.
3. **Invalid type poisoning:** `date` is an object instead of string.
4. **Array exhaustion:** sending 10,000 present students.
5. **Map exhaustion:** sending 10,000 student keys.
6. **Invalid unit name:** unit string is > 100 chars.
7. **Shadow Data:** sending `isAdmin: true` during update.
8. **State Shortcutting:** N/A for this simple object.

## 3. The Test Runner
Tests will verify that these malicious, malformed payloads return PERMISSION_DENIED due to schema failures.

