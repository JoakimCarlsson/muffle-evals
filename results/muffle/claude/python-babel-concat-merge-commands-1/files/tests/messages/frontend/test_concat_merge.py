import pytest

from babel.messages import Catalog
from babel.messages.frontend import ConcatenateCatalog, MergeCatalog, OptionError
from babel.messages.pofile import PoFileError, read_po, write_po

HEADER = (
    'msgid ""\nmsgstr ""\n"Project-Id-Version: {p} 1.0\\n"\n"Language: sv\\n"\n'
    '"Content-Type: text/plain; charset=utf-8\\n"\n\n'
)


def _po(path, body, project='P'):
    path.write_text(HEADER.format(p=project) + body, encoding='utf-8')
    return str(path)


def _concat(**kwargs):
    cmd = ConcatenateCatalog()
    for key, value in kwargs.items():
        setattr(cmd, key, value)
    cmd.finalize_options()
    return cmd


@pytest.fixture
def two_files(tmp_path):
    a = _po(tmp_path / 'a.po', 'msgid "x"\nmsgstr "A"\n\nmsgid "same"\nmsgstr "s"\n', 'PA')
    b = _po(tmp_path / 'b.po', 'msgid "x"\nmsgstr "B"\n\nmsgid "same"\nmsgstr "s"\n\nmsgid "y"\nmsgstr "Y"\n', 'PB')
    return a, b


def test_concat_conflict(tmp_path, two_files):
    out = tmp_path / 'out.po'
    _concat(input_files=list(two_files), output_file=str(out)).run()
    text = out.read_text(encoding='utf-8')
    assert '#, fuzzy\nmsgid "x"\nmsgstr ""\n' in text
    assert '#-#-#-#-#  a.po (PA 1.0)  #-#-#-#-#' in text
    assert '#-#-#-#-#  b.po (PB 1.0)  #-#-#-#-#' in text
    assert 'msgid "same"\nmsgstr "s"' in text
    with pytest.raises(PoFileError):
        read_po(out.open('rb'), abort_invalid=True)


def test_concat_use_first_and_unique(tmp_path, two_files):
    out = tmp_path / 'out.po'
    _concat(input_files=list(two_files), output_file=str(out), use_first=True).run()
    cat = read_po(out.open('rb'), abort_invalid=True)
    assert cat['x'].string == 'A'
    assert not cat['x'].fuzzy
    _concat(input_files=list(two_files), output_file=str(out), unique=True).run()
    cat = read_po(out.open('rb'))
    assert [m.id for m in cat if m.id] == ['y']
    _concat(input_files=list(two_files), output_file=str(out), more_than=1).run()
    assert {m.id for m in read_po(out.open('rb')) if m.id} == {'x', 'same'}


def test_concat_option_errors(two_files):
    with pytest.raises(OptionError):
        _concat(input_files=[])
    with pytest.raises(OptionError):
        _concat(input_files=list(two_files), unique=True, less_than=3)
    with pytest.raises(OptionError):
        _concat(input_files=list(two_files), no_wrap=True, width=50)


def test_catalog_conflicts():
    cat = Catalog()
    msg = cat.add('foo', 'bar')
    cat.add_conflict(msg, 'dir/a.po', 'P', '1')
    [conflict] = cat.get_conflicts('foo')
    assert conflict == {'message': msg, 'filename': 'dir/a.po', 'project': 'P', 'version': '1'}
    assert cat.get_conflicts('foo', 'ctx') == []
    from io import BytesIO
    buf = BytesIO()
    write_po(buf, cat, omit_header=True)
    assert b'#-#-#-#-#  a.po (P 1)  #-#-#-#-#' in buf.getvalue()


def test_merge(tmp_path):
    de = _po(tmp_path / 'def.po', 'msgid "a"\nmsgstr "A"\n\nmsgid "gone"\nmsgstr "G"\n\nmsgid "c"\nmsgstr ""\n')
    ref = _po(tmp_path / 'ref.pot', 'msgid "a"\nmsgstr ""\n\nmsgid "c"\nmsgstr ""\n\nmsgid "new"\nmsgstr ""\n')
    comp = _po(tmp_path / 'comp.po', 'msgid "a"\nmsgstr "A2"\n\nmsgid "c"\nmsgstr "C"\n\nmsgid "other"\nmsgstr "O"\n')
    cmd = MergeCatalog()
    cmd.input_files = [de, ref]
    cmd.update = True
    cmd.backup = True
    cmd.compendium = [comp]
    cmd.finalize_options()
    cmd.run()
    assert (tmp_path / 'def.po~').exists()
    cat = read_po(open(de, 'rb'))
    assert cat['a'].string == 'A'
    assert cat['c'].string == 'C'
    assert cat['c'].auto_comments == [comp]
    assert 'other' not in cat and 'gone' not in cat
    assert not cat.fuzzy

    cmd = MergeCatalog()
    cmd.input_files = [de, ref]
    cmd.output_file = str(tmp_path / 'o.po')
    cmd.compendium = comp
    cmd.compendium_overwrite = True
    cmd.no_compendium_comment = True
    cmd.finalize_options()
    cmd.run()
    cat = read_po(open(cmd.output_file, 'rb'))
    assert cat['a'].string == 'A2'
    assert cat['a'].auto_comments == []
    assert cat.obsolete['a'].string == 'A'


def test_merge_option_errors(tmp_path):
    for kwargs in ({'input_files': ['a']}, {'input_files': ['a', 'b']}):
        cmd = MergeCatalog()
        for k, v in kwargs.items():
            setattr(cmd, k, v)
        with pytest.raises(OptionError):
            cmd.finalize_options()
