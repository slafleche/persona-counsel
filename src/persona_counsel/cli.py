"""CLI entrypoint for persona-counsel."""

import json
import platform
import sys
from pathlib import Path

import typer

from persona_counsel import __version__

app = typer.Typer(help="persona-counsel CLI")


@app.callback()
def app_callback() -> None:
    """Root command group callback."""


@app.command()
def doctor(json_output: bool = typer.Option(False, "--json")) -> None:
    """Report local environment health."""
    checks = {
        "backend_version": __version__,
        "python_version": platform.python_version(),
        "python_ok": sys.version_info >= (3, 11),
        "platform": platform.system().lower(),
        "arch": platform.machine().lower(),
        "python_executable": sys.executable,
        "cwd": str(Path.cwd()),
        "paths": {
            "personas_exists": Path("personas").exists(),
            "counsels_exists": Path("counsels").exists(),
            "sessions_exists": Path("sessions").exists(),
        },
    }
    status = "ok" if checks["python_ok"] else "error"
    result = {"status": status, "checks": checks}

    if json_output:
        typer.echo(json.dumps(result, indent=2))
        raise typer.Exit(code=0 if status == "ok" else 1)

    if status == "ok":
        typer.echo("ok")
        return

    typer.echo(
        "error: python >= 3.11 required "
        f"(current: {checks['python_version']})",
        err=True,
    )
    raise typer.Exit(code=1)


@app.command()
def setup() -> None:
    """Create baseline project folders for persona-counsel."""
    for dirname in ("personas", "counsels", "sessions"):
        Path(dirname).mkdir(parents=True, exist_ok=True)
    typer.echo("setup complete")


def main() -> None:
    """Console script entrypoint."""
    app()


if __name__ == "__main__":
    main()
