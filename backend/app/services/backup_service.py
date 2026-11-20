import os
import gzip
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("cloudsentinel.backup")

class BackupService:
    """Manages SQLite database backups, restores, and data export."""

    @staticmethod
    def create_database_backup() -> Dict[str, Any]:
        """
        Create a gzipped snapshot of cloudsentinel.db in the backups folder.
        Credentials stored in OS Keyring are separate and not exposed.
        """
        settings.BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_filename = f"cloudsentinel_backup_{timestamp_str}.db.gz"
        backup_path = settings.BACKUPS_DIR / backup_filename

        db_file = settings.DB_FILE
        if not db_file.exists():
            raise FileNotFoundError(f"Database file {db_file} does not exist.")

        with open(db_file, "rb") as f_in:
            with gzip.open(backup_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        size_kb = round(backup_path.stat().st_size / 1024, 2)
        logger.info(f"Database backup created: {backup_path} ({size_kb} KB)")

        return {
            "status": "success",
            "backup_path": str(backup_path),
            "filename": backup_filename,
            "size_kb": size_kb,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "warning": "OS Keyring credentials are stored in your operating system's native vault and are not included in this database backup.",
        }

    @staticmethod
    def restore_database_backup(backup_path_str: str) -> Dict[str, Any]:
        """
        Restore a gzipped database backup into cloudsentinel.db.
        """
        backup_path = Path(backup_path_str)
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file not found at {backup_path}")

        db_file = settings.DB_FILE
        # Create a pre-restore backup first
        pre_restore = settings.BACKUPS_DIR / f"pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        if db_file.exists():
            shutil.copyfile(db_file, pre_restore)

        # Decompress backup into target DB
        with gzip.open(backup_path, "rb") as f_in:
            with open(db_file, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        logger.info(f"Database successfully restored from {backup_path}")
        return {
            "status": "success",
            "message": "Database restored successfully.",
            "safety_backup_path": str(pre_restore),
        }
