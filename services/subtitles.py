import re


_SRT_TIMING_RE = re.compile(
    r'^\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*'
    r'(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})(?:\s+.*)?\s*$'
)


def normalize_srt(text):
    """Rebuild SRT cues, tolerating blank lines between index, timing and text."""
    lines = (text or '').replace('\ufeff', '').replace('\x00', '').splitlines()
    cues = []
    index = 0

    while index < len(lines):
        match = _SRT_TIMING_RE.match(lines[index])
        if not match:
            index += 1
            continue

        start, end = match.groups()
        index += 1
        cue_text = []
        while index < len(lines) and not _SRT_TIMING_RE.match(lines[index]):
            line = lines[index].strip('\ufeff\x00')
            if line.strip():
                next_line = index + 1
                while next_line < len(lines) and not lines[next_line].strip():
                    next_line += 1
                is_next_cue_index = line.strip().isdigit() and next_line < len(lines) and _SRT_TIMING_RE.match(lines[next_line])
                if not is_next_cue_index:
                    cue_text.append(line)
            index += 1

        if cue_text:
            cues.append((start.replace('.', ','), end.replace('.', ','), cue_text))

    if not cues:
        return text

    return '\r\n\r\n'.join(
        f'{cue_index}\r\n{start} --> {end}\r\n' + '\r\n'.join(cue_text)
        for cue_index, (start, end, cue_text) in enumerate(cues, start=1)
    ) + '\r\n'
