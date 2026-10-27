"""Search text using a LALR grammar."""
from copy import copy
from typing import Generic, TypeVar, Tuple

from .exceptions import UnexpectedInput, LexError, ConfigurationError
from .utils import TextSlice

###{standalone

_ScanT = TypeVar('_ScanT')


class ScanMatch(Generic[_ScanT]):
    """A grammar match, with absolute source offsets and its parsed value."""

    range: Tuple[int, int]
    value: _ScanT

    def __init__(self, range: Tuple[int, int], value: _ScanT):
        self.range = range
        self.value = value

    def __eq__(self, other):
        if not isinstance(other, ScanMatch):
            return NotImplemented
        return self.range == other.range and self.value == other.value

    def __repr__(self):
        return 'ScanMatch(%r, %r)' % (self.range, self.value)


def _scan(lark, text, start):
    text = TextSlice.cast_from(text)
    pos = text.start
    while pos < text.end:
        # Try bounded inputs so a greedy terminal cannot hide a shorter valid
        # prefix (including keywords folded into a broader basic terminal).
        for end in range(text.end, pos, -1):
            cursor = lark.parse_interactive(TextSlice(text.text, pos, end), start)
            conf = copy(cursor.parser_state.parse_conf)
            conf.callbacks = {}
            cursor.parser_state.parse_conf = conf
            tokens = []
            stream = cursor.lexer_thread.lex(cursor.parser_state)
            valid = True
            while True:
                try:
                    token = next(stream)
                except ConfigurationError:
                    raise
                except StopIteration:
                    break
                except (UnexpectedInput, ValueError):
                    valid = False
                    break
                if any(getattr(token, name, None) is None for name in
                       ('start_pos', 'end_pos', 'line', 'column', 'end_line', 'end_column')):
                    raise LexError('Lexer callback did not preserve token positions')
                if not tokens and token.start_pos != pos:
                    valid = False
                    break
                try:
                    cursor.feed_token(token)
                except UnexpectedInput:
                    valid = False
                    break
                tokens.append(token)
            if not valid or not tokens or tokens[-1].end_pos != end:
                continue
            try:
                cursor.feed_eof(tokens[-1])
            except UnexpectedInput:
                continue
            # Replay only the winning tokens. No speculative transformer value
            # is copied or shared with the returned result.
            winner = lark.parse_interactive(None, start)
            for token in tokens:
                winner.feed_token(token)
            yield ScanMatch((pos, end), winner.feed_eof(tokens[-1]))
            pos = end
            break
        else:
            pos += 1

###}
