The usage line in `--help` shows double square brackets for an optional argument whose type is a `Choice` (or a `DateTime`):

```python
import click

@click.command()
@click.argument("method", type=click.Choice(["foo", "bar", "baz"]), nargs=-1)
def cli(method):
    pass

cli()
```

```
$ python cli.py --help
Usage: cli.py [OPTIONS] [[foo|bar|baz]]...
```

Same with `required=False` instead of `nargs=-1` (`[[foo|bar|baz]]`), and with `type=click.DateTime(formats=["%Y-%m-%d"])`, which gives `[[%Y-%m-%d]]`. The choices are already in brackets, so the extra pair is just noise; I expected `Usage: cli.py [OPTIONS] [foo|bar|baz]...`. Required arguments of these types look fine.

Please fix this.
