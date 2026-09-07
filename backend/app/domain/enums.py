from enum import Enum

# --------------------- #
# Permissions and roles #
# --------------------- #


class Permissions(str, Enum):
    """Platform-wide permission, ranked viewer < member < moderator < admin.

    `moderator` is Dagskrárstjórnarteymið: they sweep the Yfirferð board and can
    hide or reject anything in the bank, but have none of an admin's reach over
    users, workspaces or settings. The rank ordering means an admin passes every
    moderator gate for free — see `_PERMISSION_RANK` in `app/core/auth.py`.
    """

    admin = "admin"
    moderator = "moderator"
    member = "member"
    viewer = "viewer"


class ReviewState(str, Enum):
    """Whether Dagskrárstjórnarteymið has looked at a piece of content.

    **This does not gate visibility.** The bank publishes on submit and reviews
    afterwards, so an `unreviewed` item is live. Hiding is a separate act with
    its own column — conflating the two would mean the team could only make
    something visible by approving it, which turns a 3-person queue into a
    bottleneck on every single submission.
    """

    unreviewed = "unreviewed"
    approved = "approved"
    rejected = "rejected"


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
