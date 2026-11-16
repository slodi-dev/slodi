import datetime as dt
from typing import Final

from app.domain.enums import ContentLevel

DEFAULT_LENGTH: Final[dict[ContentLevel, dt.timedelta]] = {
    ContentLevel.task: dt.timedelta(minutes=15),
    ContentLevel.event: dt.timedelta(minutes=90),
    ContentLevel.program: dt.timedelta(weeks=4),
    ContentLevel.season: dt.timedelta(weeks=36),
}
