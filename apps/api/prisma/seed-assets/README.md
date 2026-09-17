# Demo PDF fixtures

The Prisma seed uploads the PDFs in `documents/` to the object keys stored in
the seeded `Document` rows. The files are intentionally small, deterministic
fixtures for the PDF viewer and thesis screenshots; they are not full course
notes.

Regenerate all fixtures from the repository root:

```bash
python3 web-app/apps/api/prisma/seed-assets/generate_demo_pdfs.py
```

The generator requires Python Cairo and the local Noto Sans fonts. If a seeded
document's expected page count changes, update the matching manifest entry in
the generator as well. The seed validates every PDF page count before it writes
metadata or uploads content to MinIO.
