import pytest

from babel.messages.catalog import Catalog
from babel.messages.frontend import (
    CommandLineInterface,
    ConcatenateCatalog,
    MergeCatalog,
    OptionError,
)
from babel.messages.pofile import PoFileError, read_po

HEADER = (
    'msgid ""\nmsgstr ""\n"Project-Id-Version: P 1.0\\n"\n"Language: de\\n"\n'
    '"Content-Type: text/plain; charset=utf-8\\n"\n\n'
)


def _write(path, body):
    path.write_text(HEADER + body, encoding='utf-8')
    return str(path)


def _cmd(cls, **opts):
    cmd = cls()
    cmd.initialize_options()
    for k, v in opts.items():
        setattr(cmd, k, v)
    cmd.finalize_options()
    return cmd


def test_concat_options():
    with pytest.raises(OptionError):
        _cmd(ConcatenateCatalog)
    with pytest.raises(OptionError):
        _cmd(ConcatenateCatalog, input_files=['a'], unique=True, less_than=3)
    with pytest.raises(OptionError):
        _cmd(ConcatenateCatalog, input_files=['a'], no_wrap=True, width=70)
    assert _cmd(ConcatenateCatalog, input_files=['a'], unique=True).less_than == 2
    assert _cmd(ConcatenateCatalog, input_files=['a']).width == 76


def test_concat_conflicts_and_filters(tmp_path):
    a = _write(tmp_path / 'a.po', 'msgid "x"\nmsgstr "one"\n\nmsgid "y"\nmsgstr "s"\n\nmsgid "o"\nmsgstr "o"\n')
    b = _write(tmp_path / 'b.po', 'msgid "x"\nmsgstr "two"\n\nmsgid "y"\nmsgstr "s"\n')
    out = tmp_path / 'out.po'
    _cmd(ConcatenateCatalog, input_files=[a, b], output_file=str(out)).run()
    text = out.read_text(encoding='utf-8')
    assert '#, fuzzy\nmsgid "x"\nmsgstr ""\n#-#-#-#-#  a.po (P 1.0)  #-#-#-#-#\nmsgstr "one"' in text
    assert '#-#-#-#-#  b.po (P 1.0)  #-#-#-#-#\nmsgstr "two"' in text
    assert 'msgid "y"\nmsgstr "s"' in text
    with pytest.raises(PoFileError):
        read_po(out.open('rb'), abort_invalid=True)

    _cmd(ConcatenateCatalog, input_files=[a, b], output_file=str(out), use_first=True).run()
    cat = read_po(out.open('rb'), abort_invalid=True)
    assert cat['x'].string == 'one'

    _cmd(ConcatenateCatalog, input_files=[a, b], output_file=str(out), unique=True).run()
    assert [m.id for m in read_po(out.open('rb'))][1:] == ['o']
    _cmd(ConcatenateCatalog, input_files=[a, b], output_file=str(out), more_than=1).run()
    assert sorted(m.id for m in read_po(out.open('rb')))[1:] == ['x', 'y']


def test_catalog_conflicts():
    cat = Catalog()
    msg = cat.add('x', 'a')
    assert cat.get_conflicts('x') == []
    cat.add_conflict(msg, 'f.po', 'P', '1')
    assert cat.get_conflicts('x') == [{'message': msg, 'filename': 'f.po', 'project': 'P', 'version': '1'}]


def test_merge_options():
    with pytest.raises(OptionError):
        _cmd(MergeCatalog, input_files=['a'], output_file='o')
    with pytest.raises(OptionError):
        _cmd(MergeCatalog, input_files=['a', 'b'])
    assert _cmd(MergeCatalog, input_files=['a', 'b'], update=True).suffix == '~'


def test_merge_compendium_and_update(tmp_path):
    d = _write(tmp_path / 'def.po', 'msgid "x"\nmsgstr ""\n\nmsgid "y"\nmsgstr "old"\n\nmsgid "z"\nmsgstr "zz"\n')
    ref = tmp_path / 'ref.pot'
    ref.write_text('msgid ""\nmsgstr ""\n\nmsgid "x"\nmsgstr ""\n\nmsgid "y"\nmsgstr ""\n\nmsgid "w"\nmsgstr ""\n')
    comp = _write(tmp_path / 'c.po', 'msgid "x"\nmsgstr "cx"\n\nmsgid "y"\nmsgstr "cy"\n\nmsgid "q"\nmsgstr "q"\n')
    _cmd(
        MergeCatalog, input_files=[d, str(ref)], update=True, backup=True,
        compendium=[comp], no_fuzzy_matching=True,
    ).run()
    assert (tmp_path / 'def.po~').exists()
    cat = read_po((tmp_path / 'def.po').open('rb'))
    assert cat['x'].string == 'cx' and cat['x'].auto_comments == [comp]
    assert cat['y'].string == 'old'
    assert 'q' not in cat and 'z' not in cat

    _cmd(
        MergeCatalog, input_files=[d, str(ref)], output_file=str(tmp_path / 'o.po'),
        compendium=[comp], compendium_overwrite=True, no_compendium_comment=True,
        no_fuzzy_matching=True,
    ).run()
    cat = read_po((tmp_path / 'o.po').open('rb'))
    assert cat['y'].string == 'cy' and not cat['y'].auto_comments
    assert not cat.fuzzy


def test_cli_registered(capsys):
    cli = CommandLineInterface()
    assert {'concat', 'merge'} <= set(cli.commands) <= set(cli.command_classes)
