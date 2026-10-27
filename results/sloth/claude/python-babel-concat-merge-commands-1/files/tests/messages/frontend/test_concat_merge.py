from __future__ import annotations

import pytest

from babel.messages import Catalog, frontend
from babel.messages.pofile import PoFileError, read_po

HEADER = 'msgid ""\nmsgstr ""\n"Project-Id-Version: P 1\\n"\n"Language: de\\n"\n\n'


def _po(tmp_path, name, body):
    path = tmp_path / name
    path.write_text(HEADER + body, encoding='utf-8')
    return str(path)


def _concat(*files, **opts):
    cmd = frontend.ConcatenateCatalog()
    cmd.input_files = list(files)
    for key, value in opts.items():
        setattr(cmd, key, value)
    cmd.finalize_options()
    cmd.run()


@pytest.fixture
def two_files(tmp_path):
    a = _po(tmp_path, 'a.po', 'msgid "x"\nmsgstr "ex"\n\nmsgid "same"\nmsgstr "s"\n\n'
                              'msgid "only"\nmsgstr "o"\n\nmsgid "p"\nmsgid_plural "ps"\n'
                              'msgstr[0] "a"\nmsgstr[1] "as"\n')
    b = _po(tmp_path, 'b.po', 'msgid "x"\nmsgstr "EKS"\n\nmsgid "same"\nmsgstr "s"\n\n'
                              'msgid "p"\nmsgid_plural "ps"\nmsgstr[0] "a"\nmsgstr[1] "AS"\n')
    return a, b, str(tmp_path / 'out.po')


def test_concat_conflicts(two_files):
    a, b, out = two_files
    _concat(a, b, output_file=out)
    text = open(out, encoding='utf-8').read()
    assert '#, fuzzy\nmsgid "x"\nmsgstr ""\n#-#-#-#-#  a.po (P 1)  #-#-#-#-#\nmsgstr "ex"\n' \
           '#-#-#-#-#  b.po (P 1)  #-#-#-#-#\nmsgstr "EKS"\n' in text
    assert 'msgid "same"\nmsgstr "s"\n' in text
    assert 'msgstr[0] ""\nmsgstr[1] ""\n#-#-#-#-#  a.po (P 1)  #-#-#-#-#\nmsgstr[0] "a"\nmsgstr[1] "as"\n' in text
    assert text.count('#, fuzzy') == 2


def test_concat_use_first(two_files):
    a, b, out = two_files
    _concat(a, b, output_file=out, use_first=True)
    text = open(out, encoding='utf-8').read()
    assert '#-#-#-#-#' not in text
    assert 'msgstr "ex"' in text


def test_concat_unique_and_thresholds(two_files):
    a, b, out = two_files
    _concat(a, b, output_file=out, unique=True)
    catalog = read_po(open(out, 'rb'))
    assert [m.id for m in catalog if m.id] == ['only']
    _concat(a, b, output_file=out, more_than=1, use_first=True)
    catalog = read_po(open(out, 'rb'))
    assert sorted(m.id if isinstance(m.id, str) else m.id[0] for m in catalog if m.id) == ['p', 'same', 'x']


def test_concat_stdout(two_files, capsys):
    a, b, _ = two_files
    _concat(a, b, output_file='-', use_first=True)
    assert 'msgid "only"' in capsys.readouterr().out


@pytest.mark.parametrize('opts', [
    {'unique': True, 'less_than': 3},
    {'unique': True, 'more_than': 1},
    {'no_wrap': True, 'width': 50},
])
def test_concat_option_errors(opts):
    cmd = frontend.ConcatenateCatalog()
    cmd.input_files = ['a.po']
    for key, value in opts.items():
        setattr(cmd, key, value)
    with pytest.raises(frontend.OptionError):
        cmd.finalize_options()


def test_concat_no_input_files():
    with pytest.raises(frontend.OptionError):
        frontend.ConcatenateCatalog().finalize_options()


def test_catalog_conflicts_and_read_po_refuses_marker(two_files):
    a, b, out = two_files
    catalog = Catalog()
    message = catalog.add('x', 'ex')
    catalog.add_conflict(message, 'a.po', 'P', '1')
    assert catalog.get_conflicts('x') == [
        {'message': message, 'filename': 'a.po', 'project': 'P', 'version': '1'},
    ]
    assert catalog.get_conflicts('x', 'ctx') == []
    _concat(a, b, output_file=out)
    with pytest.raises(PoFileError):
        read_po(open(out, 'rb'), abort_invalid=True)


def _merge(*files, **opts):
    cmd = frontend.MergeCatalog()
    cmd.input_files = list(files)
    for key, value in opts.items():
        setattr(cmd, key, value)
    cmd.finalize_options()
    cmd.run()


@pytest.fixture
def merge_files(tmp_path):
    d = _po(tmp_path, 'def.po', 'msgid "a"\nmsgstr "A"\n\nmsgid "b"\nmsgstr ""\n\n'
                                'msgid "old"\nmsgstr "O"\n')
    ref = str(tmp_path / 'ref.pot')
    open(ref, 'w').write('msgid ""\nmsgstr ""\n\nmsgid "a"\nmsgstr ""\n\n'
                         'msgid "b"\nmsgstr ""\n\nmsgid "c"\nmsgstr ""\n')
    comp = _po(tmp_path, 'comp.po', 'msgid "a"\nmsgstr "A2"\n\nmsgid "b"\nmsgstr "B"\n\n'
                                    'msgid "zzz"\nmsgstr "Z"\n')
    return d, ref, comp, str(tmp_path / 'out.po')


def test_merge_option_errors(merge_files):
    d, ref, _, out = merge_files
    for files, opts in [([d], {'output_file': out}), ([d, ref, d], {'output_file': out}), ([d, ref], {})]:
        cmd = frontend.MergeCatalog()
        cmd.input_files = files
        for key, value in opts.items():
            setattr(cmd, key, value)
        with pytest.raises(frontend.OptionError):
            cmd.finalize_options()


def test_merge_basic(merge_files):
    d, ref, _, out = merge_files
    _merge(d, ref, output_file=out, no_fuzzy_matching=True)
    catalog = read_po(open(out, 'rb'))
    assert [m.id for m in catalog if m.id] == ['a', 'b', 'c']
    assert catalog['a'].string == 'A'
    assert 'old' in catalog.obsolete


def test_merge_compendium(merge_files):
    d, ref, comp, out = merge_files
    _merge(d, ref, output_file=out, no_fuzzy_matching=True, compendium=[comp])
    catalog = read_po(open(out, 'rb'))
    assert catalog['a'].string == 'A'
    assert catalog['b'].string == 'B'
    assert catalog['b'].auto_comments == [comp]
    assert 'zzz' not in catalog and catalog['c'].string == ''
    _merge(d, ref, output_file=out, no_fuzzy_matching=True, compendium=[comp],
           compendium_overwrite=True, no_compendium_comment=True)
    catalog = read_po(open(out, 'rb'))
    assert catalog['a'].string == 'A2'
    assert catalog['b'].auto_comments == []
    assert any(m.string == 'A' for m in catalog.obsolete.values())


def test_merge_update_backup_and_fuzzy_flag(merge_files):
    d, ref, _, _ = merge_files
    original = open(d, encoding='utf-8').read()
    _merge(d, ref, update=True, backup=True, suffix='.bak')
    assert open(d + '.bak', encoding='utf-8').read() == original
    assert 'msgid "c"' in open(d, encoding='utf-8').read()


def test_merge_fuzzy_header_flag(tmp_path):
    d = _po(tmp_path, 'def.po', 'msgid "hello world"\nmsgstr "hallo"\n')
    ref = str(tmp_path / 'ref.pot')
    open(ref, 'w').write('msgid ""\nmsgstr ""\n\nmsgid "hello worlds"\nmsgstr ""\n')
    out = str(tmp_path / 'out.po')
    _merge(d, ref, output_file=out)
    assert read_po(open(out, 'rb')).fuzzy
    _merge(d, ref, output_file=out, no_fuzzy_matching=True)
    assert not read_po(open(out, 'rb')).fuzzy


def test_cli_registered(capsys):
    cli = frontend.CommandLineInterface()
    assert {'concat', 'merge'} <= set(cli.commands) and {'concat', 'merge'} <= set(cli.command_classes)
