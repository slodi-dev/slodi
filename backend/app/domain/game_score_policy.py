from typing import Final

# Games whose submitted score is a *current holdings* figure rather than a best
# ever achieved, so a new submission replaces the stored value even when it is
# lower.
#
# Arnór-Clicker's board ranks on Þingstig the player currently holds, and those
# are spent to hire a fundarstjóri — so buying one has to be able to move the
# player back down the table. Every other game keeps the default behaviour, an
# arcade high score that only ever rises.
REPLACE_SCORE_GAMES: Final[frozenset[str]] = frozenset({"arnor-clicker"})


def score_replaces(game_slug: str) -> bool:
    """Whether a submission for this game may lower the stored score."""
    return game_slug in REPLACE_SCORE_GAMES


# Submissions allowed per user per minute, by game.
#
# The default suits a game with long runs. Laddí-bird is a flappy clone where a
# run ending at the first pipe takes about eight seconds, so a frustrated player
# legitimately finishes far more runs a minute than someone playing a long
# Hörpuhopp session — at the shared default they would start seeing "could not
# save score" during ordinary play.
SUBMISSIONS_PER_MINUTE: Final[dict[str, int]] = {"laddi-bird": 30}
DEFAULT_SUBMISSIONS_PER_MINUTE: Final[int] = 10


def submissions_per_minute(game_slug: str) -> int:
    """How many score submissions this game allows per user per minute."""
    return SUBMISSIONS_PER_MINUTE.get(game_slug, DEFAULT_SUBMISSIONS_PER_MINUTE)


# The highest score each game will accept.
#
# Laddí-bird spawns one pipe every 100 frames at 60fps, so a point costs 1.67
# seconds of flawless play: 2000 points is over 55 minutes without a mistake.
# The old shared ceiling of 999,999,999 was around 53 years of perfect play, so
# it bounded nothing at all.
# Only Laddí-bird is capped: it is new, so no existing entry can be
# invalidated. Hörpuhopp has a live board whose real top scores have not been
# measured, and a ceiling set below one of them would reject that player's runs
# from then on. Add it once the current standings have been checked.
MAX_SCORE: Final[dict[str, int]] = {"laddi-bird": 2_000}
DEFAULT_MAX_SCORE: Final[int] = 999_999_999


def max_score(game_slug: str) -> int:
    """The largest score this game considers humanly possible."""
    return MAX_SCORE.get(game_slug, DEFAULT_MAX_SCORE)


# Games whose submissions must carry a signed run token, and the pace each one
# is capped at. `min_seconds_per_point` is deliberately a little under the true
# rate so that network latency and frame timing never reject an honest run.
RUN_TOKEN_GAMES: Final[frozenset[str]] = frozenset({"laddi-bird"})
MIN_SECONDS_PER_POINT: Final[dict[str, float]] = {"laddi-bird": 1.5}


def requires_run_token(game_slug: str) -> bool:
    """Whether this game's scores are only accepted with a signed run token."""
    return game_slug in RUN_TOKEN_GAMES


def min_seconds_per_point(game_slug: str) -> float:
    """Fastest a point can legitimately be earned, in seconds."""
    return MIN_SECONDS_PER_POINT.get(game_slug, 0.0)


# Slack on the pace check, in seconds.
#
# A run token is stamped when the server receives the start-of-run call, which
# is a round trip after the run actually began, and the pace figures leave under
# a second of headroom at low scores. Without this, a slow mobile connection or
# a cold route would reject an honest one- or two-point run. It costs nothing:
# a cheat gains a few seconds' worth of points, not a leaderboard.
PACE_GRACE_SECONDS: Final[float] = 5.0
