API Reference
=============

Lark
----

.. autoclass:: lark.Lark
    :members: open, parse, scan, parse_interactive, lex, save, load, get_terminal, open_from_package


Using Unicode character classes with ``regex``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Python's builtin ``re`` module has a few persistent known bugs and also won't parse
advanced regex features such as character classes.
With ``pip install lark[regex]``, the ``regex`` module will be
installed alongside lark and can act as a drop-in replacement to ``re``.

Any instance of Lark instantiated with ``regex=True`` will use the ``regex`` module instead of ``re``.

For example, we can use character classes to match PEP-3131 compliant Python identifiers:

::

    from lark import Lark
    >>> g = Lark(r"""
                        ?start: NAME
                        NAME: ID_START ID_CONTINUE*
                        ID_START: /[\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}_]+/
                        ID_CONTINUE: ID_START | /[\p{Mn}\p{Mc}\p{Nd}\p{Pc}·]+/
                    """, regex=True)

    >>> g.parse('வணக்கம்')
    'வணக்கம்'


Tree
----

.. autoclass:: lark.Tree
    :members: pretty, find_pred, find_data, iter_subtrees, scan_values,
        iter_subtrees_topdown, __rich__

Token
-----

.. autoclass:: lark.Token

Transformer, Visitor & Interpreter
----------------------------------

See :doc:`visitors`.

ForestVisitor, ForestTransformer, & TreeForestTransformer
-----------------------------------------------------------

See :doc:`forest`.

UnexpectedInput
---------------

.. autoclass:: lark.exceptions.UnexpectedInput
    :members: get_context, match_examples

.. autoclass:: lark.exceptions.UnexpectedToken

.. autoclass:: lark.exceptions.UnexpectedCharacters

.. autoclass:: lark.exceptions.UnexpectedEOF

InteractiveParser
-----------------

.. autoclass:: lark.parsers.lalr_interactive_parser.InteractiveParser
    :members: choices, feed_token, copy, pretty, resume_parse, exhaust_lexer, accepts, as_immutable

.. autoclass:: lark.parsers.lalr_interactive_parser.ImmutableInteractiveParser
    :members: choices, feed_token, copy, pretty, resume_parse, exhaust_lexer, accepts, as_mutable


ast_utils
---------

For an example of using ``ast_utils``, see `/examples/advanced/create_ast.py`_

.. autoclass:: lark.ast_utils.Ast

.. autoclass:: lark.ast_utils.AsList

.. autofunction:: lark.ast_utils.create_transformer

.. _/examples/advanced/create_ast.py: examples/advanced/create_ast.html

Indenter
--------

.. autoclass:: lark.indenter.Indenter
.. autoclass:: lark.indenter.PythonIndenter

TextSlice
---------

.. autoclass:: lark.utils.TextSlice

ScanMatch
---------

.. autoclass:: lark.ScanMatch

    ``range`` is the pair of absolute start and end offsets (end exclusive).
    ``value`` is the parse result, including an embedded transformer's result.
    Matches compare by value. ``ScanMatch[T]`` describes a match whose value is ``T``.

``Lark.scan(text, start=None)`` yields non-empty, non-overlapping matches,
choosing the longest parseable prefix at the earliest available position.
Ignored terminals may occur inside a match, but never at its boundaries.
TextSlice limits the search while preserving positions in the original text.
Scanning requires LALR with a basic or contextual lexer and no postlex.
With multiple start symbols, supply ``start`` explicitly.
Lexer callbacks may run on discarded candidates; ValueError rejects a
candidate, while other errors propagate. Callback tokens must preserve source
positions. Search tries bounded prefixes and can be expensive on long inputs.
