from io import BytesIO

import pytest

from babel.messages.catalog import Catalog
from babel.messages.frontend import ConcatenateCatalog, MergeCatalog, OptionError
from babel.messages.pofile import PoFileError, read_po, write_po


def save(path, messages):
    catalog = Catalog(project='Example', version='1.0')
    for id, string in messages.items():
        catalog.add(id, string)
    with path.open('wb') as output:
        write_po(output, catalog)
    return str(path)


def test_concat_conflict(tmp_path):
    first = save(tmp_path / 'first.po', {'hello': 'one', 'same': 'equal'})
    second = save(tmp_path / 'second.po', {'hello': 'two', 'same': 'equal'})
    command = ConcatenateCatalog()
    command.input_files = [first, second]
    command.output_file = str(tmp_path / 'out.po')
    command.ensure_finalized()
    command.run()
    data = (tmp_path / 'out.po').read_bytes()
    assert b'#, fuzzy\nmsgid "hello"\nmsgstr ""' in data
    assert b'#-#-#-#-#  first.po (Example 1.0)  #-#-#-#-#\nmsgstr "one"' in data
    assert data.count(b'#-#-#-#-#') == 4
    with pytest.raises(PoFileError, match='conflict'):
        read_po(BytesIO(data), abort_invalid=True)


def test_concat_unique_and_use_first(tmp_path):
    first = save(tmp_path / 'first.po', {'hello': 'one', 'only': 'unique'})
    second = save(tmp_path / 'second.po', {'hello': 'two'})
    command = ConcatenateCatalog()
    command.input_files = [first, second]
    command.output_file = str(tmp_path / 'out.po')
    command.unique = True
    command.ensure_finalized()
    command.run()
    result = read_po((tmp_path / 'out.po').open('rb'))
    assert result.get('hello') is None
    assert result.get('only').string == 'unique'


@pytest.mark.parametrize('command,options', [
    (ConcatenateCatalog, {}),
    (ConcatenateCatalog, {'input_files': ['a'], 'unique': True, 'more_than': 1}),
    (ConcatenateCatalog, {'input_files': ['a'], 'width': 80, 'no_wrap': True}),
    (MergeCatalog, {'input_files': ['a']}),
    (MergeCatalog, {'input_files': ['a', 'b']}),
])
def test_invalid_options(command, options):
    instance = command()
    for key, value in options.items():
        setattr(instance, key, value)
    with pytest.raises(OptionError):
        instance.ensure_finalized()


def test_merge_compendium_and_backup(tmp_path):
    definition = save(tmp_path / 'def.po', {'hello': 'old', 'empty': ''})
    original = (tmp_path / 'def.po').read_bytes()
    template = save(tmp_path / 'ref.pot', {'hello': '', 'empty': ''})
    compendium = save(tmp_path / 'extra.po', {'hello': 'new', 'empty': 'filled', 'extra': 'ignored'})
    command = MergeCatalog()
    command.input_files = [definition, template]
    command.update = command.backup = command.compendium_overwrite = True
    command.compendium = [compendium]
    command.ensure_finalized()
    command.run()
    assert (tmp_path / 'def.po~').read_bytes() == original
    with open(definition, 'rb') as source:
        result = read_po(source)
    assert result.get('hello').string == 'new'
    assert result.obsolete['hello'].string == 'old'
    assert result.get('empty').string == 'filled'
    assert result.get('extra') is None
    assert compendium in result.get('hello').auto_comments
    assert not result.fuzzy
