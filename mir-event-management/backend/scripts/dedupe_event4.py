import re
from sqlalchemy.orm import joinedload

from app.core.database import SessionLocal
# חשוב לייבא קודם את מודלי האירועים כדי שרפרנס "Event" יירשם במאגר ה-ORM
from app.events import models as event_models  # noqa: F401
from app.guests import models as guest_models


def _normalize_digits(val: str | None) -> str:
    if not val:
        return ""
    return "".join(ch for ch in str(val) if ch.isdigit())


def _normalize_name(val: str | None) -> str:
    return (val or "").strip().lower()


def score_guest(g: guest_models.Guest) -> int:
    """
    Heuristic: count non-empty scalar fields + number of custom field values.
    Higher score wins.
    """
    skip = {"id", "event_id", "created_at", "updated_at"}
    score = 0
    for col in guest_models.Guest.__table__.columns:
        if col.name in skip:
            continue
        val = getattr(g, col.name, None)
        if val is None:
            continue
        if isinstance(val, str):
            if val.strip():
                score += 1
        else:
            score += 1
    # add weight for custom field values
    if hasattr(g, "field_values"):
        score += len([fv for fv in g.field_values if fv.value and str(fv.value).strip()])
    return score


def main(event_id: int = 4):
    db = SessionLocal()
    try:
        guests = (
            db.query(guest_models.Guest)
            .filter(guest_models.Guest.event_id == event_id)
            .options(joinedload(guest_models.Guest.field_values))
            .all()
        )
        by_key: dict[str, list[guest_models.Guest]] = {}

        for g in guests:
            id_norm = _normalize_digits(g.id_number)
            phone_norm = _normalize_digits(g.mobile_phone)
            alt_phone_norm = _normalize_digits(g.alt_phone_1)
            first = _normalize_name(g.first_name)
            last = _normalize_name(g.last_name)

            key = ""
            if id_norm:
                key = f"id:{id_norm}"
            else:
                if first and last and (phone_norm or alt_phone_norm):
                    key = f"name:{first}|{last}|{phone_norm or alt_phone_norm}"
                else:
                    # cannot build a reliable key; skip
                    continue

            by_key.setdefault(key, []).append(g)

        to_delete: list[guest_models.Guest] = []
        for key, glist in by_key.items():
            if len(glist) <= 1:
                continue
            best = max(glist, key=score_guest)
            for g in glist:
                if g.id != best.id:
                    to_delete.append(g)

        if not to_delete:
            print("No duplicates found for event", event_id)
            return

        ids_to_delete = [g.id for g in to_delete]
        print(f"Deleting {len(ids_to_delete)} duplicates for event {event_id}")
        db.query(guest_models.Guest).filter(guest_models.Guest.id.in_(ids_to_delete)).delete(synchronize_session=False)
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main(4)

