"""Database bootstrap and automatic station/candidate seeding on cold start.

Ensures that all tables exist and all 28 physical CAAQMS stations across the 7
supported metropolitan cities are registered in PostgreSQL/PostGIS.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .candidate_models import PollutionSource
from .cities import get_all_city_configs
from .config import get_settings
from .db import engine, get_session, init_db
from .models import Base, Station, _USE_POSTGIS
from .seed_candidates import get_mock_candidates

log = logging.getLogger(__name__)


def seed_all_stations(session: Session) -> int:
    """Register all 28 physical CAAQMS stations from city_configs into PostgreSQL."""
    configs = get_all_city_configs()
    added_or_updated = 0

    for city_key, city_cfg in configs.items():
        city_meta = city_cfg.get("city", {})
        city_name = city_meta.get("name", city_key.title())
        state_name = city_meta.get("state", "India")
        stations = city_cfg.get("stations", [])

        for st in stations:
            st_name = st["name"]
            lon = float(st["lon"])
            lat = float(st["lat"])
            elevation = int(st.get("elevation_m", 0))
            network = st.get("network", "CPCB_CAAQMS")

            # Check if station already exists
            existing = session.execute(
                select(Station).where(Station.name == st_name)
            ).scalars().first()

            if _USE_POSTGIS:
                geom_val = WKTElement(f"POINT({lon} {lat})", srid=4326)
            else:
                geom_val = f"SRID=4326;POINT({lon} {lat})"

            if existing:
                existing.city = city_name
                existing.state = state_name
                existing.elevation_m = elevation
                existing.network = network
                existing.geom = geom_val
            else:
                new_st = Station(
                    id=uuid.uuid4(),
                    name=st_name,
                    network=network,
                    city=city_name,
                    state=state_name,
                    elevation_m=elevation,
                    geom=geom_val,
                )
                session.add(new_st)
                added_or_updated += 1

    session.commit()
    log.info("Physical CAAQMS station registry synced (%d newly added).", added_or_updated)
    return added_or_updated


def seed_all_pollution_sources(session: Session) -> int:
    """Seed curated candidate pollution sources if table is empty."""
    existing_count = session.execute(select(PollutionSource)).scalars().all()
    if existing_count:
        return 0

    mock_sources = get_mock_candidates()
    for src in mock_sources:
        p_src = PollutionSource(
            id=uuid.UUID(src["id"]) if isinstance(src["id"], str) else src["id"],
            name=src["name"],
            type=src["type"],
            description=src.get("description"),
            osm_id=src.get("permit_id"),
            source_origin="curated",
            geom=str(src.get("geometry", {})),
            permit_id=src.get("permit_id"),
            schedule_start=src.get("schedule_start"),
            schedule_end=src.get("schedule_end"),
            near_school=bool(src.get("near_school")),
            school_name=src.get("school_name"),
            school_distance_m=src.get("school_distance_m"),
            near_hospital=bool(src.get("near_hospital")),
            hospital_name=src.get("hospital_name"),
            hospital_distance_m=src.get("hospital_distance_m"),
            dust_suppression_required=bool(src.get("dust_suppression_required")),
            dust_suppression_observed=bool(src.get("dust_suppression_observed")),
        )
        session.add(p_src)

    session.commit()
    log.info("Curated candidate pollution sources seeded (%d sources).", len(mock_sources))
    return len(mock_sources)


def initialize_database_and_registry() -> None:
    """Bootstrap full database schema and seed station/candidate registries on server boot."""
    try:
        init_db()
        # Also ensure candidate models are bound
        Base.metadata.create_all(bind=engine)
        with get_session() as session:
            seed_all_stations(session)
            seed_all_pollution_sources(session)
        log.info("Database bootstrap & registry initialization completed successfully.")
    except Exception as exc:
        log.warning("Database bootstrap skipped or running in degraded mode: %s", exc)
