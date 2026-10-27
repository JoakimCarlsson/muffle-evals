"""Searching for non-overlapping LALR grammar matches."""
from copy import copy
from dataclasses import dataclass
from typing import Generic, Tuple

from .exceptions import ConfigurationError, LexError, UnexpectedInput
from .lexer import BasicLexer, ContextualLexer, LexerThread, Token
from .utils import TextSlice
from .visitors import _Return_T

###{standalone

@dataclass
class ScanMatch(Generic[_Return_T]):
    """A grammar match, with absolute source offsets and its parsed value."""
    range: Tuple[int, int]
    value: _Return_T


class _ScanTokenRejected(Exception):
    pass


class _ScanCallbackError(Exception):
    def __init__(self, error):
        self.error = error


def _scan_callback(callback):
    def checked(token):
        positions = (token.start_pos, token.line, token.column,
                     token.end_line, token.end_column, token.end_pos)
        try:
            result = callback(token)
        except ConfigurationError as error:
            raise _ScanCallbackError(error) from error
        except ValueError:
            raise _ScanTokenRejected() from None
        except Exception as error:
            raise _ScanCallbackError(error) from error
        if not isinstance(result, Token):
            raise LexError("Callbacks must return a token (returned %r)" % result)
        if positions != (result.start_pos, result.line, result.column,
                         result.end_line, result.end_column, result.end_pos):
            raise LexError("Lexer callback did not preserve token positions")
        return result
    return checked


def _scan(lark, text, start):
    # Keep the normal lexer rules, including keyword reclassification, but
    # validate callback positions before any token can enter the parser.
    conf = copy(lark.parser.lexer_conf)
    conf.callbacks = {name: _scan_callback(cb) for name, cb in conf.callbacks.items()}
    conf.skip_validation = True
    parser = lark.parser.parser
    table = parser._parse_table
    if lark.options.lexer == 'contextual':
        lexer = ContextualLexer(conf, table.states)
        initial = lexer.lexers[table.start_states[start]]
    else:
        lexer = initial = BasicLexer(conf)

    # Ignored patterns must not swallow a possible match at its first offset.
    first_conf = copy(conf)
    first_conf.terminals = [t for t in initial.terminals if t.name not in conf.ignore]
    first_conf.ignore = []
    first = BasicLexer(first_conf)
    pos = text.start
    while pos < text.end:
        thread = LexerThread.from_text(lexer, TextSlice(text.text, pos, text.end))
        cursor = parser.parse_interactive(thread, start)
        recognition_conf = copy(cursor.parser_state.parse_conf)
        recognition_conf.callbacks = {}
        cursor.parser_state.parse_conf = recognition_conf
        tokens = []
        best_count = 0
        try:
            token = first.next_token(thread.state, cursor.parser_state)
            while True:
                tokens.append(token)
                cursor.feed_token(token)
                probe = cursor.copy(deepcopy_values=False)
                try:
                    probe.feed_eof(token)
                except UnexpectedInput:
                    pass
                else:
                    best_count = len(tokens)
                token = next(thread.lex(cursor.parser_state))
        except _ScanCallbackError as error:
            raise error.error from None
        except (UnexpectedInput, EOFError, StopIteration, _ScanTokenRejected):
            pass
        if best_count:
            matched = tokens[:best_count]
            end = matched[-1].end_pos
            # Build values only after choosing an endpoint. No transformer
            # values are copied or shared with speculative parser branches.
            result = parser.parse_interactive(thread, start)
            for token in matched:
                result.feed_token(token)
            value = result.feed_eof(matched[-1])
            yield ScanMatch((pos, end), value)
            pos = end
        else:
            pos += 1

###}
