from typing import Final

# Games allowed to store a save.
#
# The scores endpoint is reached through the frontend's /api/leikir/[game]
# proxy, which checks its own allowlist before forwarding. Saves are called
# directly on the API with a Bearer token — deliberately, to keep the several-KB
# Auth0 session cookie off a 1.3 KB request — so there is no proxy in front and
# nothing else would stop an arbitrary slug creating arbitrary rows.
#
# Mirrors KNOWN_GAMES in frontend/lib/leikir-games.ts; a new scored game has to
# be added in both.
SAVEABLE_GAMES: Final[frozenset[str]] = frozenset({"arnor-clicker", "horpuhopp"})


def is_saveable(game_slug: str) -> bool:
    """Whether this game may store a save."""
    return game_slug in SAVEABLE_GAMES


# Largest accepted save, serialised. The biggest real Arnór-Clicker save is
# about 1.3 KB with every upgrade owned, so this is an order of magnitude of
# headroom while keeping the column from being used as free storage.
MAX_STATE_BYTES: Final[int] = 16 * 1024
