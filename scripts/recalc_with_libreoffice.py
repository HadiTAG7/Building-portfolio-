#!/usr/bin/env python3
"""Recalculate every formula in a workbook with headless LibreOffice and save a copy.

The allocation workbook is saved without cached formula values, so reading it
with openpyxl(data_only=True) returns None for every formula. This script opens
it in LibreOffice Calc, forces a full recalculation and writes a new .xlsx that
contains the computed values (used by scripts/make_test_fixtures.py).

Requires LibreOffice Calc and its Python-UNO bridge (apt install libreoffice-calc python3-uno).

Usage:
    python3 scripts/recalc_with_libreoffice.py input.xlsx output.xlsx
"""
import os
import subprocess
import sys
import tempfile
import time

import uno  # noqa: F401  (provided by python3-uno)
from com.sun.star.beans import PropertyValue


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def main(src, dst):
    src, dst = os.path.abspath(src), os.path.abspath(dst)
    profile = tempfile.mkdtemp(prefix="lo-profile-")
    port = 2002
    office = subprocess.Popen(
        ["soffice", "--headless", "--norestore", "--nologo", "--nodefault",
         f"-env:UserInstallation=file://{profile}",
         f"--accept=socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        ctx = None
        for _ in range(60):
            try:
                ctx = resolver.resolve(f"uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(1)
        if ctx is None:
            sys.exit("could not connect to LibreOffice")
        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        doc = desktop.loadComponentFromURL(f"file://{src}", "_blank", 0, (prop("Hidden", True),))
        doc.calculateAll()
        doc.storeToURL(f"file://{dst}", (prop("FilterName", "Calc MS Excel 2007 XML"),))
        doc.close(True)
        try:
            desktop.terminate()
        except Exception:
            pass
    finally:
        try:
            office.wait(timeout=30)
        except subprocess.TimeoutExpired:
            office.kill()
    print(f"wrote {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
