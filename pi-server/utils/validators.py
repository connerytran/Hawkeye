

def _is_valid_foldername(name: str) -> bool:
    # Basic validation: non-empty, no path separators, reasonable length
    if not name or len(name) > 255 or '/' in name or '\\' in name \
        or ':' in name or '*' in name or '?' in name \
        or '"' in name or '<' in name or '>' in name or '|' in name \
        or name.endswith(' ') or name.endswith('.'):
        return False
    return True
