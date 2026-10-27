from io import BytesIO

import pytest

from babel.messages.catalog import Catalog
from babel.messages.frontend import ConcatenateCatalog, MergeCatalog, OptionError
from babel.messages.pofile import PoFileError, read_po, write_po


def save(path, messages):
    catalog = Catalog(locale='de', project='Demo', version='1')
    for id, string in messages:
        catalog.add(id, string)
    with path.open('wb') as output:
        write_po(output, catalog)
    return str(path)


def test_concat_conflicts(tmp_path):
    first = save(tmp_path / 'a.po', [('hello', 'Hallo'), ('same', 'gleich')])
    second = save(tmp_path / 'b.po', [('hello', 'Servus'), ('same', 'gleich')])
    command = ConcatenateCatalog()
    command.input_files = [first, second]
    command.output_file = str(tmp_path / 'out.po')
    command.ensure_finalized()
    command.run()
    data = (tmp_path / 'out.po').read_bytes()
    assert b'#-#-#-#-#  a.po (Demo 1)  #-#-#-#-#' in data
    assert data.count(b'#-#-#-#-#  ') == 2
    with pytest.raises(PoFileError):
        read_po(BytesIO(data), abort_invalid=True)
    command.use_first = True
    command.run()
    assert read_po(BytesIO((tmp_path / 'out.po').read_bytes()))['hello'].string == 'Hallo'


def test_merge_compendium_backup(tmp_path):
    definition = save(tmp_path / 'def.po', [('hello', 'Hallo'), ('empty', '')])
    template = save(tmp_path / 'ref.pot', [('hello', ''), ('empty', '')])
    compendium = save(tmp_path / 'extra.po', [('hello', 'Servus'), ('empty', 'Leer'), ('extra', 'Extra')])
    original = (tmp_path / 'def.po').read_bytes()
    command = MergeCatalog()
    command.input_files = [definition, template]
    command.update = command.backup = True
    command.compendium = [compendium]
    command.ensure_finalized()
    command.run()
    assert (tmp_path / 'def.po~').read_bytes() == original
    result = read_po(BytesIO((tmp_path / 'def.po').read_bytes()))
    assert result['hello'].string == 'Hallo'
    assert result['empty'].string == 'Leer'
    assert compendium in result['empty'].auto_comments
    assert result.get('extra') is None
    assert not result.fuzzy


@pytest.mark.parametrize('command', [ConcatenateCatalog, MergeCatalog])
def test_missing_inputs(command):
    with pytest.raises(OptionError):
        command().ensure_finalized()


def test_conflict_api_plural():
    catalog = Catalog(locale='de')
    message = catalog.add(('one', 'many'), ('eins', 'viele'), context='count')
    catalog.add_conflict(message, 'a.po', 'Demo', '1')
    buffer = BytesIO()
    write_po(buffer, catalog)
    assert b'msgstr[0] ""' in buffer.getvalue()
    assert b'msgstr[1] "viele"' in buffer.getvalue()
    assert 'fuzzy' not in message.flags
    assert catalog.get_conflicts('one', 'count')[0]['message'].string == ('eins', 'viele')
