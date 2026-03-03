from enum import Enum


class Pronouns(str, Enum):
    she_her = "she/her"
    he_him = "he/him"
    they_them = "they/them"
    other = "other"
    prefer_not_to_say = "prefer not to say"


class Permissions(str, Enum):
    admin = "admin"
    member = "member"
    viewer = "viewer"


class WorkspaceRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


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


class ContentType(str, Enum):
    program = "program"
    event = "event"
    task = "task"


class AgeGroup(str, Enum):
    hrefnuskaatar = "Hrefnuskátar"
    drekaskaatar = "Drekaskátar"
    falkaskaatar = "Fálkaskátar"
    drottskaatar = "Dróttskátar"
    rekkaskaatar = "Rekkaskátar"
    roverskaatar = "Róverskátar"
    vaettaskaatar = "Vættaskátar"


class GroupRole(str, Enum):
    owner = "owner"
    admin = "admin"
    editor = "editor"
    viewer = "viewer"
