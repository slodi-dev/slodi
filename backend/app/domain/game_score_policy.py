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
