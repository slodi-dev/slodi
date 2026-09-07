from enum import Enum

# --------------------- #
# Permissions and roles #
# --------------------- #


class Permissions(str, Enum):
    admin = "admin"
    member = "member"
    viewer = "viewer"


class WorkspaceRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class GroupRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


# ------- #
# Content #
# ------- #


class ContentType(str, Enum):
    program = "program"
    event = "event"
    task = "task"


class ReportReason(str, Enum):
    """Why someone flagged a piece of content.

    The reasons a reviewer can act on differently. `unsafe` is deliberately
    separate from `inappropriate`: the first is a safeguarding matter that gets
    escalated within the day, the second is a quality judgement that can wait
    for the next sweep. Collapsing them would bury the one that cannot wait.
    """

    inappropriate = "inappropriate"
    unsafe = "unsafe"
    spam = "spam"
    duplicate = "duplicate"
    wrong_type = "wrong_type"
    other = "other"


class ReportStatus(str, Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"


class Weekday(str, Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"
    unknown = "unknown"


class EventInterval(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    yearly = "yearly"
    unknown = "unknown"


class AgeGroup(str, Enum):
    hrefnuskatar = "Hrefnuskátar"
    drekaskatar = "Drekaskátar"
    falkaskatar = "Fálkaskátar"
    drottskatar = "Dróttskátar"
    rekkaskatar = "Rekkaskátar"
    roverskatar = "Róverskátar"
    vaettaskatar = "Vættaskátar"


class ProgramSortBy(str, Enum):
    newest = "newest"
    oldest = "oldest"
    liked = "liked"
    alpha = "alpha"


# ----- #
# Other #
# ----- #


class Pronouns(str, Enum):
    she_her = "she/her"
    he_him = "he/him"
    they_them = "they/them"
    other = "other"
    prefer_not_to_say = "prefer not to say"


# ------------ #
# Heiðursorðla #
# ------------ #


class HeidursordlaAttemptStatus(str, Enum):
    in_progress = "in_progress"
    won = "won"
    lost = "lost"


class GuessColor(str, Enum):
    """Per-letter feedback colour for a Heiðursorðla guess.

    - ``green``  — letter is in the answer at this position
    - ``yellow`` — letter is in the answer at a different position (and not
      already accounted for by an earlier green/yellow on the same answer
      letter)
    - ``gray``   — letter is not in the answer (or the position is already
      accounted for)
    """

    green = "green"
    yellow = "yellow"
    gray = "gray"
