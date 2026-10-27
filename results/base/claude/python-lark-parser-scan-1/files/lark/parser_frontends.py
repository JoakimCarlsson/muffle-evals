from copy import copy
from typing import Any, Callable, Dict, Iterator, Optional, Collection, Union, TYPE_CHECKING

from .exceptions import ConfigurationError, GrammarError, LexError, UnexpectedInput, assert_config
from .utils import get_regexp_width, Serialize, TextOrSlice, TextSlice, LarkInput, ScanMatch
from .lexer import LexerThread, LexerState, Token, BasicLexer, ContextualLexer, Lexer
from .parsers import earley, xearley, cyk
from .parsers.lalr_parser import LALR_Parser
from .parsers.lalr_analysis import Shift
from .parsers.lalr_parser_state import ParseConf, ParserState
from .tree import Tree
from .common import LexerConf, ParserConf, _ParserArgType, _LexerArgType

if TYPE_CHECKING:
    from .parsers.lalr_analysis import ParseTableBase


###{standalone

def _wrap_lexer(lexer_class):
    future_interface = getattr(lexer_class, '__future_interface__', 0)
    if future_interface == 2:
        return lexer_class
    elif future_interface == 1:
        class CustomLexerWrapper1(Lexer):
            def __init__(self, lexer_conf):
                self.lexer = lexer_class(lexer_conf)
            def lex(self, lexer_state, parser_state):
                if isinstance(lexer_state.text, TextSlice) and not lexer_state.text.is_complete_text():
                    raise TypeError("Interface=1 Custom Lexer don't support TextSlice")
                lexer_state.text = lexer_state.text
                return self.lexer.lex(lexer_state, parser_state)
        return CustomLexerWrapper1
    elif future_interface == 0:
        class CustomLexerWrapper0(Lexer):
            def __init__(self, lexer_conf):
                self.lexer = lexer_class(lexer_conf)

            def lex(self, lexer_state, parser_state):
                if isinstance(lexer_state.text, TextSlice):
                    if not lexer_state.text.is_complete_text():
                        raise TypeError("Interface=0 Custom Lexer don't support TextSlice")
                    return self.lexer.lex(lexer_state.text.text)
                return self.lexer.lex(lexer_state.text)
        return CustomLexerWrapper0
    else:
        raise ValueError(f"Unknown __future_interface__ value {future_interface}, integer 0-2 expected")



def _scan_feed(states, state_stack, token_type) -> bool:
    "Feed a token type to the LALR state stack. Returns False if it isn't accepted."
    while True:
        try:
            action, arg = states[state_stack[-1]][token_type]
        except KeyError:
            return False
        if action is Shift:
            state_stack.append(arg)
            return True
        size = len(arg.expansion)
        if size:
            del state_stack[-size:]
        state_stack.append(states[state_stack[-1]][arg.origin.name][1])


def _scan_accepts_end(states, state_stack, end_state) -> bool:
    "Check if the parser would accept the end of the input now, without changing the stack."
    base = len(state_stack)     # The part of state_stack that is still in use
    extra: list = []            # States that would be pushed on top of it
    state = state_stack[-1]
    while True:
        try:
            action, rule = states[state]['$END']
        except KeyError:
            return False
        if action is Shift:
            return False
        size = len(rule.expansion)
        popped = min(size, len(extra))
        if popped:
            del extra[-popped:]
        base -= size - popped
        below = extra[-1] if extra else state_stack[base - 1]
        state = states[below][rule.origin.name][1]
        if state == end_state:
            return True
        extra.append(state)


def _deserialize_parsing_frontend(data, memo, lexer_conf, callbacks, options):
    parser_conf = ParserConf.deserialize(data['parser_conf'], memo)
    cls = (options and options._plugins.get('LALR_Parser')) or LALR_Parser
    parser = cls.deserialize(data['parser'], memo, callbacks, options.debug)
    parser_conf.callbacks = callbacks
    return ParsingFrontend(lexer_conf, parser_conf, options, parser=parser)


_parser_creators: 'Dict[str, Callable[[LexerConf, Any, Any], Any]]' = {}


class ParsingFrontend(Serialize):
    __serialize_fields__ = 'lexer_conf', 'parser_conf', 'parser'

    lexer_conf: LexerConf
    parser_conf: ParserConf
    options: Any

    def __init__(self, lexer_conf: LexerConf, parser_conf: ParserConf, options, parser=None):
        self.parser_conf = parser_conf
        self.lexer_conf = lexer_conf
        self.options = options

        # Set-up parser
        if parser:  # From cache
            self.parser = parser
        else:
            create_parser = _parser_creators.get(parser_conf.parser_type)
            assert create_parser is not None, "{} is not supported in standalone mode".format(
                    parser_conf.parser_type
                )
            self.parser = create_parser(lexer_conf, parser_conf, options)

        # Set-up lexer
        lexer_type = lexer_conf.lexer_type
        self.skip_lexer = False
        if lexer_type in ('dynamic', 'dynamic_complete'):
            assert lexer_conf.postlex is None
            self.skip_lexer = True
            return

        if isinstance(lexer_type, type):
            assert issubclass(lexer_type, Lexer)
            self.lexer = _wrap_lexer(lexer_type)(lexer_conf)
        elif isinstance(lexer_type, str):
            create_lexer = {
                'basic': create_basic_lexer,
                'contextual': create_contextual_lexer,
            }[lexer_type]
            self.lexer = create_lexer(lexer_conf, self.parser, lexer_conf.postlex, options)
        else:
            raise TypeError("Bad value for lexer_type: {lexer_type}")

        if lexer_conf.postlex:
            self.lexer = PostLexConnector(self.lexer, lexer_conf.postlex)

    def _verify_start(self, start=None):
        if start is None:
            start_decls = self.parser_conf.start
            if len(start_decls) > 1:
                raise ConfigurationError("Lark initialized with more than 1 possible start rule. Must specify which start rule to parse", start_decls)
            start ,= start_decls
        elif start not in self.parser_conf.start:
            raise ConfigurationError("Unknown start rule %s. Must be one of %r" % (start, self.parser_conf.start))
        return start

    def _make_lexer_thread(self, text: Optional[LarkInput]) -> Union[LarkInput, LexerThread, None]:
        cls = (self.options and self.options._plugins.get('LexerThread')) or LexerThread
        if self.skip_lexer:
            return text
        if text is None:
            return cls(self.lexer, None)
        if isinstance(text, (str, bytes, TextSlice)):
            return cls.from_text(self.lexer, text)
        return cls.from_custom_input(self.lexer, text)

    def parse(self, text: Optional[LarkInput], start=None, on_error=None):
        if self.lexer_conf.lexer_type in ("dynamic", "dynamic_complete"):
            if isinstance(text, TextSlice) and not text.is_complete_text():
                raise TypeError(f"Lexer {self.lexer_conf.lexer_type} does not support text slices.")

        chosen_start = self._verify_start(start)
        kw = {} if on_error is None else {'on_error': on_error}
        stream = self._make_lexer_thread(text)
        return self.parser.parse(stream, chosen_start, **kw)

    def scan(self, text: TextOrSlice, start=None) -> 'Iterator[ScanMatch]':
        if self.parser_conf.parser_type != 'lalr':
            raise ConfigurationError("scan() currently only works with parser='lalr'")
        if self.lexer_conf.postlex is not None:
            raise ConfigurationError("scan() doesn't support postlex")
        if self.skip_lexer or isinstance(self.lexer_conf.lexer_type, type):
            raise ConfigurationError("scan() only works with the 'basic' and 'contextual' lexers")
        chosen_start = self._verify_start(start)
        text_slice = TextSlice.cast_from(text)
        # Validation is done eagerly; only the search itself is lazy.
        return self._scan(text_slice, chosen_start)

    def _make_scan_first_lexer(self, start_state) -> BasicLexer:
        """A lexer for the first token of a match: It can't be an ignored terminal.
        """
        conf = copy(self.lexer_conf)
        ignore = set(conf.ignore)
        terminals = [t for t in conf.terminals if t.name not in ignore]
        if conf.lexer_type == 'contextual':
            accepts = self.parser._parse_table.states[start_state]
            terminals = [t for t in terminals if t.name in accepts]
        conf.terminals = terminals
        conf.ignore = ()
        conf.skip_validation = True
        return create_basic_lexer(conf, self.parser, None, self.options)

    def _scan(self, text: TextSlice, start: str) -> 'Iterator[ScanMatch]':
        parse_conf = ParseConf(self.parser._parse_table, self.parser.parser.callbacks, start)
        first_lexer = self._make_scan_first_lexer(parse_conf.start_state)
        token_callbacks = {k: v for k, v in parse_conf.callbacks.items() if isinstance(k, str)}

        # Line counter that tracks the text, up to the position that's currently searched
        line_ctr = LexerState(text).line_ctr
        pos = text.start
        while pos < text.end:
            if pos > line_ctr.char_pos:
                line_ctr.feed(text.text[line_ctr.char_pos:pos])
            tokens = self._scan_at(text, pos, line_ctr, parse_conf, first_lexer, token_callbacks)
            if tokens is None:
                pos += 1
                continue
            parser_state = ParserState(parse_conf, None)
            for token in tokens:
                parser_state.feed_token(token)
            value = parser_state.feed_token(Token.new_borrow_pos('$END', '', tokens[-1]), True)
            end = tokens[-1].end_pos
            yield ScanMatch((pos, end), value)
            pos = end

    def _scan_at(self, text: TextSlice, pos, line_ctr, parse_conf, first_lexer, token_callbacks):
        """Find the longest match starting at pos. Returns its tokens, or None.

        Only the parser's state stack is maintained: The tokens are saved, and the match is built from them later.
        """
        states = parse_conf.states
        end_state = parse_conf.end_state
        lexer_state = LexerState(TextSlice(text.text, pos, text.end), copy(line_ctr))
        parser_state = ParserState(parse_conf, None)
        state_stack = parser_state.state_stack
        tokens = []
        best = 0

        def stream():
            yield first_lexer.next_token(lexer_state, parser_state)
            yield from self.lexer.lex(lexer_state, parser_state)

        try:
            for token in stream():
                if token.start_pos is None or token.end_pos is None:
                    raise LexError("A lexer callback did not preserve token positions (returned %r). "
                                   "Use Token.update() to change a token" % (token,))
                if not _scan_feed(states, state_stack, token.type):
                    break
                tokens.append(token)
                callback = token_callbacks.get(token.type)
                if callback is not None:
                    callback(Token.new_borrow_pos(token.type, token.value, token))
                if token.end_pos > pos and _scan_accepts_end(states, state_stack, end_state):
                    best = len(tokens)
        except ConfigurationError:
            raise
        except (UnexpectedInput, EOFError, ValueError):
            pass

        return tokens[:best] if best else None

    def parse_interactive(self, text: Optional[TextOrSlice]=None, start=None):
        # TODO BREAK - Change text from Optional[str] to text: str = ''.
        #   Would break behavior of exhaust_lexer(), which currently raises TypeError, and after the change would just return []
        chosen_start = self._verify_start(start)
        if self.parser_conf.parser_type != 'lalr':
            raise ConfigurationError("parse_interactive() currently only works with parser='lalr' ")
        stream = self._make_lexer_thread(text)
        return self.parser.parse_interactive(stream, chosen_start)


def _validate_frontend_args(parser, lexer) -> None:
    assert_config(parser, ('lalr', 'earley', 'cyk'))
    if not isinstance(lexer, type):     # not custom lexer?
        expected = {
            'lalr': ('basic', 'contextual'),
            'earley': ('basic', 'dynamic', 'dynamic_complete'),
            'cyk': ('basic', ),
         }[parser]
        assert_config(lexer, expected, 'Parser %r does not support lexer %%r, expected one of %%s' % parser)


def _get_lexer_callbacks(transformer, terminals):
    result = {}
    for terminal in terminals:
        callback = getattr(transformer, terminal.name, None)
        if callback is not None:
            result[terminal.name] = callback
    return result

class PostLexConnector:
    def __init__(self, lexer, postlexer):
        self.lexer = lexer
        self.postlexer = postlexer

    def lex(self, lexer_state, parser_state):
        i = self.lexer.lex(lexer_state, parser_state)
        return self.postlexer.process(i)



def create_basic_lexer(lexer_conf, parser, postlex, options) -> BasicLexer:
    cls = (options and options._plugins.get('BasicLexer')) or BasicLexer
    return cls(lexer_conf)

def create_contextual_lexer(lexer_conf: LexerConf, parser, postlex, options) -> ContextualLexer:
    cls = (options and options._plugins.get('ContextualLexer')) or ContextualLexer
    parse_table: ParseTableBase[int] = parser._parse_table
    states: Dict[int, Collection[str]] = {idx:list(t.keys()) for idx, t in parse_table.states.items()}
    always_accept: Collection[str] = postlex.always_accept if postlex else ()
    return cls(lexer_conf, states, always_accept=always_accept)

def create_lalr_parser(lexer_conf: LexerConf, parser_conf: ParserConf, options=None) -> LALR_Parser:
    debug = options.debug if options else False
    strict = options.strict if options else False
    cls = (options and options._plugins.get('LALR_Parser')) or LALR_Parser
    return cls(parser_conf, debug=debug, strict=strict)

_parser_creators['lalr'] = create_lalr_parser

###}

class EarleyRegexpMatcher:
    def __init__(self, lexer_conf):
        self.regexps = {}
        for t in lexer_conf.terminals:
            regexp = t.pattern.to_regexp()
            try:
                width = get_regexp_width(regexp)[0]
            except ValueError:
                raise GrammarError("Bad regexp in token %s: %s" % (t.name, regexp))
            else:
                if width == 0:
                    raise GrammarError("Dynamic Earley doesn't allow zero-width regexps", t)
            if lexer_conf.use_bytes:
                regexp = regexp.encode('utf-8')

            self.regexps[t.name] = lexer_conf.re_module.compile(regexp, lexer_conf.g_regex_flags)

    def match(self, term, text, index=0):
        return self.regexps[term.name].match(text, index)


def create_earley_parser__dynamic(lexer_conf: LexerConf, parser_conf: ParserConf, **kw):
    if lexer_conf.callbacks:
        raise GrammarError("Earley's dynamic lexer doesn't support lexer_callbacks.")

    earley_matcher = EarleyRegexpMatcher(lexer_conf)
    return xearley.Parser(lexer_conf, parser_conf, earley_matcher.match, **kw)

def _match_earley_basic(term, token):
    return term.name == token.type

def create_earley_parser__basic(lexer_conf: LexerConf, parser_conf: ParserConf, **kw):
    return earley.Parser(lexer_conf, parser_conf, _match_earley_basic, **kw)

def create_earley_parser(lexer_conf: LexerConf, parser_conf: ParserConf, options) -> earley.Parser:
    resolve_ambiguity = options.ambiguity == 'resolve'
    debug = options.debug if options else False
    tree_class = options.tree_class or Tree if options.ambiguity != 'forest' else None

    extra = {}
    if lexer_conf.lexer_type == 'dynamic':
        f = create_earley_parser__dynamic
    elif lexer_conf.lexer_type == 'dynamic_complete':
        extra['complete_lex'] = True
        f = create_earley_parser__dynamic
    else:
        f = create_earley_parser__basic

    return f(lexer_conf, parser_conf, resolve_ambiguity=resolve_ambiguity,
             debug=debug, tree_class=tree_class, ordered_sets=options.ordered_sets, **extra)



class CYK_FrontEnd:
    def __init__(self, lexer_conf, parser_conf, options=None):
        self.parser = cyk.Parser(parser_conf.rules)

        self.callbacks = parser_conf.callbacks

    def parse(self, lexer_thread, start):
        tokens = list(lexer_thread.lex(None))
        tree = self.parser.parse(tokens, start)
        return self._transform(tree)

    def _transform(self, tree):
        subtrees = list(tree.iter_subtrees())
        for subtree in subtrees:
            subtree.children = [self._apply_callback(c) if isinstance(c, Tree) else c for c in subtree.children]

        return self._apply_callback(tree)

    def _apply_callback(self, tree):
        return self.callbacks[tree.rule](tree.children)


_parser_creators['earley'] = create_earley_parser
_parser_creators['cyk'] = CYK_FrontEnd


def _construct_parsing_frontend(
        parser_type: _ParserArgType,
        lexer_type: _LexerArgType,
        lexer_conf,
        parser_conf,
        options
):
    assert isinstance(lexer_conf, LexerConf)
    assert isinstance(parser_conf, ParserConf)
    parser_conf.parser_type = parser_type
    lexer_conf.lexer_type = lexer_type
    return ParsingFrontend(lexer_conf, parser_conf, options)
