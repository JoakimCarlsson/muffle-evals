from io import BytesIO

import pytest

from babel.messages.catalog import Catalog
from babel.messages.frontend import ConcatenateCatalog, MergeCatalog, OptionError
from babel.messages.pofile import PoFileError, read_po, write_po


def save(path, catalog):
    with path.open('wb') as output:
        write_po(output, catalog)
    return str(path)


def test_concat_conflicts_and_context(tmp_path):
    first = Catalog(locale='de', project='Example', version='1')
    first.add('hello', 'Hallo', context='greeting')
    first.add(('cat', 'cats'), ('Katze', 'Katzen'))
    second = Catalog(locale='de')
    second.add('hello', 'Guten Tag', context='greeting')
    second.add(('cat', 'cats'), ('Katze', 'Katzen'))
    command = ConcatenateCatalog()
    command.input_files = [save(tmp_path / 'a.po', first), save(tmp_path / 'b.po', second)]
    command.output_file = str(tmp_path / 'out.po')
    command.ensure_finalized()
    command.run()
    output = (tmp_path / 'out.po').read_bytes()
    assert b'#-#-#-#-#  a.po (Example 1)  #-#-#-#-#' in output
    assert output.count(b'#-#-#-#-#  ') == 2
    assert b'msgstr ""\n#-#-#-#-#' in output
    with pytest.raises(PoFileError):
        read_po(BytesIO(output), abort_invalid=True)
    command.use_first = True
    command.run()
    with open(command.output_file, 'rb') as source:
        result = read_po(source, abort_invalid=True)
    assert result.get('hello', 'greeting').string == 'Hallo'


def test_merge_compendium_backup_and_obsolete(tmp_path):
    original = Catalog(locale='de')
    original.add('hello', 'alt')
    template = Catalog()
    template.add('hello')
    template.add('new')
    extra = Catalog(locale='de')
    extra.add('hello', 'neu')
    extra.add('new', 'Neu')
    extra.add('unwanted', 'Nein')
    command = MergeCatalog()
    command.input_files = [save(tmp_path / 'def.po', original), save(tmp_path / 'ref.pot', template)]
    before = (tmp_path / 'def.po').read_bytes()
    command.compendium = [save(tmp_path / 'extra.po', extra)]
    command.update = command.backup = command.compendium_overwrite = True
    command.ensure_finalized()
    command.run()
    assert (tmp_path / 'def.po~').read_bytes() == before
    with open(command.input_files[0], 'rb') as source:
        result = read_po(source, abort_invalid=True)
    assert result['hello'].string == 'neu'
    assert result.obsolete['hello'].string == 'alt'
    assert result['new'].string == 'Neu'
    assert result.get('unwanted') is None
    assert command.compendium[0] in result['new'].auto_comments
    assert not result.fuzzy


@pytest.mark.parametrize('command', [ConcatenateCatalog, MergeCatalog])
def test_missing_inputs(command):
    with pytest.raises(OptionError):
        command().ensure_finalized()


def test_conflict_api_preserves_translation():
    catalog = Catalog()
    message = catalog.add('hello', 'Hallo')
    catalog.add_conflict(message, 'a.po', 'Example', '1')
    message.string = ''
    assert catalog.get_conflicts('hello')[0]['message'].string == 'Hallo'
    assert catalog.get_conflicts('hello', 'other') == []
