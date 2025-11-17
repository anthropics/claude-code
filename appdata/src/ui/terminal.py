"""
AppDater - Terminal UI
Rich progress bars and beautiful terminal output.
"""

from typing import List, Dict, Any
from pathlib import Path

try:
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
    from rich.table import Table
    from rich.panel import Panel
    from rich import box
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


class TerminalUI:
    """Terminal UI with Rich progress bars"""

    def __init__(self, use_rich: bool = True):
        """
        Initialize terminal UI

        Args:
            use_rich: Whether to use Rich library (falls back to plain if not available)
        """
        self.use_rich = use_rich and RICH_AVAILABLE

        if self.use_rich:
            self.console = Console()
        else:
            self.console = None

    def print(self, message: str, style: str = ""):
        """
        Print message with optional styling

        Args:
            message: Message to print
            style: Rich style (e.g., "bold green", "red", etc.)
        """
        if self.use_rich and self.console:
            self.console.print(message, style=style)
        else:
            print(message)

    def print_header(self, title: str):
        """
        Print a header

        Args:
            title: Header title
        """
        if self.use_rich and self.console:
            self.console.print(f"\n[bold cyan]{title}[/bold cyan]")
            self.console.print("=" * len(title))
        else:
            print(f"\n{title}")
            print("=" * len(title))

    def print_panel(self, content: str, title: str = "", style: str = ""):
        """
        Print content in a panel

        Args:
            content: Panel content
            title: Panel title
            style: Panel style
        """
        if self.use_rich and self.console:
            panel = Panel(content, title=title, border_style=style)
            self.console.print(panel)
        else:
            print(f"\n{title}")
            print("-" * 60)
            print(content)
            print("-" * 60)

    def print_table(self, headers: List[str], rows: List[List[str]], title: str = ""):
        """
        Print a table

        Args:
            headers: Column headers
            rows: Table rows
            title: Table title
        """
        if self.use_rich and self.console:
            table = Table(title=title, box=box.ROUNDED)

            for header in headers:
                table.add_column(header, style="cyan")

            for row in rows:
                table.add_row(*row)

            self.console.print(table)
        else:
            if title:
                print(f"\n{title}")
            print("-" * 80)
            print(" | ".join(headers))
            print("-" * 80)
            for row in rows:
                print(" | ".join(str(cell) for cell in row))
            print("-" * 80)

    def create_progress(self):
        """
        Create a progress bar context

        Returns:
            Progress context (use with 'with' statement)
        """
        if self.use_rich:
            return Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeRemainingColumn(),
                console=self.console
            )
        else:
            return PlainProgress()

    def print_summary(self, summary: Dict[str, Any]):
        """
        Print operation summary

        Args:
            summary: Summary dictionary from logger
        """
        if self.use_rich and self.console:
            table = Table(title="Operation Summary", box=box.DOUBLE)
            table.add_column("Metric", style="cyan")
            table.add_column("Count", justify="right", style="green")

            for key, value in summary.items():
                # Format key nicely
                formatted_key = key.replace('_', ' ').title()
                table.add_row(formatted_key, str(value))

            self.console.print("\n")
            self.console.print(table)
        else:
            print("\n" + "=" * 60)
            print("OPERATION SUMMARY")
            print("=" * 60)
            for key, value in summary.items():
                formatted_key = key.replace('_', ' ').title()
                print(f"{formatted_key:30} {value:>10}")
            print("=" * 60)

    def print_duplicate_report(self, report: Dict[str, Any]):
        """
        Print duplicate detection report

        Args:
            report: Report dictionary from duplicate detector
        """
        if self.use_rich and self.console:
            # Summary panel
            summary_text = (
                f"Products with duplicates: {report['total_products_with_duplicates']}\n"
                f"Files to delete: {report['total_files_to_delete']}\n"
                f"Files to keep: {report['total_files_to_keep']}\n"
                f"Space to free: {report['space_to_free_gb']:.2f} GB"
            )
            self.print_panel(summary_text, title="Duplicate Detection Summary", style="yellow")

            # Detailed table
            if report['products']:
                table = Table(title="Duplicate Products", box=box.ROUNDED)
                table.add_column("Product", style="cyan")
                table.add_column("Versions", justify="right", style="yellow")
                table.add_column("Keep", style="green")
                table.add_column("Delete", style="red")

                for product_name, product_info in report['products'].items():
                    newest = product_info['newest']
                    oldest = product_info['oldest']
                    versions = product_info['total_versions']

                    table.add_row(
                        product_name,
                        str(versions),
                        newest,
                        f"{versions - 1} older version(s)"
                    )

                self.console.print("\n")
                self.console.print(table)
        else:
            print("\n" + "=" * 80)
            print("DUPLICATE DETECTION SUMMARY")
            print("=" * 80)
            print(f"Products with duplicates: {report['total_products_with_duplicates']}")
            print(f"Files to delete: {report['total_files_to_delete']}")
            print(f"Files to keep: {report['total_files_to_keep']}")
            print(f"Space to free: {report['space_to_free_gb']:.2f} GB")
            print("=" * 80)

    def confirm(self, message: str, default: bool = False) -> bool:
        """
        Ask for user confirmation

        Args:
            message: Confirmation message
            default: Default response

        Returns:
            True if user confirms
        """
        if self.use_rich and self.console:
            self.console.print(f"\n[yellow]{message}[/yellow]")
        else:
            print(f"\n{message}")

        default_str = "Y/n" if default else "y/N"
        response = input(f"Continue? [{default_str}] ").strip().lower()

        if not response:
            return default

        return response in ['y', 'yes']


class PlainProgress:
    """Plain progress indicator without Rich"""

    def __init__(self):
        self.current = 0
        self.total = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.total > 0:
            print(f"\nProcessed {self.current}/{self.total} items")

    def add_task(self, description: str, total: int):
        """Add a task"""
        self.total = total
        print(f"\n{description}")
        return 0  # Task ID

    def update(self, task_id: int, advance: int = 1):
        """Update progress"""
        self.current += advance
        if self.total > 0 and self.current % 10 == 0:
            pct = (self.current / self.total) * 100
            print(f"  Progress: {self.current}/{self.total} ({pct:.0f}%)")
