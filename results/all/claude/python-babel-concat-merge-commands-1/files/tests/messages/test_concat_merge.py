import pytest

from babel.messages.frontend import ConcatenateCatalog, MergeCatalog, OptionError


def _po(path, body):
    path.write_text('msgid ""\nmsgstr ""\n"Project-Id-Version: P 1\\n"\n\n' + body)
    return str(path)


def test_concat_conflict_and_use_first(tmp_path):
    a = _po(tmp_path / 'a.po', 'msgid "x"\nmsgstr "1"\n')
    b = _po(tmp_path / 'b.po', 'msgid "x"\nmsgstr "2"\n')
    out = tmp_path / 'o.po'
    cmd = ConcatenateCatalog()
    cmd.input_files, cmd.output_file = [a, b], str(out)
    cmd.finalize_options()
    cmd.run()
    text = out.read_text()
    assert '#, fuzzy' in text
    assert '#-#-#-#-#  a.po (P 1)  #-#-#-#-#' in text
    cmd = ConcatenateCatalog()
    cmd.input_files, cmd.output_file, cmd.use_first = [a, b], str(out), True
    cmd.finalize_options()
    cmd.run()
    assert 'msgstr "1"' in out.read_text()


def test_concat_option_errors():
    cmd = ConcatenateCatalog()
    with pytest.raises(OptionError):
        cmd.finalize_options()
    cmd.input_files, cmd.unique, cmd.less_than = ['a'], True, 3
    with pytest.raises(OptionError):
        cmd.finalize_options()


def test_merge_compendium_and_backup(tmp_path):
    d = _po(tmp_path / 'd.po', 'msgid "x"\nmsgstr ""\n')
    r = _po(tmp_path / 'r.pot', 'msgid "x"\nmsgstr ""\n\nmsgid "y"\nmsgstr ""\n')
    c = _po(tmp_path / 'c.po', 'msgid "x"\nmsgstr "X"\n\nmsgid "z"\nmsgstr "Z"\n')
    cmd = MergeCatalog()
    cmd.input_files, cmd.update, cmd.backup, cmd.compendium = [d, r], True, True, [c]
    cmd.finalize_options()
    cmd.run()
    text = (tmp_path / 'd.po').read_text()
    assert 'msgstr "X"' in text and '#. ' + c in text and '"z"' not in text
    assert (tmp_path / 'd.po~').exists()
    with pytest.raises(OptionError):
        MergeCatalog().finalize_options()
