from typing import Optional, Tuple


def encode_prefixed_name(
    form_key: Optional[str],
    order_index: Optional[int],
    label: str,
    required: bool = False,
) -> str:
    header_parts: list[str] = []
    if form_key:
        header_parts.append(form_key)
    if order_index is not None:
        header_parts.append(f"o={order_index:04d}")
    if required:
        header_parts.append("r=1")
    if header_parts:
        return f"[{'|'.join(header_parts)}] {label}"
    return label


def decode_prefixed_name(name: str) -> Tuple[Optional[str], Optional[int], str, bool]:
    try:
        if name.startswith("[") and "] " in name:
            header, label = name.split("] ", 1)
            header = header[1:]
            parts = header.split("|") if header else []
            form_key = parts[0] if parts else None
            order_index = None
            required = False
            for part in parts[1:]:
                if part.startswith("o="):
                    try:
                        order_index = int(part[2:])
                    except ValueError:
                        order_index = None
                if part == "r=1":
                    required = True
            return form_key, order_index, label, required
    except Exception:
        pass
    return None, None, name, False

